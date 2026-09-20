from datetime import date
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict, Field
from app.models import UserRole, AttendanceStatus, DayType

# Department Schemas
class DepartmentBase(BaseModel):
    name: str

class DepartmentCreate(DepartmentBase):
    account_username: Optional[str] = None
    account_password: Optional[str] = None

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    account_username: Optional[str] = None
    account_password: Optional[str] = None

class DepartmentOut(DepartmentBase):
    id: int
    account_username: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# User / Staff Schemas
class UserBase(BaseModel):
    username: str
    role: UserRole
    department_id: Optional[int] = None

class UserCreate(UserBase):
    password: Optional[str] = None
    pin: Optional[str] = None

class StaffCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Staff actual full name")
    initials: str = Field(..., min_length=2, max_length=5, description="Staff unique initials (2 to 5 letters)")
    username: str = Field(..., min_length=2, max_length=50, description="Staff username")
    password: str
    pin: str = Field(..., min_length=4, max_length=6, description="4-digit terminal PIN")
    department_id: int
    additional_department_ids: Optional[List[int]] = Field(default_factory=list)

class StaffUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    initials: Optional[str] = Field(None, min_length=2, max_length=5)
    username: Optional[str] = Field(None, min_length=2, max_length=50)
    password: Optional[str] = None
    pin: Optional[str] = None
    department_id: Optional[int] = None
    additional_department_ids: Optional[List[int]] = None

class StaffOut(BaseModel):
    id: int
    name: str
    initials: str
    username: str
    department_id: int
    department_name: Optional[str] = None
    additional_department_ids: List[int] = Field(default_factory=list)
    additional_departments: List[str] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)

# Compatibility aliases
StaffUserCreate = StaffCreate
StaffUserUpdate = StaffUpdate

class UserOut(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class StaffDropdownOut(BaseModel):
    id: int
    name: Optional[str] = None
    initials: Optional[str] = None
    username: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# Student Schemas
class StudentBase(BaseModel):
    roll_no: str
    name: str
    year: int = Field(..., ge=1, le=3)
    department_id: int

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    year: Optional[int] = Field(None, ge=1, le=3)
    department_id: Optional[int] = None

class StudentOut(StudentBase):
    model_config = ConfigDict(from_attributes=True)

# Attendance Schemas
class AttendanceItem(BaseModel):
    roll_no: str
    status: AttendanceStatus

class AttendanceSubmitRequest(BaseModel):
    date: date
    hour_number: int = Field(..., ge=1, le=5)
    records: List[AttendanceItem]

class AttendanceRecordOut(BaseModel):
    id: int
    date: date
    hour_number: int
    roll_no: str
    status: AttendanceStatus
    staff_id: int
    model_config = ConfigDict(from_attributes=True)

class StudentGridItem(BaseModel):
    roll_no: str
    name: str
    year: int
    statuses: Dict[int, Optional[AttendanceStatus]]  # period (1-5) -> status

class PeriodStaffInfo(BaseModel):
    staff_id: int
    name: str
    initials: str

class ClassGridResponse(BaseModel):
    date: date
    department_id: int
    year: int
    students: List[StudentGridItem]
    period_staff: Dict[int, Optional[PeriodStaffInfo]] = Field(default_factory=dict)
    day_type: str = "full_day"
    active_periods: List[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5])
    day_description: Optional[str] = None

# Auth Schemas
class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: int
    username: str
    department_id: Optional[int] = None

class KioskUnlockRequest(BaseModel):
    staff_id: int
    pin: str
    hour_number: int = Field(..., ge=1, le=5)

class KioskUnlockResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    staff_id: int
    staff_username: str
    unlocked_hour: int
    expires_in_minutes: int

class StaffPublicOut(BaseModel):
    id: int
    name: Optional[str] = None
    initials: Optional[str] = None
    username: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class DepartmentOption(BaseModel):
    id: int
    name: str
    is_primary: bool = False

class DirectKioskUnlockRequest(BaseModel):
    staff_id: Optional[int] = None
    username: Optional[str] = None
    initials: Optional[str] = None
    pin: str
    hour_number: Optional[int] = Field(default=1, ge=1, le=5)
    department_id: Optional[int] = None

class DirectKioskUnlockResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    staff_id: int
    staff_username: str
    staff_name: str
    staff_initials: str
    department_id: int
    department_name: str
    departments: List[DepartmentOption] = Field(default_factory=list)
    unlocked_hour: int
    expires_in_minutes: int = 15

