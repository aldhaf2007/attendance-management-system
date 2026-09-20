import enum
from datetime import date
from typing import Optional, List
from sqlalchemy import String, Integer, ForeignKey, Date, Enum as SQLEnum, UniqueConstraint, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class DayType(str, enum.Enum):
    FULL_DAY = "full_day"
    HALF_DAY = "half_day"
    HOLIDAY = "holiday"

class UserRole(str, enum.Enum):
    ADMIN = "Admin"
    DEPARTMENT = "Department"
    STAFF = "Staff"

class AttendanceStatus(str, enum.Enum):
    PRESENT = "Present"
    ABSENT = "Absent"
    OD = "OD"

class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)

    users: Mapped[List["User"]] = relationship("User", back_populates="department", cascade="all, delete-orphan")
    students: Mapped[List["Student"]] = relationship("Student", back_populates="department", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    pin_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole), nullable=False, default=UserRole.STAFF)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)

    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="users")
    staff_profile: Mapped[Optional["Staff"]] = relationship("Staff", back_populates="user", uselist=False, cascade="all, delete-orphan")

class Staff(Base):
    __tablename__ = "staffs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    initials: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    pin_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("staff_departments.id", ondelete="SET NULL"), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    staff_department: Mapped[Optional["StaffDepartment"]] = relationship("StaffDepartment", foreign_keys=[department_id], cascade="all, delete-orphan", single_parent=True)
    user: Mapped[Optional["User"]] = relationship("User", back_populates="staff_profile")
    attendance_records: Mapped[List["AttendanceRecord"]] = relationship("AttendanceRecord", back_populates="staff", cascade="all, delete-orphan")

    @property
    def primary_department_id(self) -> Optional[int]:
        sd = self.__dict__.get("staff_department")
        if sd is None:
            try:
                sd = getattr(self, "staff_department", None)
            except Exception:
                sd = None
        if sd:
            return sd.department_1_id
        return None

    @property
    def primary_department(self) -> Optional["Department"]:
        sd = self.__dict__.get("staff_department")
        if sd is None:
            try:
                sd = getattr(self, "staff_department", None)
            except Exception:
                sd = None
        if sd and sd.dept_1:
            return sd.dept_1
        return None

    @property
    def department(self) -> Optional["Department"]:
        return self.primary_department

    @property
    def all_department_ids(self) -> List[int]:
        res = []
        sd = self.__dict__.get("staff_department")
        if sd is None:
            try:
                sd = getattr(self, "staff_department", None)
            except Exception:
                sd = None

        if sd:
            slots = [
                sd.department_1_id, sd.department_2_id, sd.department_3_id,
                sd.department_4_id, sd.department_5_id, sd.department_6_id,
                sd.department_7_id, sd.department_8_id, sd.department_9_id
            ]
            for did in slots:
                if did is not None:
                    try:
                        num = int(did)
                        if num not in res and num > 0:
                            res.append(num)
                    except (ValueError, TypeError):
                        pass
        return res

class StaffDepartment(Base):
    __tablename__ = "staff_departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    
    department_1_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    department_2_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    department_3_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    department_4_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    department_5_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    department_6_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    department_7_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    department_8_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    department_9_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)

    dept_1: Mapped[Optional["Department"]] = relationship("Department", foreign_keys=[department_1_id])
    dept_2: Mapped[Optional["Department"]] = relationship("Department", foreign_keys=[department_2_id])
    dept_3: Mapped[Optional["Department"]] = relationship("Department", foreign_keys=[department_3_id])
    dept_4: Mapped[Optional["Department"]] = relationship("Department", foreign_keys=[department_4_id])
    dept_5: Mapped[Optional["Department"]] = relationship("Department", foreign_keys=[department_5_id])
    dept_6: Mapped[Optional["Department"]] = relationship("Department", foreign_keys=[department_6_id])
    dept_7: Mapped[Optional["Department"]] = relationship("Department", foreign_keys=[department_7_id])
    dept_8: Mapped[Optional["Department"]] = relationship("Department", foreign_keys=[department_8_id])
    dept_9: Mapped[Optional["Department"]] = relationship("Department", foreign_keys=[department_9_id])

class Student(Base):
    __tablename__ = "students"

    roll_no: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, 3
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)

    department: Mapped["Department"] = relationship("Department", back_populates="students")
    attendance_records: Mapped[List["AttendanceRecord"]] = relationship("AttendanceRecord", back_populates="student", cascade="all, delete-orphan")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    hour_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    roll_no: Mapped[str] = mapped_column(ForeignKey("students.roll_no"), nullable=False, index=True)
    status: Mapped[AttendanceStatus] = mapped_column(SQLEnum(AttendanceStatus), nullable=False)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staffs.id"), nullable=False)

    student: Mapped["Student"] = relationship("Student", back_populates="attendance_records")
    staff: Mapped["Staff"] = relationship("Staff", back_populates="attendance_records")

    __table_args__ = (
        UniqueConstraint("date", "hour_number", "roll_no", name="uq_attendance_date_hour_roll"),
    )

class CalendarOverride(Base):
    __tablename__ = "calendar_overrides"

    date: Mapped[date] = mapped_column(Date, primary_key=True, index=True)
    day_type: Mapped[DayType] = mapped_column(SQLEnum(DayType), nullable=False, default=DayType.FULL_DAY)
    active_periods: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
