import re
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func, extract
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app.models import Department, User, UserRole, Student, Staff, StaffDepartment, AttendanceRecord, CalendarOverride, DayType
from app.schemas import (
    DepartmentCreate, DepartmentUpdate, DepartmentOut,
    StaffCreate, StaffUpdate, StaffOut, UserOut, StaffDropdownOut,
    StudentCreate, StudentUpdate, StudentOut,
    CalendarOverrideCreate, CalendarOverrideOut
)
from app.security import get_password_hash, get_pin_hash
from app.dependencies import require_admin

router = APIRouter(prefix="/admin", tags=["Admin Management"])

# --- 1. Department CRUD ---
@router.get("/departments", response_model=List[DepartmentOut])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    result = await db.execute(
        select(Department).options(selectinload(Department.users)).order_by(Department.id)
    )
    depts = result.scalars().all()
    output = []
    for d in depts:
        dept_user = next((u for u in d.users if u.role == UserRole.DEPARTMENT), None)
        output.append(DepartmentOut(
            id=d.id,
            name=d.name,
            account_username=dept_user.username if dept_user else None
        ))
    return output

@router.post("/departments", response_model=DepartmentOut)
async def create_department(
    req: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    clean_name = req.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Department name cannot be empty.")

    # Check existing name
    existing = await db.execute(select(Department).where(func.lower(Department.name) == clean_name.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Department '{clean_name}' already exists.")

    dept = Department(name=clean_name)
    db.add(dept)
    await db.flush()

    # Always create a dedicated Department Dashboard User Account for this specific department
    if req.account_username and req.account_username.strip():
        clean_user = req.account_username.strip().lower()
        user_exist = await db.execute(select(User).where(func.lower(User.username) == clean_user))
        if user_exist.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Username '{clean_user}' is already taken.")
    else:
        # Auto-generate a clean, unique username from department name
        slug = re.sub(r'[^a-zA-Z0-9_]', '', clean_name.lower().replace(" ", "_"))
        base_user = f"{slug}_dept" if slug else f"dept_{dept.id}"
        clean_user = base_user
        counter = 1
        while True:
            user_exist = await db.execute(select(User).where(func.lower(User.username) == clean_user))
            if not user_exist.scalar_one_or_none():
                break
            clean_user = f"{base_user}_{counter}"
            counter += 1

    pwd_hash = get_password_hash(req.account_password.strip()) if (req.account_password and req.account_password.strip()) else None

    dept_user = User(
        username=clean_user,
        password_hash=pwd_hash,
        role=UserRole.DEPARTMENT,
        department_id=dept.id
    )
    db.add(dept_user)
    await db.flush()

    return DepartmentOut(
        id=dept.id,
        name=dept.name,
        account_username=clean_user
    )

@router.put("/departments/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: int,
    req: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    result = await db.execute(
        select(Department).options(selectinload(Department.users)).where(Department.id == dept_id)
    )
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    if req.name and req.name.strip():
        dept.name = req.name.strip()

    dept_user = next((u for u in dept.users if u.role == UserRole.DEPARTMENT), None)

    if dept_user:
        if req.account_username and req.account_username.strip():
            clean_user = req.account_username.strip().lower()
            if clean_user != dept_user.username.lower():
                user_exist = await db.execute(select(User).where(func.lower(User.username) == clean_user))
                if user_exist.scalar_one_or_none():
                    raise HTTPException(status_code=400, detail=f"Username '{clean_user}' is already taken.")
                dept_user.username = clean_user
        if req.account_password and req.account_password.strip():
            dept_user.password_hash = get_password_hash(req.account_password.strip())
    else:
        # Guarantee a dashboard user exists for this department
        slug = re.sub(r'[^a-zA-Z0-9_]', '', dept.name.lower().replace(" ", "_"))
        base_user = req.account_username.strip().lower() if (req.account_username and req.account_username.strip()) else (f"{slug}_dept" if slug else f"dept_{dept.id}")
        clean_user = base_user
        counter = 1
        while True:
            user_exist = await db.execute(select(User).where(func.lower(User.username) == clean_user))
            if not user_exist.scalar_one_or_none():
                break
            clean_user = f"{base_user}_{counter}"
            counter += 1

        pwd_hash = get_password_hash(req.account_password.strip()) if (req.account_password and req.account_password.strip()) else None
        new_user = User(
            username=clean_user,
            password_hash=pwd_hash,
            role=UserRole.DEPARTMENT,
            department_id=dept.id
        )
        db.add(new_user)
        dept_user = new_user

    await db.flush()
    return DepartmentOut(
        id=dept.id,
        name=dept.name,
        account_username=dept_user.username if dept_user else None
    )

@router.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    await db.delete(dept)
    await db.flush()
    return {"message": f"Department ID {dept_id} deleted successfully."}


# --- 2. Staff Setup (Dedicated Staff Table) ---
@router.get("/staff", response_model=List[StaffOut])
async def list_staff_members(
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    query = select(Staff).options(
        selectinload(Staff.staff_department).selectinload(StaffDepartment.dept_1)
    ).order_by(Staff.id)
    result = await db.execute(query)
    staff_list = result.scalars().all()

    # Query all departments to resolve additional department names
    all_depts_res = await db.execute(select(Department))
    dept_map = {d.id: d.name for d in all_depts_res.scalars().all()}

    output = []
    for s in staff_list:
        primary_dept_id = s.primary_department_id or 0
        all_ids = s.all_department_ids or []
        add_ids = [did for did in all_ids if did != primary_dept_id]
        add_names = [dept_map.get(did, f"Dept #{did}") for did in add_ids if did in dept_map]
        output.append(StaffOut(
            id=s.id,
            name=s.name,
            initials=s.initials,
            username=s.username,
            department_id=primary_dept_id,
            department_name=s.primary_department.name if s.primary_department else dept_map.get(primary_dept_id, ""),
            additional_department_ids=add_ids,
            additional_departments=add_names
        ))
    return output

@router.post("/staff", response_model=StaffOut)
async def create_staff_user(
    req: StaffCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    try:
        # Verify target department exists
        dept_res = await db.execute(select(Department).where(Department.id == req.department_id))
        dept = dept_res.scalar_one_or_none()
        if not dept:
            raise HTTPException(status_code=404, detail=f"Department ID {req.department_id} not found")

        clean_initials = req.initials.strip().upper()
        if len(clean_initials) < 2 or len(clean_initials) > 5:
            raise HTTPException(status_code=400, detail="Staff initials must be between 2 and 5 letters.")

        # Verify unique initials
        init_res = await db.execute(select(Staff).where(func.upper(Staff.initials) == clean_initials))
        if init_res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Initials '{clean_initials}' are already assigned to another staff member.")

        clean_username = req.username.strip().lower()
        # Verify unique username in User and Staff tables
        user_res = await db.execute(select(User).where(func.lower(User.username) == clean_username))
        if user_res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Username '{clean_username}' is already taken.")
        staff_user_res = await db.execute(select(Staff).where(func.lower(Staff.username) == clean_username))
        if staff_user_res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Username '{clean_username}' is already taken.")

        staff_user = User(
            username=clean_username,
            password_hash=get_password_hash(req.password),
            pin_hash=get_pin_hash(req.pin),
            role=UserRole.STAFF,
            department_id=req.department_id
        )
        db.add(staff_user)
        await db.flush()

        # Clean, deduplicate and validate additional department IDs against existing departments in DB
        clean_add_ids = []
        for did in (req.additional_department_ids or []):
            try:
                num = int(did)
                if num != req.department_id and num not in clean_add_ids and num > 0:
                    clean_add_ids.append(num)
            except (ValueError, TypeError):
                pass

        if clean_add_ids:
            valid_res = await db.execute(select(Department.id).where(Department.id.in_(clean_add_ids)))
            valid_set = set(valid_res.scalars().all())
            clean_add_ids = [did for did in clean_add_ids if did in valid_set]

        all_depts = [req.department_id] + clean_add_ids
        all_depts = all_depts[:9]

        # Create StaffDepartment row first
        sd = StaffDepartment(
            department_1_id=all_depts[0] if len(all_depts) > 0 else req.department_id,
            department_2_id=all_depts[1] if len(all_depts) > 1 else None,
            department_3_id=all_depts[2] if len(all_depts) > 2 else None,
            department_4_id=all_depts[3] if len(all_depts) > 3 else None,
            department_5_id=all_depts[4] if len(all_depts) > 4 else None,
            department_6_id=all_depts[5] if len(all_depts) > 5 else None,
            department_7_id=all_depts[6] if len(all_depts) > 6 else None,
            department_8_id=all_depts[7] if len(all_depts) > 7 else None,
            department_9_id=all_depts[8] if len(all_depts) > 8 else None
        )
        db.add(sd)
        await db.flush()

        staff = Staff(
            name=req.name.strip(),
            initials=clean_initials,
            username=clean_username,
            password_hash=get_password_hash(req.password),
            pin_hash=get_pin_hash(req.pin),
            department_id=sd.id,
            user_id=staff_user.id
        )
        db.add(staff)
        await db.flush()

        saved_staff_id = staff.id
        saved_staff_name = staff.name
        saved_staff_initials = staff.initials
        saved_staff_username = staff.username

        await db.commit()

        all_depts_res = await db.execute(select(Department))
        dept_map = {d.id: d.name for d in all_depts_res.scalars().all()}
        add_names = [dept_map.get(did, f"Dept #{did}") for did in clean_add_ids if did in dept_map]

        return StaffOut(
            id=saved_staff_id,
            name=saved_staff_name,
            initials=saved_staff_initials,
            username=saved_staff_username,
            department_id=req.department_id,
            department_name=dept_map.get(req.department_id, dept.name),
            additional_department_ids=clean_add_ids,
            additional_departments=add_names
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create staff member: {str(e)}")

@router.put("/staff/{staff_id}", response_model=StaffOut)
async def update_staff_user(
    staff_id: int,
    req: StaffUpdate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    try:
        result = await db.execute(select(Staff).options(selectinload(Staff.staff_department).selectinload(StaffDepartment.dept_1)).where(Staff.id == staff_id))
        staff = result.scalar_one_or_none()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")

        user = None
        if staff.user_id:
            u_res = await db.execute(select(User).where(User.id == staff.user_id))
            user = u_res.scalar_one_or_none()

        if req.name and req.name.strip():
            staff.name = req.name.strip()

        if req.initials and req.initials.strip():
            clean_initials = req.initials.strip().upper()
            if len(clean_initials) < 2 or len(clean_initials) > 5:
                raise HTTPException(status_code=400, detail="Staff initials must be between 2 and 5 letters.")
            dup_init = await db.execute(select(Staff).where(func.upper(Staff.initials) == clean_initials, Staff.id != staff_id))
            if dup_init.scalar_one_or_none():
                raise HTTPException(status_code=400, detail=f"Initials '{clean_initials}' are already taken.")
            staff.initials = clean_initials

        if req.username and req.username.strip():
            clean_username = req.username.strip().lower()
            dup_user = await db.execute(select(User).where(func.lower(User.username) == clean_username, User.id != (staff.user_id or 0)))
            if dup_user.scalar_one_or_none():
                raise HTTPException(status_code=400, detail=f"Username '{clean_username}' is already taken.")
            dup_staff = await db.execute(select(Staff).where(func.lower(Staff.username) == clean_username, Staff.id != staff_id))
            if dup_staff.scalar_one_or_none():
                raise HTTPException(status_code=400, detail=f"Username '{clean_username}' is already taken.")
            staff.username = clean_username
            if user:
                user.username = clean_username

        if req.password and req.password.strip():
            pwd_hash = get_password_hash(req.password.strip())
            staff.password_hash = pwd_hash
            if user:
                user.password_hash = pwd_hash

        if req.pin and req.pin.strip():
            pin_clean = req.pin.strip()
            if len(pin_clean) < 4 or len(pin_clean) > 6:
                raise HTTPException(status_code=400, detail="Staff PIN must be between 4 and 6 digits.")
            pin_h = get_pin_hash(pin_clean)
            staff.pin_hash = pin_h
            if user:
                user.pin_hash = pin_h

        # Determine primary department
        primary_dept_id = req.department_id if req.department_id else (staff.primary_department_id or 0)
        if req.department_id:
            dept_res = await db.execute(select(Department).where(Department.id == req.department_id))
            dept = dept_res.scalar_one_or_none()
            if not dept:
                raise HTTPException(status_code=404, detail=f"Department ID {req.department_id} not found")
            if user:
                user.department_id = req.department_id
        elif not primary_dept_id or primary_dept_id <= 0:
            first_dept_res = await db.execute(select(Department).order_by(Department.id))
            first_dept = first_dept_res.scalars().first()
            if first_dept:
                primary_dept_id = first_dept.id

        # Fetch or create StaffDepartment record
        sd = staff.staff_department
        if not sd:
            if staff.department_id:
                sd_res = await db.execute(select(StaffDepartment).where(StaffDepartment.id == staff.department_id))
                sd = sd_res.scalar_one_or_none()
            if not sd:
                sd = StaffDepartment()
                db.add(sd)
                await db.flush()

        staff.department_id = sd.id

        raw_add_ids = req.additional_department_ids if req.additional_department_ids is not None else [did for did in staff.all_department_ids if did != primary_dept_id]
        curr_add_ids = []
        for did in (raw_add_ids or []):
            try:
                num = int(did)
                if num != primary_dept_id and num not in curr_add_ids and num > 0:
                    curr_add_ids.append(num)
            except (ValueError, TypeError):
                pass

        # Verify all additional department IDs exist in database to prevent FK integrity crashes
        if curr_add_ids:
            valid_res = await db.execute(select(Department.id).where(Department.id.in_(curr_add_ids)))
            valid_set = set(valid_res.scalars().all())
            curr_add_ids = [did for did in curr_add_ids if did in valid_set]

        all_depts = [primary_dept_id] + curr_add_ids
        all_depts = all_depts[:9]

        sd.department_1_id = all_depts[0] if len(all_depts) > 0 else primary_dept_id
        sd.department_2_id = all_depts[1] if len(all_depts) > 1 else None
        sd.department_3_id = all_depts[2] if len(all_depts) > 2 else None
        sd.department_4_id = all_depts[3] if len(all_depts) > 3 else None
        sd.department_5_id = all_depts[4] if len(all_depts) > 4 else None
        sd.department_6_id = all_depts[5] if len(all_depts) > 5 else None
        sd.department_7_id = all_depts[6] if len(all_depts) > 6 else None
        sd.department_8_id = all_depts[7] if len(all_depts) > 7 else None
        sd.department_9_id = all_depts[8] if len(all_depts) > 8 else None

        await db.flush()

        saved_staff_id = staff.id
        saved_staff_name = staff.name
        saved_staff_initials = staff.initials
        saved_staff_username = staff.username

        await db.commit()

        all_depts_res = await db.execute(select(Department))
        dept_map = {d.id: d.name for d in all_depts_res.scalars().all()}
        add_names = [dept_map.get(did, f"Dept #{did}") for did in curr_add_ids if did in dept_map]

        return StaffOut(
            id=saved_staff_id,
            name=saved_staff_name,
            initials=saved_staff_initials,
            username=saved_staff_username,
            department_id=primary_dept_id,
            department_name=dept_map.get(primary_dept_id, ""),
            additional_department_ids=curr_add_ids,
            additional_departments=add_names
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update staff member: {str(e)}")

@router.delete("/staff/{staff_id}")
async def delete_staff_user(
    staff_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    result = await db.execute(select(Staff).options(selectinload(Staff.staff_department)).where(Staff.id == staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    sd = staff.staff_department

    if staff.user_id:
        user_res = await db.execute(select(User).where(User.id == staff.user_id))
        user = user_res.scalar_one_or_none()
        if user:
            await db.delete(user)

    await db.delete(staff)
    if sd:
        await db.delete(sd)

    await db.commit()
    return {"message": f"Staff member #{staff_id} deleted successfully"}


# --- 3. Student CRUD ---
@router.get("/students", response_model=List[StudentOut])
async def list_all_students(
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    result = await db.execute(select(Student).order_by(Student.roll_no))
    return result.scalars().all()

@router.post("/students", response_model=StudentOut)
async def create_student(
    req: StudentCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    # Check duplicate roll_no
    existing = await db.execute(select(Student).where(Student.roll_no == req.roll_no))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Student roll_no '{req.roll_no}' already exists.")

    # Check department
    dept_res = await db.execute(select(Department).where(Department.id == req.department_id))
    if not dept_res.scalar_one_or_none():
        raise HTTPException(status_code=44, detail=f"Department ID {req.department_id} not found")

    student = Student(
        roll_no=req.roll_no,
        name=req.name,
        year=req.year,
        department_id=req.department_id
    )
    db.add(student)
    await db.flush()
    return student

@router.put("/students/{roll_no}", response_model=StudentOut)
async def update_student(
    roll_no: str,
    req: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    result = await db.execute(select(Student).where(Student.roll_no == roll_no))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student roll_no '{roll_no}' not found")

    if req.name:
        student.name = req.name
    if req.year:
        student.year = req.year
    if req.department_id:
        student.department_id = req.department_id

    await db.flush()
    return student

@router.delete("/students/{roll_no}")
async def delete_student(
    roll_no: str,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    result = await db.execute(select(Student).where(Student.roll_no == roll_no))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student roll_no '{roll_no}' not found")

    # Delete any related attendance records for this student first to maintain foreign key integrity
    await db.execute(delete(AttendanceRecord).where(AttendanceRecord.roll_no == roll_no))

    await db.delete(student)
    await db.flush()
    return {"message": f"Student '{roll_no}' removed successfully."}

# --- 4. Academic Calendar & Holiday Management ---
@router.get("/calendar/overrides", response_model=List[CalendarOverrideOut])
async def list_calendar_overrides(
    year: Optional[int] = None,
    month: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    """
    Returns calendar overrides configured by administrators.
    Allows filtering by year/month or start_date/end_date.
    """
    stmt = select(CalendarOverride).order_by(CalendarOverride.date)
    if start_date and end_date:
        stmt = stmt.where(CalendarOverride.date.between(start_date, end_date))
    elif year and month:
        stmt = stmt.where(
            extract('year', CalendarOverride.date) == year,
            extract('month', CalendarOverride.date) == month
        )
    elif year:
        stmt = stmt.where(extract('year', CalendarOverride.date) == year)

    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/calendar/override", response_model=CalendarOverrideOut)
async def create_or_update_calendar_override(
    req: CalendarOverrideCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    """
    Upserts a calendar override for a specific date:
    - day_type: 'full_day', 'half_day', 'holiday'
    - active_periods: e.g. [1, 2, 3, 4, 5] or [1, 2, 3] or []
    - description: optional descriptive string
    """
    # Auto-resolve active_periods if not specified
    active_periods = req.active_periods
    if active_periods is None:
        if req.day_type == DayType.FULL_DAY:
            active_periods = [1, 2, 3, 4, 5]
        elif req.day_type == DayType.HALF_DAY:
            active_periods = [1, 2, 3]
        else: # HOLIDAY
            active_periods = []

    stmt = select(CalendarOverride).where(CalendarOverride.date == req.date)
    res = await db.execute(stmt)
    override = res.scalar_one_or_none()

    if override:
        override.day_type = req.day_type
        override.active_periods = active_periods
        override.description = req.description
    else:
        override = CalendarOverride(
            date=req.date,
            day_type=req.day_type,
            active_periods=active_periods,
            description=req.description
        )
        db.add(override)

    await db.flush()
    return override

@router.delete("/calendar/override/{override_date}")
async def delete_calendar_override(
    override_date: date,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin)
):
    """
    Deletes a calendar override, reverting the specified date back to default schedule.
    """
    stmt = select(CalendarOverride).where(CalendarOverride.date == override_date)
    res = await db.execute(stmt)
    override = res.scalar_one_or_none()

    if not override:
        raise HTTPException(status_code=404, detail=f"No calendar override found for date {override_date.isoformat()}")

    await db.delete(override)
    await db.flush()
    return {"message": f"Calendar override for {override_date.isoformat()} removed. Reverted to default schedule."}