class KioskSelectDepartmentRequest(BaseModel):
    staff_id: int
    department_id: int
    hour_number: Optional[int] = Field(default=1, ge=1, le=5)

class KioskSelectDepartmentResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    staff_id: int
    staff_username: str
    staff_name: str
    staff_initials: str
    department_id: int
    department_name: str
    departments: List[DepartmentOption] = Field(default_factory=list)
    unlocked_hour: int
    expires_in_minutes: int = 15

class StudentAnalyticsItem(BaseModel):
    roll_no: str
    name: str
    year: int
    department_id: int
    department_name: Optional[str] = None
    total_hours_conducted: int
    present_hours: int
    absent_hours: int
    od_hours: int
    attendance_percentage: float
    has_shortage: bool

class AttendanceLogEntry(BaseModel):
    id: int
    date: date
    hour_number: int
    roll_no: str
    student_name: str
    department_name: Optional[str] = None
    status: AttendanceStatus
    staff_id: Optional[int] = None
    staff_name: Optional[str] = None
    staff_initials: Optional[str] = None

class DepartmentBenchmarkItem(BaseModel):
    department_id: int
    department_name: str
    department_code: Optional[str] = None
    total_students: int
    total_records: int
    present_records: int
    absent_records: int
    od_records: int
    attendance_percentage: float
    shortage_students_count: int
    total_hours_conducted: int = 0
    shortage_count: int = 0

class YearBenchmarkItem(BaseModel):
    year: int
    year_label: Optional[str] = None
    total_students: int
    total_records: int
    present_records: int
    absent_records: int
    od_records: int = 0
    attendance_percentage: float
    total_hours_conducted: int = 0
    shortage_count: int = 0

class AttendanceSummaryResponse(BaseModel):
    department_id: Optional[int] = None
    department_name: str = "All Departments"
    year: Optional[int] = None
    filter_type: str = "all"
    filter_label: str = "All Days & Years"
    total_students: int
    total_hours_in_period: int = 0
    today_present: int
    today_absent: int
    period_present: int = 0
    period_absent: int = 0
    class_average_percentage: float
    shortage_students_count: int
    shortage_students: List[StudentAnalyticsItem]
    all_students: List[StudentAnalyticsItem]
    daily_logs: List[AttendanceLogEntry] = []

class GlobalOverviewResponse(BaseModel):
    filter_type: str = "all"
    filter_label: str = "All Days & Years"
    total_departments: int
    total_students: int
    total_records: int
    total_sessions_conducted: int
    total_hours_conducted: int = 0
    today_present: int
    today_absent: int
    today_od: int = 0
    overall_attendance_percentage: float
    overall_percentage: Optional[float] = None
    total_shortage_count: int
    shortage_count: Optional[int] = None
    departments: List[DepartmentBenchmarkItem] = []
    department_benchmarks: List[DepartmentBenchmarkItem] = []
    year_benchmarks: List[YearBenchmarkItem] = []
    shortage_students: List[StudentAnalyticsItem] = []
    recent_logs: List[AttendanceLogEntry] = []

# Staff Personal History Schemas
class StaffDepartmentSummary(BaseModel):
    department_id: int
    department_name: str
    classes_conducted: int
    records_logged: int
    attendance_percentage: float
    present_count: int
    absent_count: int
    od_count: int

class StaffHistoryRecord(BaseModel):
    id: int
    date: date
    hour_number: int
    roll_no: str
    student_name: str
    status: AttendanceStatus
    department_id: int
    department_name: str
    year: int

class StaffHistoryResponse(BaseModel):
    staff_id: int
    staff_username: str
    staff_name: Optional[str] = None
    staff_initials: Optional[str] = None
    primary_department_name: Optional[str] = None
    selected_department_id: Optional[int] = None
    total_classes_conducted: int
    total_records_logged: int
    average_attendance_percentage: float
    filter_type: str = "all"
    filter_label: str = "All Days & Years"
    available_years: List[int] = []
    departments: List[StaffDepartmentSummary] = []
    records: List[StaffHistoryRecord]

# Calendar & Academic Schedule Schemas
class CalendarOverrideCreate(BaseModel):
    date: date
    day_type: DayType
    active_periods: Optional[List[int]] = None
    description: Optional[str] = None

class CalendarOverrideOut(BaseModel):
    date: date
    day_type: DayType
    active_periods: List[int]
    description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CalendarStatusResponse(BaseModel):
    date: date
    day_type: str
    active_periods: List[int]
    description: Optional[str] = None
    is_holiday: bool = False
    is_half_day: bool = False
