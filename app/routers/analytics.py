import calendar
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, extract
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Student, AttendanceRecord, Department, AttendanceStatus, Staff, UserRole
from app.schemas import (
    AttendanceSummaryResponse, StudentAnalyticsItem, AttendanceLogEntry,
    GlobalOverviewResponse, DepartmentBenchmarkItem, YearBenchmarkItem
)
from app.dependencies import get_current_user_context, CurrentUserContext, verify_department_access

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/global-overview", response_model=GlobalOverviewResponse)
async def get_global_overview(
    filter_type: Optional[str] = Query("all", description="all, yearly, monthly, daily, custom"),
    year_date: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    target_date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Global Institutional Analytics:
    Computes college-wide attendance metrics across all departments and academic years.
    Returns:
    - Overall attendance percentage & KPI cards
    - Department benchmark comparisons & ranking
    - Class year breakdowns (1st, 2nd, 3rd year)
    - Consolidated student shortage (<75%) roster
    - Recent 100 period attendance activity logs
    """
    # 1. Fetch All Active Departments
    depts_res = await db.execute(select(Department).order_by(Department.name))
    departments = depts_res.scalars().all()
    dept_map = {d.id: d.name for d in departments}

    # 2. Fetch All Active Students
    students_res = await db.execute(select(Student).order_by(Student.department_id, Student.year, Student.roll_no))
    students = students_res.scalars().all()
    student_dept_map = {s.roll_no: s.department_id for s in students}
    student_year_map = {s.roll_no: s.year for s in students}
    student_name_map = {s.roll_no: s.name for s in students}

    # 3. Build Date Filter Conditions
    conditions = []
    filter_label = "All Days & Years"

    if filter_type == "yearly" and year_date:
        conditions.append(extract('year', AttendanceRecord.date) == year_date)
        filter_label = f"Year {year_date}"
    elif filter_type == "monthly" and year_date and month:
        if month < 1 or month > 12:
            month = 1
        conditions.append(extract('year', AttendanceRecord.date) == year_date)
        conditions.append(extract('month', AttendanceRecord.date) == month)
        filter_label = f"{calendar.month_name[month]} {year_date}"
    elif filter_type == "daily" and target_date:
        try:
            parsed_d = date.fromisoformat(target_date)
            conditions.append(AttendanceRecord.date == parsed_d)
            filter_label = f"Day: {parsed_d.strftime('%b %d, %Y')}"
        except ValueError:
            pass
    elif filter_type == "custom" and start_date and end_date:
        try:
            parsed_start = date.fromisoformat(start_date)
            parsed_end = date.fromisoformat(end_date)
            conditions.append(AttendanceRecord.date >= parsed_start)
            conditions.append(AttendanceRecord.date <= parsed_end)
            filter_label = f"{parsed_start.strftime('%b %d, %Y')} – {parsed_end.strftime('%b %d, %Y')}"
        except ValueError:
            pass

    # 4. Fetch Filtered Attendance Records
    records_query = select(AttendanceRecord).options(selectinload(AttendanceRecord.staff))
    if conditions:
        records_query = records_query.where(and_(*conditions))
    records_query = records_query.order_by(AttendanceRecord.date.desc(), AttendanceRecord.hour_number.asc())

    records_res = await db.execute(records_query)
    all_records = records_res.scalars().all()

    # Aggregate by student roll_no
    records_by_student = {s.roll_no: [] for s in students}
    today = date.today()
    today_present = 0
    today_absent = 0
    today_od = 0
    unique_sessions = set()

    for r in all_records:
        dept_id = student_dept_map.get(r.roll_no)
        yr = student_year_map.get(r.roll_no)
        if dept_id and yr:
            unique_sessions.add((r.date, r.hour_number, dept_id, yr))
        if r.roll_no in records_by_student:
            records_by_student[r.roll_no].append(r)
        if r.date == today:
            if r.status == AttendanceStatus.PRESENT:
                today_present += 1
            elif r.status == AttendanceStatus.ABSENT:
                today_absent += 1
            elif r.status == AttendanceStatus.OD:
                today_od += 1

    # Compute Student Analytics & Shortages
    all_analytics = []
    shortage_list = []
    dept_student_analytics = {d.id: [] for d in departments}
    year_student_analytics = {1: [], 2: [], 3: []}

    for s in students:
        s_records = records_by_student.get(s.roll_no, [])
        total_conducted = len(s_records)
        p_cnt = sum(1 for r in s_records if r.status == AttendanceStatus.PRESENT)
        a_cnt = sum(1 for r in s_records if r.status == AttendanceStatus.ABSENT)
        od_cnt = sum(1 for r in s_records if r.status == AttendanceStatus.OD)

        pct = round(((p_cnt + od_cnt) / total_conducted) * 100.0, 1) if total_conducted > 0 else 0.0
        has_shortage = pct < 75.0 if total_conducted > 0 else False

        item = StudentAnalyticsItem(
            roll_no=s.roll_no,
            name=s.name,
            year=s.year,
            department_id=s.department_id,
            department_name=dept_map.get(s.department_id, f"Dept #{s.department_id}"),
            total_hours_conducted=total_conducted,
            present_hours=p_cnt,
            absent_hours=a_cnt,
            od_hours=od_cnt,
            attendance_percentage=pct,
            has_shortage=has_shortage
        )
        all_analytics.append(item)
        if has_shortage:
            shortage_list.append(item)
        if s.department_id in dept_student_analytics:
            dept_student_analytics[s.department_id].append(item)
        if s.year in year_student_analytics:
            year_student_analytics[s.year].append(item)

    # Department benchmarks
    dept_benchmarks = []
    for d in departments:
        d_items = dept_student_analytics.get(d.id, [])
        d_total_st = len(d_items)
        d_total_rec = sum(item.total_hours_conducted for item in d_items)
        d_pres = sum(item.present_hours for item in d_items)
        d_abs = sum(item.absent_hours for item in d_items)
        d_od = sum(item.od_hours for item in d_items)
        d_pct = round(((d_pres + d_od) / d_total_rec) * 100.0, 1) if d_total_rec > 0 else 0.0
        d_shortage = sum(1 for item in d_items if item.has_shortage)

        dept_benchmarks.append(
            DepartmentBenchmarkItem(
                department_id=d.id,
                department_name=d.name,
                department_code=getattr(d, "code", None) or (d.name[:4].upper() if d.name else "DEPT"),
                total_students=d_total_st,
                total_records=d_total_rec,
                present_records=d_pres,
                absent_records=d_abs,
                od_records=d_od,
                attendance_percentage=d_pct,
                shortage_students_count=d_shortage,
                total_hours_conducted=d_total_rec,
                shortage_count=d_shortage
            )
        )

    # Sort departments by attendance percentage descending
    dept_benchmarks.sort(key=lambda x: x.attendance_percentage, reverse=True)

    # Year benchmarks (1, 2, 3)
    year_labels = {1: "1st Year", 2: "2nd Year", 3: "3rd Year"}
    year_benchmarks = []
    for yr in (1, 2, 3):
        y_items = year_student_analytics.get(yr, [])
        y_total_st = len(y_items)
        y_total_rec = sum(item.total_hours_conducted for item in y_items)
        y_pres = sum(item.present_hours for item in y_items)
        y_abs = sum(item.absent_hours for item in y_items)
        y_od = sum(item.od_hours for item in y_items)
        y_pct = round(((y_pres + y_od) / y_total_rec) * 100.0, 1) if y_total_rec > 0 else 0.0
        y_shortage = sum(1 for item in y_items if item.has_shortage)

        year_benchmarks.append(
            YearBenchmarkItem(
                year=yr,
                year_label=year_labels.get(yr, f"Year {yr}"),
                total_students=y_total_st,
                total_records=y_total_rec,
                present_records=y_pres,
                absent_records=y_abs,
                od_records=y_od,
                attendance_percentage=y_pct,
                total_hours_conducted=y_total_rec,
                shortage_count=y_shortage
            )
        )

    # Overall Attendance %
    total_recs = len(all_records)
    total_pres_od = sum(1 for r in all_records if r.status in (AttendanceStatus.PRESENT, AttendanceStatus.OD))
    overall_pct = round((total_pres_od / total_recs) * 100.0, 1) if total_recs > 0 else 0.0

    # Recent 100 logs
    recent_logs = []
    for r in all_records[:100]:
        recent_logs.append(
            AttendanceLogEntry(
                id=r.id,
                date=r.date,
                hour_number=r.hour_number,
                roll_no=r.roll_no,
                student_name=student_name_map.get(r.roll_no, "Student"),
                department_name=dept_map.get(student_dept_map.get(r.roll_no, 0), ""),
                status=r.status,
                staff_id=r.staff_id,
                staff_name=r.staff.name if r.staff else None,
                staff_initials=r.staff.initials if r.staff else None
            )
        )

    return GlobalOverviewResponse(
        filter_type=filter_type or "all",
        filter_label=filter_label,
        total_departments=len(departments),
        total_students=len(students),
        total_records=total_recs,
        total_sessions_conducted=len(unique_sessions),
        total_hours_conducted=len(unique_sessions),
        today_present=today_present,
        today_absent=today_absent,
        today_od=today_od,
        overall_attendance_percentage=overall_pct,
        overall_percentage=overall_pct,
        total_shortage_count=len(shortage_list),
        shortage_count=len(shortage_list),
        departments=dept_benchmarks,
        department_benchmarks=dept_benchmarks,
        year_benchmarks=year_benchmarks,
        shortage_students=shortage_list,
        recent_logs=recent_logs
    )

@router.get("/attendance-summary", response_model=AttendanceSummaryResponse)
async def get_attendance_summary(
    department_id: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    filter_type: Optional[str] = Query("all", description="all, yearly, monthly, daily, custom"),
    year_date: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    target_date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Analytics Endpoint:
    Calculates attendance stats for students in specified department and year.
    Supports filtering to a specific department and year, or aggregating across all departments and years.
    Supports filtering across all days, specific year, specific month, specific day, or custom range.
    Returns calculated roster stats, period totals, and detailed daily period logs with staff initials.
    """
    if department_id and department_id > 0:
        verify_department_access(department_id, ctx)
        dept_res = await db.execute(select(Department).where(Department.id == department_id))
        dept = dept_res.scalar_one_or_none()
        dept_name = dept.name if dept else f"Dept #{department_id}"
    else:
        if ctx.role != UserRole.ADMIN and ctx.department_id:
            department_id = ctx.department_id
            dept_res = await db.execute(select(Department).where(Department.id == department_id))
            dept = dept_res.scalar_one_or_none()
            dept_name = dept.name if dept else f"Dept #{department_id}"
        else:
            department_id = None
            dept_name = "All Departments"

    # Fetch departments map for names
    all_depts_res = await db.execute(select(Department))
    dept_map = {d.id: d.name for d in all_depts_res.scalars().all()}

    # Build student query
    student_conditions = []
    if department_id:
        student_conditions.append(Student.department_id == department_id)
    if year and year in (1, 2, 3):
        student_conditions.append(Student.year == year)

    student_query = select(Student)
    if student_conditions:
        student_query = student_query.where(and_(*student_conditions))
    student_query = student_query.order_by(Student.department_id, Student.year, Student.roll_no)

    students_res = await db.execute(student_query)
    students = students_res.scalars().all()

    if not students:
        return AttendanceSummaryResponse(
            department_id=department_id,
            department_name=dept_name,
            year=year,
            filter_type=filter_type or "all",
            filter_label="All Days & Years",
            total_students=0,
            total_hours_in_period=0,
            today_present=0,
            today_absent=0,
            class_average_percentage=100.0,
            shortage_students_count=0,
            shortage_students=[],
            all_students=[],
            daily_logs=[]
        )

    roll_numbers = [s.roll_no for s in students]
    student_map = {s.roll_no: s.name for s in students}
    student_dept_map = {s.roll_no: s.department_id for s in students}

    # 3. Build Date Filter Conditions on AttendanceRecord
    conditions = [AttendanceRecord.roll_no.in_(roll_numbers)]
    filter_label = "All Days & Years"

    if filter_type == "yearly" and year_date:
        conditions.append(extract('year', AttendanceRecord.date) == year_date)
        filter_label = f"Year {year_date}"
    elif filter_type == "monthly" and year_date and month:
        if month < 1 or month > 12:
            month = 1
        conditions.append(extract('year', AttendanceRecord.date) == year_date)
        conditions.append(extract('month', AttendanceRecord.date) == month)
        filter_label = f"{calendar.month_name[month]} {year_date}"
    elif filter_type == "daily" and target_date:
        try:
            parsed_d = date.fromisoformat(target_date)
            conditions.append(AttendanceRecord.date == parsed_d)
            filter_label = f"Day: {parsed_d.strftime('%b %d, %Y')}"
        except ValueError:
            pass
    elif filter_type == "custom" and start_date and end_date:
        try:
            parsed_start = date.fromisoformat(start_date)
            parsed_end = date.fromisoformat(end_date)
            conditions.append(AttendanceRecord.date >= parsed_start)
            conditions.append(AttendanceRecord.date <= parsed_end)
            filter_label = f"{parsed_start.strftime('%b %d, %Y')} – {parsed_end.strftime('%b %d, %Y')}"
        except ValueError:
            pass

    # 4. Fetch Filtered Attendance Records with Staff Eager-Loaded
    records_res = await db.execute(
        select(AttendanceRecord)
        .options(selectinload(AttendanceRecord.staff))
        .where(and_(*conditions))
        .order_by(AttendanceRecord.date.desc(), AttendanceRecord.hour_number.asc(), AttendanceRecord.roll_no.asc())
    )
    all_records = records_res.scalars().all()

    # Map records by roll_no
    records_by_student = {roll_no: [] for roll_no in roll_numbers}
    for r in all_records:
        if r.roll_no in records_by_student:
            records_by_student[r.roll_no].append(r)

    today = date.today()

    all_analytics = []
    shortage_list = []
    total_percentage_sum = 0.0

    today_present = 0
    today_absent = 0
    period_present = 0
    period_absent = 0

    for s in students:
        s_records = records_by_student[s.roll_no]
        total_conducted = len(s_records)
        present_cnt = sum(1 for r in s_records if r.status == AttendanceStatus.PRESENT)
        absent_cnt = sum(1 for r in s_records if r.status == AttendanceStatus.ABSENT)
        od_cnt = sum(1 for r in s_records if r.status == AttendanceStatus.OD)

        period_present += present_cnt
        period_absent += absent_cnt

        # Attendance calculation: (Present + OD) / Total conducted * 100
        if total_conducted > 0:
            percentage = round(((present_cnt + od_cnt) / total_conducted) * 100.0, 1)
            has_shortage = percentage < 75.0
            total_percentage_sum += percentage
        else:
            percentage = 0.0
            has_shortage = False

        # Today's stats calculation
        today_records = [r for r in s_records if r.date == today]
        for tr in today_records:
            if tr.status == AttendanceStatus.PRESENT or tr.status == AttendanceStatus.OD:
                today_present += 1
            elif tr.status == AttendanceStatus.ABSENT:
                today_absent += 1

        analytics_item = StudentAnalyticsItem(
            roll_no=s.roll_no,
            name=s.name,
            year=s.year,
            department_id=s.department_id,
            department_name=dept_map.get(s.department_id, f"Dept #{s.department_id}"),
            total_hours_conducted=total_conducted,
            present_hours=present_cnt,
            absent_hours=absent_cnt,
            od_hours=od_cnt,
            attendance_percentage=percentage,
            has_shortage=has_shortage
        )

        all_analytics.append(analytics_item)
        if has_shortage:
            shortage_list.append(analytics_item)

    max_conducted = max([len(records_by_student[rn]) for rn in roll_numbers], default=0)
    if max_conducted > 0 and len(students) > 0:
        class_avg = round(total_percentage_sum / len(students), 1)
    else:
        class_avg = 0.0

    # Build Daily/Period Logs with Staff Attribution
    daily_logs = []
    for r in all_records:
        daily_logs.append(
            AttendanceLogEntry(
                id=r.id,
                date=r.date,
                hour_number=r.hour_number,
                roll_no=r.roll_no,
                student_name=student_map.get(r.roll_no, "Student"),
                department_name=dept_map.get(student_dept_map.get(r.roll_no, 0), ""),
                status=r.status,
                staff_id=r.staff_id,
                staff_name=r.staff.name if r.staff else None,
                staff_initials=r.staff.initials if r.staff else None
            )
        )

    return AttendanceSummaryResponse(
        department_id=department_id,
        department_name=dept_name,
        year=year,
        filter_type=filter_type or "all",
        filter_label=filter_label,
        total_students=len(students),
        total_hours_in_period=max_conducted,
        today_present=today_present,
        today_absent=today_absent,
        period_present=period_present,
        period_absent=period_absent,
        class_average_percentage=class_avg,
        shortage_students_count=len(shortage_list),
        shortage_students=shortage_list,
        all_students=all_analytics,
        daily_logs=daily_logs
    )
