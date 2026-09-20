from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import UserRole, Student, AttendanceRecord, Staff, StaffDepartment
from app.schemas import (
    AttendanceSubmitRequest, AttendanceRecordOut, ClassGridResponse, StudentGridItem, PeriodStaffInfo,
    CalendarStatusResponse
)
from app.dependencies import (
    get_current_user_context, CurrentUserContext, require_roles, verify_department_access
)
from app.time_lock import verify_dual_layer_time_lock, resolve_calendar_status, get_current_ist_date

router = APIRouter(prefix="/attendance", tags=["Attendance"])

@router.post("/submit", response_model=List[AttendanceRecordOut])
async def submit_attendance(
    req: AttendanceSubmitRequest,
    x_bypass_time_lock: Optional[str] = Header(None, alias="X-Bypass-Time-Lock"),
    ctx: CurrentUserContext = Depends(require_roles(UserRole.STAFF, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepts a list of student roll numbers and their status (Present/Absent/OD) for a specific period (1-5).
    - Must pass through Dual-Layer Time-Lock dependency (Calendar/Holiday check, Global Lock 09:00-17:00 IST & Period Lock).
    - Logs staff_id in the database.
    - Strictly isolates department access.
    """
    # 1. Enforce Calendar and Dual-Layer Time-Lock (Holiday + Half-Day + IST time window)
    await verify_dual_layer_time_lock(req.hour_number, db=db, target_date=req.date, bypass_header=x_bypass_time_lock)
    
    if not req.records:
        raise HTTPException(status_code=400, detail="No attendance records provided")
    
    roll_numbers = [r.roll_no for r in req.records]
    
    # 2. Fetch target students to verify existence and check department isolation
    student_query = select(Student).where(Student.roll_no.in_(roll_numbers))
    result = await db.execute(student_query)
    students = {s.roll_no: s for s in result.scalars().all()}
    
    if len(students) != len(set(roll_numbers)):
        missing = set(roll_numbers) - set(students.keys())
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Students not found: {list(missing)}"
        )
    
    # Verify all students belong to the authorized department
    target_dept_id = next(iter(students.values())).department_id
    verify_department_access(target_dept_id, ctx)
    
    for s in students.values():
        if s.department_id != target_dept_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All students in a single submission batch must belong to the same department."
            )
    
    # Determine valid staff_id (referencing staffs table)
    active_staff_id = ctx.staff_id
    if not active_staff_id:
        st_res = await db.execute(select(Staff).where(Staff.user_id == ctx.user_id))
        st_obj = st_res.scalar_one_or_none()
        if st_obj:
            active_staff_id = st_obj.id
        else:
            first_staff = await db.execute(
                select(Staff).join(StaffDepartment, Staff.department_id == StaffDepartment.id).where(StaffDepartment.department_1_id == target_dept_id)
            )
            f_obj = first_staff.scalar_one_or_none()
            active_staff_id = f_obj.id if f_obj else 1

    # 3. Upsert / Save attendance records logging staff_id
    saved_records = []
    for item in req.records:
        stmt = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.date == req.date,
                AttendanceRecord.hour_number == req.hour_number,
                AttendanceRecord.roll_no == item.roll_no
            )
        )
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        
        if existing:
            existing.status = item.status
            existing.staff_id = active_staff_id
            saved_records.append(existing)
        else:
            new_record = AttendanceRecord(
                date=req.date,
                hour_number=req.hour_number,
                roll_no=item.roll_no,
                status=item.status,
                staff_id=active_staff_id
            )
            db.add(new_record)
            saved_records.append(new_record)
            
    await db.flush()
    return saved_records

@router.get("/grid", response_model=ClassGridResponse)
async def get_attendance_grid(
    department_id: int,
    year: int,
    target_date: date,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the 5-hour grid of attendance for all students in a department and year for a target date,
    including information on which staff member took attendance for each period.
    """
    verify_department_access(department_id, ctx)
    if year not in (1, 2, 3):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Academic year must be 1, 2, or 3. 4th year is not supported."
        )
    # Fetch students in department & year
    students_res = await db.execute(
        select(Student)
        .where(and_(Student.department_id == department_id, Student.year == year))
        .order_by(Student.roll_no)
    )
    students = students_res.scalars().all()
    
    roll_numbers = [s.roll_no for s in students]
    
    # Fetch attendance records for target date and roll numbers including staff
    records_res = await db.execute(
        select(AttendanceRecord)
        .options(selectinload(AttendanceRecord.staff))
        .where(
            and_(
                AttendanceRecord.date == target_date,
                AttendanceRecord.roll_no.in_(roll_numbers)
            )
        )
    )
    records = records_res.scalars().all()
    
    # Map attendance by roll_no -> hour_number -> status
    attendance_map = {}
    period_staff = {}
    for r in records:
        if r.roll_no not in attendance_map:
            attendance_map[r.roll_no] = {}
        attendance_map[r.roll_no][r.hour_number] = r.status

        if r.hour_number not in period_staff and r.staff:
            period_staff[r.hour_number] = PeriodStaffInfo(
                staff_id=r.staff.id,
                name=r.staff.name,
                initials=r.staff.initials
            )
        
    grid_students = []
    for s in students:
        s_statuses = {hour: attendance_map.get(s.roll_no, {}).get(hour, None) for hour in range(1, 6)}
        grid_students.append(
            StudentGridItem(
                roll_no=s.roll_no,
                name=s.name,
                year=s.year,
                statuses=s_statuses
            )
        )
        
    day_type, active_periods, day_description = await resolve_calendar_status(target_date, db)

    return ClassGridResponse(
        date=target_date,
        department_id=department_id,
        year=year,
        students=grid_students,
        period_staff=period_staff,
        day_type=day_type,
        active_periods=active_periods,
        day_description=day_description
    )

@router.get("/calendar/today", response_model=CalendarStatusResponse)
async def get_today_calendar_status(
    target_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the resolved academic calendar status (day_type, active_periods, description)
    for target_date or current IST date.
    """
    check_date = target_date or get_current_ist_date()
    day_type, active_periods, description = await resolve_calendar_status(check_date, db)
    return CalendarStatusResponse(
        date=check_date,
        day_type=day_type,
        active_periods=active_periods,
        description=description,
        is_holiday=(day_type == "holiday"),
        is_half_day=(day_type == "half_day")
    )

