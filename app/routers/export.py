import io
import calendar
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, extract

from sqlalchemy.orm import selectinload

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from app.database import get_db
from app.models import Student, AttendanceRecord, Department, AttendanceStatus, Staff, UserRole
from app.dependencies import get_current_user_context, CurrentUserContext, verify_department_access

router = APIRouter(prefix="/export", tags=["Export"])

@router.get("/available-years")
async def get_available_years(
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns a sorted list of distinct calendar years found in AttendanceRecord dates.
    Defaults to [current_year] if no records exist.
    """
    stmt = select(extract('year', AttendanceRecord.date)).distinct()
    res = await db.execute(stmt)
    years_raw = res.scalars().all()
    
    valid_years = sorted(list({int(y) for y in years_raw if y is not None}), reverse=True)
    current_year = date.today().year
    if current_year not in valid_years:
        valid_years.insert(0, current_year)
    if not valid_years:
        valid_years = [current_year]
        
    return {"years": valid_years}


def generate_daily_attendance_log_workbook(
    all_records: list,
    students: list,
    dept_map: dict,
    scope_title: str,
    year_label: str,
    date_label: str,
    filename_suffix: str
) -> Response:
    """
    Builds a specialized Daily Period Attendance View Excel workbook matching the Dashboard Attendance Table format:
    - Sheet 1: Daily Attendance View (Date, Roll No, Student Name, Dept, Year, Periods 1-5, Day Total, %, Status, Staff)
    - Sheet 2: Faculty Session Log (Date, Period, Department, Year, Staff, Student counts, Session %)
    """
    wb = openpyxl.Workbook()

    # ----------------------------------------------------
    # SHEET 1: DAILY ATTENDANCE VIEW (Dashboard Table Format)
    # ----------------------------------------------------
    ws1 = wb.active
    ws1.title = "Daily Attendance View"
    ws1.views.sheetView[0].showGridLines = True

    # Styling Palette
    title_font = Font(name="Segoe UI", size=15, bold=True, color="1E3A8A")
    subtitle_font = Font(name="Segoe UI", size=9, italic=True, color="475569")
    kpi_title_font = Font(name="Segoe UI", size=8, bold=True, color="475569")
    kpi_value_font = Font(name="Segoe UI", size=12, bold=True, color="0F172A")

    header_white_font = Font(name="Segoe UI", size=9, bold=True, color="FFFFFF")
    navy_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    kpi_box_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

    regular_font = Font(name="Segoe UI", size=9, color="1E293B")
    bold_regular_font = Font(name="Segoe UI", size=9, bold=True, color="0F172A")
    mono_font = Font(name="Consolas", size=9, bold=True, color="1E3A8A")

    pres_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    pres_font = Font(name="Segoe UI", size=8, bold=True, color="166534")

    abs_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    abs_font = Font(name="Segoe UI", size=8, bold=True, color="991B1B")

    od_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    od_font = Font(name="Segoe UI", size=8, bold=True, color="92400E")

    dash_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    dash_font = Font(name="Segoe UI", size=9, color="94A3B8")

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # Title & Metadata
    ws1.merge_cells("A1:N1")
    ws1.cell(row=1, column=1, value="ARIGNAR ANNA COLLEGE — DAILY ATTENDANCE LOG REPORT").font = title_font
    ws1.row_dimensions[1].height = 24

    ws1.merge_cells("A2:N2")
    sub_text = f"Scope: {scope_title}   |   Class Cohort: {year_label}   |   Timeframe: {date_label}   |   Exported: {datetime.now().strftime('%Y-%m-%d %H:%M IST')}"
    ws1.cell(row=2, column=1, value=sub_text).font = subtitle_font
    ws1.row_dimensions[2].height = 18

    # Group records by (date, roll_no)
    student_map = {s.roll_no: s.name for s in students}
    student_dept_map = {s.roll_no: s.department_id for s in students}
    student_year_map = {s.roll_no: s.year for s in students}

    daily_map = {}
    faculty_sessions = {}

    for r in all_records:
        key = (r.date, r.roll_no)
        if key not in daily_map:
            daily_map[key] = {
                "date": r.date,
                "roll_no": r.roll_no,
                "student_name": student_map.get(r.roll_no, "Student"),
                "department_id": student_dept_map.get(r.roll_no),
                "department_name": dept_map.get(student_dept_map.get(r.roll_no, 0), ""),
                "year": student_year_map.get(r.roll_no, 1),
                "periods": {1: None, 2: None, 3: None, 4: None, 5: None},
                "staff_map": {},
                "present_count": 0,
                "absent_count": 0,
                "od_count": 0,
                "conducted_count": 0
            }

        staff_init = r.staff.initials if r.staff else None
        staff_name = r.staff.name if r.staff else None
        status_val = r.status.value if hasattr(r.status, "value") else str(r.status)

        daily_map[key]["periods"][r.hour_number] = {
            "status": status_val,
            "staff_initials": staff_init,
            "staff_name": staff_name
        }
        if staff_init:
            daily_map[key]["staff_map"][staff_init] = staff_name or staff_init

        daily_map[key]["conducted_count"] += 1
        st_lower = status_val.lower()
        if st_lower == "present":
            daily_map[key]["present_count"] += 1
        elif st_lower == "absent":
            daily_map[key]["absent_count"] += 1
        elif st_lower == "od":
            daily_map[key]["od_count"] += 1

        dept_id_val = student_dept_map.get(r.roll_no, 0)
        yr_val = student_year_map.get(r.roll_no, 1)
        staff_id_val = r.staff_id or 0
        fac_key = (r.date, r.hour_number, dept_id_val, yr_val, staff_id_val)
        if fac_key not in faculty_sessions:
            faculty_sessions[fac_key] = {
                "date": r.date,
                "hour_number": r.hour_number,
                "department_name": dept_map.get(dept_id_val, ""),
                "year": yr_val,
                "staff_name": staff_name or "-",
                "staff_initials": staff_init or "-",
                "total": 0,
                "present": 0,
                "absent": 0,
                "od": 0
            }
        faculty_sessions[fac_key]["total"] += 1
        if st_lower == "present":
            faculty_sessions[fac_key]["present"] += 1
        elif st_lower == "absent":
            faculty_sessions[fac_key]["absent"] += 1
        elif st_lower == "od":
            faculty_sessions[fac_key]["od"] += 1

    sorted_rows = sorted(daily_map.values(), key=lambda x: x["roll_no"])
    sorted_rows.sort(key=lambda x: x["date"], reverse=True)

    # KPI Badges at Rows 4 & 5
    tot_days = len(sorted_rows)
    tot_periods = sum(r["conducted_count"] for r in sorted_rows)
    tot_pres = sum(r["present_count"] for r in sorted_rows)
    tot_abs = sum(r["absent_count"] for r in sorted_rows)
    tot_od = sum(r["od_count"] for r in sorted_rows)
    overall_pct = round(((tot_pres + tot_od) / tot_periods) * 100.0, 1) if tot_periods > 0 else 0.0

    kpi_cards = [
        ("Student-Day Logs", str(tot_days), 1, 2),
        ("Conducted Periods", str(tot_periods), 3, 4),
        ("Total Present", str(tot_pres), 5, 6),
        ("Total Absent", str(tot_abs), 7, 8),
        ("Total OD", str(tot_od), 9, 10),
        ("Average Attendance", f"{overall_pct}%", 11, 14),
    ]
    for title, val, start_col, end_col in kpi_cards:
        ws1.merge_cells(start_row=4, start_column=start_col, end_row=4, end_column=end_col)
        c_title = ws1.cell(row=4, column=start_col, value=title)
        c_title.font = kpi_title_font
        c_title.fill = kpi_box_fill
        c_title.alignment = Alignment(horizontal="center", vertical="center")

        ws1.merge_cells(start_row=5, start_column=start_col, end_row=5, end_column=end_col)
        c_val = ws1.cell(row=5, column=start_col, value=val)
        c_val.font = kpi_value_font
        c_val.fill = kpi_box_fill
        c_val.alignment = Alignment(horizontal="center", vertical="center")

        for r_box in range(4, 6):
            for c_box in range(start_col, end_col + 1):
                ws1.cell(row=r_box, column=c_box).border = thin_border

    # Headers at Row 7 (Matching Dashboard Daily Attendance Table)
    headers = [
        "Date", "Roll No", "Student Name", "Department", "Year",
        "Period 1", "Period 2", "Period 3", "Period 4", "Period 5",
        "Day Total", "Attendance %", "Status", "Taken By (Staff)"
    ]
    ws1.row_dimensions[7].height = 28
    for c_idx, h in enumerate(headers, 1):
        cell = ws1.cell(row=7, column=c_idx, value=h)
        cell.font = header_white_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    if not sorted_rows:
        ws1.merge_cells("A8:N8")
        empty_c = ws1.cell(row=8, column=1, value="No daily attendance records found matching the selected criteria.")
        empty_c.font = Font(name="Segoe UI", size=10, italic=True, color="64748B")
        empty_c.alignment = Alignment(horizontal="center", vertical="center")
        empty_c.border = thin_border
        ws1.row_dimensions[8].height = 30
    else:
        for r_idx, row in enumerate(sorted_rows, 8):
            ws1.row_dimensions[r_idx].height = 22
            c_date = ws1.cell(row=r_idx, column=1, value=row["date"].isoformat())
            c_date.alignment = Alignment(horizontal="center", vertical="center")
            c_date.font = mono_font

            c_roll = ws1.cell(row=r_idx, column=2, value=row["roll_no"])
            c_roll.alignment = Alignment(horizontal="center", vertical="center")
            c_roll.font = mono_font

            c_name = ws1.cell(row=r_idx, column=3, value=row["student_name"])
            c_name.font = bold_regular_font
            c_name.alignment = Alignment(horizontal="left", vertical="center")

            c_dept = ws1.cell(row=r_idx, column=4, value=row["department_name"])
            c_dept.alignment = Alignment(horizontal="left", vertical="center")
            c_dept.font = regular_font

            c_yr = ws1.cell(row=r_idx, column=5, value=f"Yr {row['year']}")
            c_yr.alignment = Alignment(horizontal="center", vertical="center")
            c_yr.font = bold_regular_font

            for h in range(1, 6):
                p_col = 5 + h
                p_data = row["periods"][h]
                p_cell = ws1.cell(row=r_idx, column=p_col)
                p_cell.alignment = Alignment(horizontal="center", vertical="center")
                if not p_data:
                    p_cell.value = "-"
                    p_cell.font = dash_font
                    p_cell.fill = dash_fill
                else:
                    st = p_data["status"]
                    init = p_data["staff_initials"]
                    p_cell.value = f"{st.upper()} [{init}]" if init else st.upper()
                    if st.lower() == "present":
                        p_cell.font = pres_font
                        p_cell.fill = pres_fill
                    elif st.lower() == "absent":
                        p_cell.font = abs_font
                        p_cell.fill = abs_fill
                    elif st.lower() == "od":
                        p_cell.font = od_font
                        p_cell.fill = od_fill

            cond = row["conducted_count"]
            pres = row["present_count"]
            od = row["od_count"]
            pct = round(((pres + od) / cond) * 100.0, 1) if cond > 0 else 0.0

            c_tot = ws1.cell(row=r_idx, column=11, value=f"{pres + od}/{cond}")
            c_tot.alignment = Alignment(horizontal="center", vertical="center")
            c_tot.font = bold_regular_font

            c_pct = ws1.cell(row=r_idx, column=12, value=f"{pct:.1f}%")
            c_pct.alignment = Alignment(horizontal="center", vertical="center")
            c_pct.font = pres_font if pct >= 75.0 else abs_font
            if pct < 75.0:
                c_pct.fill = abs_fill

            c_st = ws1.cell(row=r_idx, column=13, value="Satisfactory" if pct >= 75.0 else "<75% Shortage")
            c_st.alignment = Alignment(horizontal="center", vertical="center")
            c_st.font = pres_font if pct >= 75.0 else abs_font
            if pct < 75.0:
                c_st.fill = abs_fill

            staff_list = [f"{init} ({name})" if name and name != init else init for init, name in row["staff_map"].items()]
            c_staff = ws1.cell(row=r_idx, column=14, value=", ".join(staff_list) if staff_list else "-")
            c_staff.font = regular_font
            c_staff.alignment = Alignment(horizontal="left", vertical="center")

            for c in range(1, 15):
                ws1.cell(row=r_idx, column=c).border = thin_border

    # Auto column width
    for col in ws1.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws1.column_dimensions[col_letter].width = max(max_len + 4, 12)

    ws1.freeze_panes = "A8"

    # ----------------------------------------------------
    # SHEET 2: FACULTY SESSION ROSTER
    # ----------------------------------------------------
    ws2 = wb.create_sheet(title="Faculty Session Log")
    ws2.views.sheetView[0].showGridLines = True

    fac_headers = [
        "Date", "Period", "Department", "Year", "Staff Initials", "Faculty Name",
        "Students Marked", "Present", "Absent", "OD", "Period %"
    ]
    ws2.row_dimensions[1].height = 28
    for c_idx, h in enumerate(fac_headers, 1):
        c = ws2.cell(row=1, column=c_idx, value=h)
        c.font = header_white_font
        c.fill = navy_fill
        c.alignment = Alignment(horizontal="center", vertical="center")
        c.border = thin_border

    sorted_fac = sorted(faculty_sessions.values(), key=lambda x: (x["date"], x["hour_number"]), reverse=True)
    if not sorted_fac:
        ws2.merge_cells("A2:K2")
        c_emp = ws2.cell(row=2, column=1, value="No faculty sessions logged for the selected criteria.")
        c_emp.font = Font(name="Segoe UI", size=10, italic=True, color="64748B")
        c_emp.alignment = Alignment(horizontal="center", vertical="center")
        c_emp.border = thin_border
        ws2.row_dimensions[2].height = 26
    else:
        for r_idx, f_row in enumerate(sorted_fac, 2):
            ws2.row_dimensions[r_idx].height = 20
            f_tot = f_row["total"]
            f_pres = f_row["present"]
            f_od = f_row["od"]
            f_pct = round(((f_pres + f_od) / f_tot) * 100.0, 1) if f_tot > 0 else 0.0

            ws2.cell(row=r_idx, column=1, value=f_row["date"].isoformat()).alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=2, value=f"Period {f_row['hour_number']}").alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=3, value=f_row["department_name"]).alignment = Alignment(horizontal="left")
            ws2.cell(row=r_idx, column=4, value=f"Yr {f_row['year']}").alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=5, value=f_row["staff_initials"]).alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=6, value=f_row["staff_name"]).alignment = Alignment(horizontal="left")
            ws2.cell(row=r_idx, column=7, value=f_tot).alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=8, value=f_pres).alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=9, value=f_row["absent"]).alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=10, value=f_od).alignment = Alignment(horizontal="center")

            p_cell = ws2.cell(row=r_idx, column=11, value=f"{f_pct:.1f}%")
            p_cell.alignment = Alignment(horizontal="center")
            p_cell.font = pres_font if f_pct >= 75.0 else abs_font

            for c in range(1, 12):
                ws2.cell(row=r_idx, column=c).border = thin_border

    for col in ws2.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws2.column_dimensions[col_letter].width = max(max_len + 4, 12)

    file_stream = io.BytesIO()
    wb.save(file_stream)
    file_stream.seek(0)

    scope_slug = scope_title.replace(' ', '_').replace('(', '').replace(')', '')
    filename = f"Daily_Attendance_Logs_{scope_slug}_{filename_suffix}.xlsx"
    return Response(
        content=file_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/attendance/{dept_id}/{year}/{month}")
async def export_attendance_excel(
    dept_id: int,
    year: int,
    month: int = 1,
    year_date: int = 2026,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    export_type: Optional[str] = "monthly",
    report_format: Optional[str] = Query("comprehensive", description="'comprehensive' or 'daily_log'"),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Enhanced Executive Excel Export Endpoint:
    Generates a professional multi-sheet .xlsx workbook:
    - Sheet 1 ('Class Summary'): Executive KPIs, Student Roster, Totals Row, Shortage (<75%) Alerts.
    - Sheet 2 ('Detailed Log'): Date-by-date & period-by-period attendance log.
    """
    verify_department_access(dept_id, ctx)
    if year not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Academic year must be 1, 2, or 3. 4th year is not supported.")

    # 1. Fetch Department Info
    dept_res = await db.execute(select(Department).where(Department.id == dept_id))
    dept = dept_res.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    # 2. Fetch Students
    students_res = await db.execute(
        select(Student)
        .where(and_(Student.department_id == dept_id, Student.year == year))
        .order_by(Student.roll_no)
    )
    students = students_res.scalars().all()
    roll_numbers = [s.roll_no for s in students]

    # 3. Determine Date Filter (Custom Range vs Monthly vs Yearly)
    date_label = "All Days & Years"
    filename_suffix = "All_Time"
    monthly_records = []
    records_by_student = {r: [] for r in roll_numbers}
    
    if roll_numbers:
        if export_type == "yearly":
            records_query = select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.roll_no.in_(roll_numbers),
                    extract('year', AttendanceRecord.date) == year_date
                )
            )
            date_label = f"Full Academic Year: {year_date}"
            filename_suffix = f"FullYear_{year_date}"
        elif export_type == "custom" or (start_date and end_date):
            if not start_date or not end_date:
                raise HTTPException(status_code=400, detail="start_date and end_date are required for custom date range export.")
            try:
                parsed_start = date.fromisoformat(start_date)
                parsed_end = date.fromisoformat(end_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
                
            records_query = select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.roll_no.in_(roll_numbers),
                    AttendanceRecord.date >= parsed_start,
                    AttendanceRecord.date <= parsed_end
                )
            )
            date_label = f"Custom Date Range: {parsed_start} to {parsed_end}"
            filename_suffix = f"Range_{parsed_start}_to_{parsed_end}"
        elif export_type == "all":
            records_query = select(AttendanceRecord).where(AttendanceRecord.roll_no.in_(roll_numbers))
            date_label = "All Days & Years"
            filename_suffix = "All_Time"
        else:
            if month < 1 or month > 12:
                month = 1
            month_name = calendar.month_name[month]
            records_query = select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.roll_no.in_(roll_numbers),
                    extract('year', AttendanceRecord.date) == year_date,
                    extract('month', AttendanceRecord.date) == month
                )
            )
            date_label = f"Month: {month_name} {year_date}"
            filename_suffix = f"{month_name[:3]}_{year_date}"

        records_res = await db.execute(
            records_query.options(selectinload(AttendanceRecord.staff)).order_by(AttendanceRecord.date, AttendanceRecord.hour_number)
        )
        monthly_records = records_res.scalars().all()

        for mr in monthly_records:
            if mr.roll_no in records_by_student:
                records_by_student[mr.roll_no].append(mr)

    if report_format == "daily_log":
        dept_map = {dept.id: dept.name}
        return generate_daily_attendance_log_workbook(
            all_records=monthly_records,
            students=students,
            dept_map=dept_map,
            scope_title=f"{dept.name} (Dept #{dept.id})",
            year_label=f"Year {year}",
            date_label=date_label,
            filename_suffix=filename_suffix
        )

    # 4. Build Excel Workbook
    wb = openpyxl.Workbook()
    
    # ----------------------------------------------------
    # SHEET 1: CLASS SUMMARY & EXECUTIVE REPORT
    # ----------------------------------------------------
    ws1 = wb.active
    ws1.title = "Class Summary"
    ws1.views.sheetView[0].showGridLines = True

    # Styling Palette
    title_font = Font(name="Segoe UI", size=16, bold=True, color="1E3A8A")
    subtitle_font = Font(name="Segoe UI", size=10, italic=True, color="475569")
    
    kpi_title_font = Font(name="Segoe UI", size=9, bold=True, color="475569")
    kpi_value_font = Font(name="Segoe UI", size=14, bold=True, color="0F172A")
    
    header_font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid") # Navy
    
    row_alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    
    shortage_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    shortage_font = Font(name="Segoe UI", size=10, bold=True, color="991B1B")
    
    satisfactory_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    satisfactory_font = Font(name="Segoe UI", size=10, bold=True, color="15803D")
    
    summary_fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
    summary_font = Font(name="Segoe UI", size=10, bold=True, color="0F172A")

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # Header Title Block
    ws1.merge_cells("A1:H1")
    ws1["A1"] = f"ARIGNAR ANNA COLLEGE — Academic Attendance Report ({dept.name})"
    ws1["A1"].font = title_font
    ws1["A1"].alignment = Alignment(vertical="center")

    ws1.merge_cells("A2:H2")
    ws1["A2"] = f"Class: Year {year} | {date_label} | Generated: {date.today().strftime('%Y-%m-%d')}"
    ws1["A2"].font = subtitle_font
    ws1["A2"].alignment = Alignment(vertical="center")

    # Executive KPI Block (Row 4 to 5)
    total_enrolled = len(students)
    all_tot_hrs = sum(len(records_by_student[s.roll_no]) for s in students)
    all_pres_hrs = sum(sum(1 for r in records_by_student[s.roll_no] if r.status in [AttendanceStatus.PRESENT, AttendanceStatus.OD]) for s in students)
    class_avg = round((all_pres_hrs / all_tot_hrs) * 100.0, 1) if all_tot_hrs > 0 else 100.0
    
    shortage_count = 0
    for s in students:
        s_recs = records_by_student[s.roll_no]
        t = len(s_recs)
        p = sum(1 for r in s_recs if r.status in [AttendanceStatus.PRESENT, AttendanceStatus.OD])
        pct = round((p / t) * 100.0, 1) if t > 0 else 100.0
        if pct < 75.0:
            shortage_count += 1

    kpis = [
        ("Total Students Enrolled", f"{total_enrolled} Students", "A4:B5"),
        ("Class Hours Conducted", f"{all_tot_hrs // total_enrolled if total_enrolled else 0} Hours", "C4:D5"),
        ("Class Attendance Avg", f"{class_avg}%", "E4:F5"),
        ("Shortage Alerts (<75%)", f"{shortage_count} Students", "G4:H5"),
    ]

    for label, val, cell_range in kpis:
        ws1.merge_cells(cell_range)
        top_left = ws1[cell_range.split(":")[0]]
        top_left.value = f"{label}\n{val}"
        top_left.font = kpi_value_font
        top_left.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        top_left.fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
        top_left.border = thin_border

    ws1.append([]) # Row 6 empty

    # Table Header (Row 7)
    headers = [
        "Roll Number",
        "Student Name",
        "Total Hours",
        "Present Hours",
        "Absent Hours",
        "OD Hours",
        "Attendance %",
        "Academic Status"
    ]
    ws1.append(headers)
    header_row_idx = 7

    for col_num, _ in enumerate(headers, 1):
        cell = ws1.cell(row=header_row_idx, column=col_num)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws1.row_dimensions[header_row_idx].height = 26

    # Populate Roster Rows
    start_row = 8
    sum_tot, sum_pres, sum_abs, sum_od = 0, 0, 0, 0

    if not students:
        empty_row = ["-", "No students currently enrolled for this academic year", 0, 0, 0, 0, "0.0%", "No Students"]
        ws1.append(empty_row)
        for c_idx in range(1, 9):
            cell = ws1.cell(row=start_row, column=c_idx)
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center", vertical="center")
    else:
        for s_idx, s in enumerate(students):
            row_num = start_row + s_idx
            s_recs = records_by_student.get(s.roll_no, [])
        tot_hrs = len(s_recs)
        pres_hrs = sum(1 for r in s_recs if r.status == AttendanceStatus.PRESENT)
        abs_hrs = sum(1 for r in s_recs if r.status == AttendanceStatus.ABSENT)
        od_hrs = sum(1 for r in s_recs if r.status == AttendanceStatus.OD)

        sum_tot += tot_hrs
        sum_pres += pres_hrs
        sum_abs += abs_hrs
        sum_od += od_hrs

        percentage = round(((pres_hrs + od_hrs) / tot_hrs) * 100.0, 1) if tot_hrs > 0 else 100.0
        status_text = "Shortage (<75%) 🚨" if percentage < 75.0 else "Satisfactory ✅"

        row_data = [
            s.roll_no,
            s.name,
            tot_hrs,
            pres_hrs,
            abs_hrs,
            od_hrs,
            f"{percentage}%",
            status_text
        ]
        ws1.append(row_data)

        # Style data cells
        is_even = s_idx % 2 == 1
        for c_idx in range(1, 9):
            cell = ws1.cell(row=row_num, column=c_idx)
            cell.border = thin_border
            if is_even:
                cell.fill = row_alt_fill
            if c_idx in [1, 3, 4, 5, 6, 7, 8]:
                cell.alignment = Alignment(horizontal="center", vertical="center")

            # Conditional formatting for Status
            if c_idx in [7, 8]:
                if percentage < 75.0:
                    cell.fill = shortage_fill
                    cell.font = shortage_font
                else:
                    cell.fill = satisfactory_fill
                    cell.font = satisfactory_font

    # Add CLASS SUMMARY TOTALS ROW
    tot_row_num = start_row + len(students)
    overall_pct = round(((sum_pres + sum_od) / sum_tot) * 100.0, 1) if sum_tot > 0 else 100.0
    summary_row = [
        "CLASS TOTALS / AVG",
        f"{len(students)} Students",
        sum_tot,
        sum_pres,
        sum_abs,
        sum_od,
        f"{overall_pct}%",
        "Satisfactory ✅" if overall_pct >= 75.0 else "Shortage 🚨"
    ]
    ws1.append(summary_row)

    for c_idx in range(1, 9):
        cell = ws1.cell(row=tot_row_num, column=c_idx)
        cell.font = summary_font
        cell.fill = summary_fill
        cell.border = thin_border
        if c_idx in [1, 3, 4, 5, 6, 7, 8]:
            cell.alignment = Alignment(horizontal="center", vertical="center")

    # Auto-fit Column Widths for Sheet 1
    for col in ws1.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws1.column_dimensions[col_letter].width = max(max_len + 4, 15)

    # ----------------------------------------------------
    # SHEET 2: DETAILED DATE-BY-DATE LOG
    # ----------------------------------------------------
    ws2 = wb.create_sheet(title="Detailed Attendance Log")
    ws2.views.sheetView[0].showGridLines = True

    log_headers = ["Date", "Period", "Roll Number", "Student Name", "Attendance Status", "Marked By Staff"]
    ws2.append(log_headers)

    for col_num, _ in enumerate(log_headers, 1):
        cell = ws2.cell(row=1, column=col_num)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    student_map = {s.roll_no: s.name for s in students}
    
    if not monthly_records:
        empty_log = ["-", "-", "-", "No daily attendance records recorded for this class", "-", "-"]
        ws2.append(empty_log)
        for c_idx in range(1, 7):
            cell = ws2.cell(row=2, column=c_idx)
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center", vertical="center")
    else:
        for r_idx, r in enumerate(monthly_records):
            row_n = r_idx + 2
            st_name = student_map.get(r.roll_no, "Student")
            st_text = r.status.value.upper() if hasattr(r.status, "value") else str(r.status).upper()
            
            staff_display = "-"
            if r.staff:
                staff_display = f"{r.staff.initials} ({r.staff.name})"
            elif r.staff_id:
                staff_display = str(r.staff_id)

            ws2.append([
                r.date.strftime("%Y-%m-%d"),
                f"Period P{r.hour_number}",
                r.roll_no,
                st_name,
                st_text,
                staff_display
            ])

            for c_idx in range(1, 7):
                cell = ws2.cell(row=row_n, column=c_idx)
                cell.border = thin_border
                cell.alignment = Alignment(horizontal="center", vertical="center")
                
                if c_idx == 5:
                    if st_text == "PRESENT":
                        cell.fill = satisfactory_fill
                        cell.font = satisfactory_font
                    elif st_text == "ABSENT":
                        cell.fill = shortage_fill
                        cell.font = shortage_font
                    elif st_text == "OD":
                        cell.fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
                        cell.font = Font(name="Segoe UI", size=10, bold=True, color="B45309")

    # Auto-fit Column Widths for Sheet 2
    for col in ws2.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws2.column_dimensions[col_letter].width = max(max_len + 4, 15)

    # Save to BytesIO stream
    file_stream = io.BytesIO()
    wb.save(file_stream)
    file_stream.seek(0)

    filename = f"Attendance_{dept.name.replace(' ', '_')}_Y{year}_{filename_suffix}.xlsx"
    return Response(
        content=file_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@router.get("/global-attendance-excel")
async def export_global_attendance_excel(
    department_id: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    export_type: Optional[str] = Query("all"),
    year_date: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    target_date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    report_format: Optional[str] = Query("comprehensive", description="'comprehensive' or 'daily_log'"),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Consolidated Institutional Multi-Sheet Excel Workbook Export:
    - Sheet 1: Executive Overview & Department Benchmarks
    - Sheet 2: Consolidated Student Attendance Roster & Shortages (<75%)
    - Sheet 3: Period-by-Period Daily Attendance Activity Logs
    - Sheet 4: Faculty Attribution Summary
    """
    if year is not None and year not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Academic year must be 1, 2, or 3. 4th year is not supported.")

    if department_id and department_id > 0:
        verify_department_access(department_id, ctx)
        d_res = await db.execute(select(Department).where(Department.id == department_id))
        departments = d_res.scalars().all()
        if not departments:
            raise HTTPException(status_code=404, detail="Department not found")
        scope_title = departments[0].name
    else:
        if ctx.role != UserRole.ADMIN and ctx.department_id:
            d_res = await db.execute(select(Department).where(Department.id == ctx.department_id))
            departments = d_res.scalars().all()
            scope_title = departments[0].name if departments else "Department"
        else:
            d_res = await db.execute(select(Department).order_by(Department.name))
            departments = d_res.scalars().all()
            scope_title = "All Departments (College-Wide)"

    dept_map = {d.id: d.name for d in departments}
    dept_ids = [d.id for d in departments]

    # Query students
    st_conds = [Student.department_id.in_(dept_ids)]
    year_label = "All Academic Years (1st, 2nd, 3rd)"
    if year and year in (1, 2, 3):
        st_conds.append(Student.year == year)
        year_label = f"Year {year}"

    st_res = await db.execute(select(Student).where(and_(*st_conds)).order_by(Student.department_id, Student.year, Student.roll_no))
    students = st_res.scalars().all()
    roll_numbers = [s.roll_no for s in students]
    student_map = {s.roll_no: s.name for s in students}
    student_dept_map = {s.roll_no: s.department_id for s in students}
    student_year_map = {s.roll_no: s.year for s in students}

    # Determine date filtering
    date_label = "All Recorded Dates"
    filename_suffix = "All_Time"
    rec_conds = []
    if roll_numbers:
        rec_conds.append(AttendanceRecord.roll_no.in_(roll_numbers))

    if export_type == "yearly" and year_date:
        rec_conds.append(extract('year', AttendanceRecord.date) == year_date)
        date_label = f"Full Academic Year: {year_date}"
        filename_suffix = f"FullYear_{year_date}"
    elif export_type == "monthly" and year_date and month:
        if month < 1 or month > 12:
            month = 1
        rec_conds.append(extract('year', AttendanceRecord.date) == year_date)
        rec_conds.append(extract('month', AttendanceRecord.date) == month)
        m_name = calendar.month_name[month]
        date_label = f"Month: {m_name} {year_date}"
        filename_suffix = f"{m_name[:3]}_{year_date}"
    elif export_type == "daily" and target_date:
        try:
            parsed_d = date.fromisoformat(target_date)
            rec_conds.append(AttendanceRecord.date == parsed_d)
            date_label = f"Day: {parsed_d.strftime('%b %d, %Y')}"
            filename_suffix = f"Day_{parsed_d}"
        except ValueError:
            pass
    elif export_type == "custom" and start_date and end_date:
        try:
            parsed_start = date.fromisoformat(start_date)
            parsed_end = date.fromisoformat(end_date)
            rec_conds.append(AttendanceRecord.date >= parsed_start)
            rec_conds.append(AttendanceRecord.date <= parsed_end)
            date_label = f"Custom Range: {parsed_start} to {parsed_end}"
            filename_suffix = f"Range_{parsed_start}_to_{parsed_end}"
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    all_records = []
    if roll_numbers:
        rec_res = await db.execute(
            select(AttendanceRecord)
            .options(selectinload(AttendanceRecord.staff))
            .where(and_(*rec_conds))
            .order_by(AttendanceRecord.date.desc(), AttendanceRecord.hour_number.asc(), AttendanceRecord.roll_no.asc())
        )
        all_records = rec_res.scalars().all()

    if report_format == "daily_log":
        return generate_daily_attendance_log_workbook(
            all_records=all_records,
            students=students,
            dept_map=dept_map,
            scope_title=scope_title,
            year_label=year_label,
            date_label=date_label,
            filename_suffix=filename_suffix
        )

    # Map records to student
    records_by_student = {rn: [] for rn in roll_numbers}
    staff_hours = {}

    for r in all_records:
        if r.roll_no in records_by_student:
            records_by_student[r.roll_no].append(r)
        if r.staff:
            staff_name = r.staff.name
            staff_init = r.staff.initials
            key = (r.staff_id, staff_name, staff_init)
            staff_hours[key] = staff_hours.get(key, 0) + 1

    # Student stats
    student_stats = []
    total_pres_overall = 0
    total_abs_overall = 0
    total_od_overall = 0
    shortage_count_overall = 0

    for s in students:
        s_recs = records_by_student.get(s.roll_no, [])
        conducted = len(s_recs)
        pres = sum(1 for r in s_recs if r.status == AttendanceStatus.PRESENT)
        ab = sum(1 for r in s_recs if r.status == AttendanceStatus.ABSENT)
        od = sum(1 for r in s_recs if r.status == AttendanceStatus.OD)

        total_pres_overall += pres
        total_abs_overall += ab
        total_od_overall += od

        pct = round(((pres + od) / conducted) * 100.0, 1) if conducted > 0 else 0.0
        shortage = pct < 75.0 if conducted > 0 else False
        if shortage:
            shortage_count_overall += 1

        student_stats.append({
            "roll_no": s.roll_no,
            "name": s.name,
            "dept_id": s.department_id,
            "dept_name": dept_map.get(s.department_id, f"Dept #{s.department_id}"),
            "year": s.year,
            "conducted": conducted,
            "present": pres,
            "absent": ab,
            "od": od,
            "percentage": pct,
            "shortage": shortage
        })

    # Department benchmarks
    dept_benchmarks = []
    for d in departments:
        d_students = [st for st in student_stats if st["dept_id"] == d.id]
        d_st_count = len(d_students)
        d_conducted = sum(st["conducted"] for st in d_students)
        d_pres = sum(st["present"] for st in d_students)
        d_abs = sum(st["absent"] for st in d_students)
        d_od = sum(st["od"] for st in d_students)
        d_pct = round(((d_pres + d_od) / d_conducted) * 100.0, 1) if d_conducted > 0 else 0.0
        d_short = sum(1 for st in d_students if st["shortage"])
        dept_benchmarks.append({
            "id": d.id,
            "name": d.name,
            "students": d_st_count,
            "conducted": d_conducted,
            "present": d_pres,
            "absent": d_abs,
            "od": d_od,
            "percentage": d_pct,
            "shortage": d_short
        })

    # Year benchmarks
    year_benchmarks = []
    for yr in (1, 2, 3):
        y_students = [st for st in student_stats if st["year"] == yr]
        y_count = len(y_students)
        y_cond = sum(st["conducted"] for st in y_students)
        y_pres = sum(st["present"] for st in y_students)
        y_abs = sum(st["absent"] for st in y_students)
        y_od = sum(st["od"] for st in y_students)
        y_pct = round(((y_pres + y_od) / y_cond) * 100.0, 1) if y_cond > 0 else 0.0
        year_benchmarks.append({
            "year": yr,
            "students": y_count,
            "conducted": y_cond,
            "present": y_pres,
            "absent": y_abs,
            "od": y_od,
            "percentage": y_pct
        })

    total_records_count = len(all_records)
    overall_percentage = round(((total_pres_overall + total_od_overall) / total_records_count) * 100.0, 1) if total_records_count > 0 else 0.0

    # Build openpyxl workbook
    wb = openpyxl.Workbook()

    # Reusable Styles
    navy_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_white_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Segoe UI", size=16, bold=True, color="1E3A8A")
    subtitle_font = Font(name="Segoe UI", size=10, italic=True, color="475569")
    meta_font = Font(name="Segoe UI", size=9, bold=True, color="334155")
    section_font = Font(name="Segoe UI", size=12, bold=True, color="1E3A8A")
    regular_font = Font(name="Segoe UI", size=10, color="0F172A")
    bold_regular_font = Font(name="Segoe UI", size=10, bold=True, color="0F172A")

    kpi_val_font = Font(name="Segoe UI", size=16, bold=True, color="1E3A8A")
    kpi_lbl_font = Font(name="Segoe UI", size=9, bold=True, color="64748B")
    kpi_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

    green_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    green_font = Font(name="Segoe UI", size=10, bold=True, color="166534")
    red_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    red_font = Font(name="Segoe UI", size=10, bold=True, color="991B1B")
    amber_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    amber_font = Font(name="Segoe UI", size=10, bold=True, color="B45309")

    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1")
    )

    # ----------------------------------------------------
    # SHEET 1: EXECUTIVE DASHBOARD
    # ----------------------------------------------------
    ws1 = wb.active
    ws1.title = "Executive Summary"
    ws1.views.sheetView[0].showGridLines = True

    # Title Block
    ws1.cell(row=1, column=1, value="ARIGNAR ANNA COLLEGE — ATTENDANCE MANAGEMENT SYSTEM").font = title_font
    ws1.cell(row=2, column=1, value="Institutional Attendance Intelligence & Performance Dashboard").font = subtitle_font
    ws1.cell(row=3, column=1, value=f"Scope: {scope_title} | Class Year: {year_label} | Timeframe: {date_label} | Generated: {date.today().strftime('%b %d, %Y')}").font = meta_font

    # KPI Metric Cards (Row 5 & 6)
    kpis = [
        ("OVERALL ATTENDANCE", f"{overall_percentage}%"),
        ("TOTAL ENROLLED STUDENTS", f"{len(students)} Students"),
        ("TOTAL HOURS CONDUCTED", f"{total_records_count} Records"),
        ("SHORTAGE STUDENTS (<75%)", f"{shortage_count_overall} Students")
    ]
    for idx, (lbl, val) in enumerate(kpis):
        start_col = idx * 2 + 1
        end_col = start_col + 1
        ws1.merge_cells(start_row=5, start_column=start_col, end_row=5, end_column=end_col)
        ws1.merge_cells(start_row=6, start_column=start_col, end_row=6, end_column=end_col)

        c_lbl = ws1.cell(row=5, column=start_col, value=lbl)
        c_lbl.font = kpi_lbl_font
        c_lbl.alignment = Alignment(horizontal="center", vertical="center")
        c_lbl.fill = kpi_fill

        c_val = ws1.cell(row=6, column=start_col, value=val)
        c_val.font = kpi_val_font
        c_val.alignment = Alignment(horizontal="center", vertical="center")
        c_val.fill = kpi_fill

        for r_num in (5, 6):
            for c_num in (start_col, end_col):
                ws1.cell(row=r_num, column=c_num).border = thin_border

    # Department Benchmark Table
    row_cursor = 8
    ws1.cell(row=row_cursor, column=1, value="DEPARTMENT ATTENDANCE BENCHMARK").font = section_font
    row_cursor += 1

    dept_headers = ["Dept ID", "Department Name", "Students", "Hours Logged", "Present", "Absent", "OD", "Attendance %", "Shortage Count"]
    for c_idx, h in enumerate(dept_headers, 1):
        cell = ws1.cell(row=row_cursor, column=c_idx, value=h)
        cell.font = header_white_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
    row_cursor += 1

    for d in dept_benchmarks:
        ws1.cell(row=row_cursor, column=1, value=f"#{d['id']}").alignment = Alignment(horizontal="center")
        ws1.cell(row=row_cursor, column=2, value=d['name']).font = bold_regular_font
        ws1.cell(row=row_cursor, column=3, value=d['students']).alignment = Alignment(horizontal="center")
        ws1.cell(row=row_cursor, column=4, value=d['conducted']).alignment = Alignment(horizontal="center")
        ws1.cell(row=row_cursor, column=5, value=d['present']).alignment = Alignment(horizontal="center")
        ws1.cell(row=row_cursor, column=6, value=d['absent']).alignment = Alignment(horizontal="center")
        ws1.cell(row=row_cursor, column=7, value=d['od']).alignment = Alignment(horizontal="center")
        
        pct_cell = ws1.cell(row=row_cursor, column=8, value=f"{d['percentage']}%")
        pct_cell.alignment = Alignment(horizontal="center")
        pct_cell.font = green_font if d['percentage'] >= 75.0 else red_font
        pct_cell.fill = green_fill if d['percentage'] >= 75.0 else red_fill

        short_cell = ws1.cell(row=row_cursor, column=9, value=d['shortage'])
        short_cell.alignment = Alignment(horizontal="center")
        if d['shortage'] > 0:
            short_cell.font = red_font

        for c_idx in range(1, len(dept_headers) + 1):
            c = ws1.cell(row=row_cursor, column=c_idx)
            c.border = thin_border
            if not c.font or c.font == Font():
                c.font = regular_font
        row_cursor += 1

    # Class Year Breakdown Table
    row_cursor += 1
    ws1.cell(row=row_cursor, column=1, value="CLASS YEAR ATTENDANCE BENCHMARK").font = section_font
    row_cursor += 1

    yr_headers = ["Academic Class", "Total Students", "Hours Conducted", "Present Hours", "Absent Hours", "OD Hours", "Overall Attendance %"]
    for c_idx, h in enumerate(yr_headers, 1):
        cell = ws1.cell(row=row_cursor, column=c_idx, value=h)
        cell.font = header_white_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
    row_cursor += 1

    for y in year_benchmarks:
        y_name = "1st Year (Junior)" if y['year'] == 1 else "2nd Year (Mid)" if y['year'] == 2 else "3rd Year (Senior)"
        ws1.cell(row=row_cursor, column=1, value=y_name).font = bold_regular_font
        ws1.cell(row=row_cursor, column=2, value=y['students']).alignment = Alignment(horizontal="center")
        ws1.cell(row=row_cursor, column=3, value=y['conducted']).alignment = Alignment(horizontal="center")
        ws1.cell(row=row_cursor, column=4, value=y['present']).alignment = Alignment(horizontal="center")
        ws1.cell(row=row_cursor, column=5, value=y['absent']).alignment = Alignment(horizontal="center")
        ws1.cell(row=row_cursor, column=6, value=y['od']).alignment = Alignment(horizontal="center")

        pct_c = ws1.cell(row=row_cursor, column=7, value=f"{y['percentage']}%")
        pct_c.alignment = Alignment(horizontal="center")
        pct_c.font = green_font if y['percentage'] >= 75.0 else red_font
        pct_c.fill = green_fill if y['percentage'] >= 75.0 else red_fill

        for c_idx in range(1, len(yr_headers) + 1):
            c = ws1.cell(row=row_cursor, column=c_idx)
            c.border = thin_border
            if not c.font or c.font == Font():
                c.font = regular_font
        row_cursor += 1

    for col in ws1.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws1.column_dimensions[col_letter].width = max(max_len + 3, 14)

    # ----------------------------------------------------
    # SHEET 2: CONSOLIDATED STUDENT ROSTER & SHORTAGES
    # ----------------------------------------------------
    ws2 = wb.create_sheet(title="Student Roster & Shortages")
    ws2.views.sheetView[0].showGridLines = True

    roster_headers = [
        "Roll Number", "Student Name", "Department", "Class Year",
        "Total Hours", "Present Hours", "Absent Hours", "OD Hours",
        "Attendance %", "Compliance Status"
    ]
    for c_idx, h in enumerate(roster_headers, 1):
        cell = ws2.cell(row=1, column=c_idx, value=h)
        cell.font = header_white_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    ws2.row_dimensions[1].height = 25

    if not student_stats:
        empty_row = ["-", "No students currently enrolled for the selected criteria", "-", "-", 0, 0, 0, 0, "0.0%", "NO STUDENTS"]
        for c_idx, val in enumerate(empty_row, 1):
            cell = ws2.cell(row=2, column=c_idx, value=val)
            cell.font = regular_font
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center", vertical="center")
    else:
        for r_idx, st in enumerate(student_stats, 2):
            ws2.cell(row=r_idx, column=1, value=st["roll_no"]).font = bold_regular_font
            ws2.cell(row=r_idx, column=2, value=st["name"]).font = regular_font
            ws2.cell(row=r_idx, column=3, value=st["dept_name"]).font = regular_font
            ws2.cell(row=r_idx, column=4, value=f"Year {st['year']}").alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=5, value=st["conducted"]).alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=6, value=st["present"]).alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=7, value=st["absent"]).alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=8, value=st["od"]).alignment = Alignment(horizontal="center")

            p_cell = ws2.cell(row=r_idx, column=9, value=f"{st['percentage']}%")
            p_cell.alignment = Alignment(horizontal="center")
            p_cell.font = red_font if st["shortage"] else green_font
            p_cell.fill = red_fill if st["shortage"] else green_fill

            status_label = "ATTENDANCE SHORTAGE (<75%)" if st["shortage"] else "SATISFACTORY"
            s_cell = ws2.cell(row=r_idx, column=10, value=status_label)
            s_cell.alignment = Alignment(horizontal="center")
            s_cell.font = red_font if st["shortage"] else green_font
            s_cell.fill = red_fill if st["shortage"] else green_fill

            for c_idx in range(1, 11):
                ws2.cell(row=r_idx, column=c_idx).border = thin_border

    for col in ws2.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws2.column_dimensions[col_letter].width = max(max_len + 4, 15)

    # ----------------------------------------------------
    # SHEET 3: PERIOD ATTENDANCE LOGS
    # ----------------------------------------------------
    ws3 = wb.create_sheet(title="Daily Attendance Records")
    ws3.views.sheetView[0].showGridLines = True

    log_headers = [
        "Date", "Period", "Department", "Class Year", "Roll Number",
        "Student Name", "Attendance Status", "Marked By Faculty"
    ]
    for c_idx, h in enumerate(log_headers, 1):
        cell = ws3.cell(row=1, column=c_idx, value=h)
        cell.font = header_white_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    ws3.row_dimensions[1].height = 25

    if not all_records:
        empty_log = ["-", "-", "-", "-", "-", "No attendance records recorded for this selection", "-", "-"]
        for c_idx, val in enumerate(empty_log, 1):
            cell = ws3.cell(row=2, column=c_idx, value=val)
            cell.font = regular_font
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center", vertical="center")
    else:
        for r_idx, r in enumerate(all_records, 2):
            st_name = student_map.get(r.roll_no, "Student")
            dept_n = dept_map.get(student_dept_map.get(r.roll_no, 0), "")
            yr = student_year_map.get(r.roll_no, "-")
            st_text = r.status.value.upper() if hasattr(r.status, "value") else str(r.status).upper()

            staff_str = "-"
            if r.staff:
                staff_str = f"{r.staff.initials} ({r.staff.name})"
            elif r.staff_id:
                staff_str = str(r.staff_id)

            ws3.cell(row=r_idx, column=1, value=r.date.strftime("%Y-%m-%d")).alignment = Alignment(horizontal="center")
            ws3.cell(row=r_idx, column=2, value=f"Period P{r.hour_number}").alignment = Alignment(horizontal="center")
            ws3.cell(row=r_idx, column=3, value=dept_n)
            ws3.cell(row=r_idx, column=4, value=f"Year {yr}").alignment = Alignment(horizontal="center")
            ws3.cell(row=r_idx, column=5, value=r.roll_no).font = bold_regular_font
            ws3.cell(row=r_idx, column=6, value=st_name)

            status_cell = ws3.cell(row=r_idx, column=7, value=st_text)
            status_cell.alignment = Alignment(horizontal="center")
            if st_text == "PRESENT":
                status_cell.fill = green_fill
                status_cell.font = green_font
            elif st_text == "ABSENT":
                status_cell.fill = red_fill
                status_cell.font = red_font
            elif st_text == "OD":
                status_cell.fill = amber_fill
                status_cell.font = amber_font

            ws3.cell(row=r_idx, column=8, value=staff_str)

            for c_idx in range(1, 9):
                ws3.cell(row=r_idx, column=c_idx).border = thin_border

    for col in ws3.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws3.column_dimensions[col_letter].width = max(max_len + 4, 15)

    # ----------------------------------------------------
    # SHEET 4: FACULTY ATTRIBUTION SUMMARY
    # ----------------------------------------------------
    ws4 = wb.create_sheet(title="Faculty Activity Summary")
    ws4.views.sheetView[0].showGridLines = True

    faculty_headers = ["Faculty Name", "Initials", "Total Periods Logged"]
    for c_idx, h in enumerate(faculty_headers, 1):
        cell = ws4.cell(row=1, column=c_idx, value=h)
        cell.font = header_white_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    if not staff_hours:
        empty_fac = ["No faculty teaching activity logged for this selection", "-", 0]
        for c_idx, val in enumerate(empty_fac, 1):
            cell = ws4.cell(row=2, column=c_idx, value=val)
            cell.font = regular_font
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center", vertical="center")
    else:
        sorted_staff = sorted(staff_hours.items(), key=lambda x: x[1], reverse=True)
        for r_idx, ((_, s_name, s_init), hours_count) in enumerate(sorted_staff, 2):
            ws4.cell(row=r_idx, column=1, value=s_name).font = bold_regular_font
            ws4.cell(row=r_idx, column=2, value=s_init).alignment = Alignment(horizontal="center")
            ws4.cell(row=r_idx, column=3, value=hours_count).alignment = Alignment(horizontal="center")
            for c_idx in range(1, 4):
                ws4.cell(row=r_idx, column=c_idx).border = thin_border

    for col in ws4.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws4.column_dimensions[col_letter].width = max(max_len + 4, 16)

    # Save to BytesIO stream
    file_stream = io.BytesIO()
    wb.save(file_stream)
    file_stream.seek(0)

    scope_slug = scope_title.replace(' ', '_').replace('(', '').replace(')', '')
    filename = f"Global_Attendance_{scope_slug}_{filename_suffix}.xlsx"
    return Response(
        content=file_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/daily-attendance-log-excel")
async def export_daily_attendance_log_excel(
    department_id: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    export_type: Optional[str] = Query("all"),
    year_date: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    target_date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Dedicated endpoint for Daily Attendance View Excel Report (matching Dashboard Attendance Table format):
    - Sheet 1: Daily Attendance View (Date, Roll No, Student Name, Dept, Year, Periods 1-5, Day Total, %, Status, Staff)
    - Sheet 2: Faculty Session Log (Date, Period, Department, Year, Staff, Student counts, Session %)
    """
    return await export_global_attendance_excel(
        department_id=department_id,
        year=year,
        export_type=export_type,
        year_date=year_date,
        month=month,
        target_date=target_date,
        start_date=start_date,
        end_date=end_date,
        report_format="daily_log",
        ctx=ctx,
        db=db
    )



