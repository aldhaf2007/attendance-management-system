import asyncio
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import AsyncSessionLocal, engine, Base
from app.models import Department, User, UserRole, Student, Staff, AttendanceRecord, AttendanceStatus, CalendarOverride, DayType
from app.security import get_password_hash, get_pin_hash

async def seed():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with AsyncSessionLocal() as session:
            # Check existing departments
            res = await session.execute(select(Department))
            if res.scalars().first():
                print("Database already seeded.")
                return

            print("Seeding database for 3-Level RBAC with separate Staffs table...")
            # 1. Departments
            cs = Department(name="Computer Science")
            comm = Department(name="Commerce")
            session.add_all([cs, comm])
            await session.flush()

            # 2. Users (Level 1 Admin, Level 2 Department Terminals, Level 3 Staff)
            async def get_or_create_user(username, password, role, department_id=None, pin=None):
                q = await session.execute(select(User).where(User.username == username))
                existing = q.scalars().first()
                if existing:
                    return existing
                u = User(
                    username=username,
                    password_hash=get_password_hash(password),
                    pin_hash=get_pin_hash(pin) if pin else None,
                    role=role,
                    department_id=department_id
                )
                session.add(u)
                await session.flush()
                return u

            admin = await get_or_create_user("admin", "admin123", UserRole.ADMIN)
            cs_terminal = await get_or_create_user("cs_department", "dept123", UserRole.DEPARTMENT, department_id=cs.id)
            comm_terminal = await get_or_create_user("comm_department", "dept123", UserRole.DEPARTMENT, department_id=comm.id)
            
            prof_cs1 = await get_or_create_user("prof_smith", "staff123", UserRole.STAFF, department_id=cs.id, pin="1234")
            prof_cs2 = await get_or_create_user("prof_davis", "staff123", UserRole.STAFF, department_id=cs.id, pin="4321")
            prof_comm = await get_or_create_user("prof_johnson", "staff123", UserRole.STAFF, department_id=comm.id, pin="5678")

            # 2.1 Staff Records (mirroring Student table, with initials and actual name)
            staff_members = [
                Staff(
                    name="Dr. John Smith",
                    initials="JS",
                    username="prof_smith",
                    password_hash=prof_cs1.password_hash,
                    pin_hash=prof_cs1.pin_hash,
                    department_id=cs.id,
                    additional_department_ids=[comm.id],
                    user_id=prof_cs1.id
                ),
                Staff(
                    name="Prof. Sarah Davis",
                    initials="SD",
                    username="prof_davis",
                    password_hash=prof_cs2.password_hash,
                    pin_hash=prof_cs2.pin_hash,
                    department_id=cs.id,
                    user_id=prof_cs2.id
                ),
                Staff(
                    name="Dr. Alex Johnson",
                    initials="AJ",
                    username="prof_johnson",
                    password_hash=prof_comm.password_hash,
                    pin_hash=prof_comm.pin_hash,
                    department_id=comm.id,
                    user_id=prof_comm.id
                )
            ]
            session.add_all(staff_members)
            await session.flush()

            # 3. Students
            students = [
                Student(roll_no="22CS001", name="Alex Vance", year=2, department_id=cs.id),
                Student(roll_no="22CS002", name="Brian Cox", year=2, department_id=cs.id),
                Student(roll_no="22CS003", name="Catherine Doe", year=2, department_id=cs.id),
                Student(roll_no="22CS004", name="Daniel Ray", year=2, department_id=cs.id),
                Student(roll_no="22CM001", name="Eleanor Vance", year=2, department_id=comm.id),
                Student(roll_no="22CM002", name="Frank Miller", year=2, department_id=comm.id),
            ]
            session.add_all(students)
            await session.flush()

            # 4. Multi-Period Attendance Sessions (September 2026, August 2026, February 2026, Year 2025)
            sessions = [
                # September 2026
                (date(2026, 9, 1), 1, staff_members[0].id),
                (date(2026, 9, 1), 2, staff_members[1].id),
                (date(2026, 9, 1), 3, staff_members[0].id),
                (date(2026, 9, 2), 1, staff_members[1].id),
                (date(2026, 9, 2), 2, staff_members[0].id),
                (date(2026, 9, 3), 1, staff_members[0].id),
                (date(2026, 9, 4), 1, staff_members[1].id),
                (date(2026, 9, 4), 2, staff_members[0].id),
                (date(2026, 9, 5), 1, staff_members[0].id),
                (date(2026, 9, 5), 2, staff_members[1].id),
                (date(2026, 9, 8), 1, staff_members[0].id),
                (date(2026, 9, 8), 2, staff_members[1].id),
                (date(2026, 9, 8), 3, staff_members[0].id),
                # August 2026
                (date(2026, 8, 18), 1, staff_members[0].id),
                (date(2026, 8, 18), 2, staff_members[1].id),
                (date(2026, 8, 19), 1, staff_members[1].id),
                (date(2026, 8, 20), 1, staff_members[0].id),
                (date(2026, 8, 20), 2, staff_members[1].id),
                # February 2026
                (date(2026, 2, 9), 1, staff_members[0].id),
                (date(2026, 2, 9), 2, staff_members[1].id),
                (date(2026, 2, 10), 1, staff_members[0].id),
                (date(2026, 2, 10), 2, staff_members[1].id),
                (date(2026, 2, 11), 1, staff_members[0].id),
                # November 2025
                (date(2025, 11, 17), 1, staff_members[0].id),
                (date(2025, 11, 17), 2, staff_members[1].id),
                (date(2025, 11, 18), 1, staff_members[0].id),
                # October 2025
                (date(2025, 10, 14), 1, staff_members[0].id),
                (date(2025, 10, 14), 2, staff_members[1].id),
            ]
            cs_rolls = ["22CS001", "22CS002", "22CS003", "22CS004"]
            att_records = []
            for idx, (sess_date, hour, stf_id) in enumerate(sessions):
                for st_idx, roll in enumerate(cs_rolls):
                    if roll == "22CS001":
                        stat = AttendanceStatus.PRESENT
                    elif roll == "22CS002":
                        stat = AttendanceStatus.ABSENT if (idx % 6 == 0) else AttendanceStatus.PRESENT
                    elif roll == "22CS003":
                        stat = AttendanceStatus.ABSENT if (idx % 2 == 0) else AttendanceStatus.PRESENT
                    else:
                        stat = AttendanceStatus.OD if (idx % 4 == 0) else AttendanceStatus.PRESENT
                    att_records.append(
                        AttendanceRecord(
                            date=sess_date,
                            hour_number=hour,
                            roll_no=roll,
                            status=stat,
                            staff_id=stf_id
                        )
                    )

            # 4.1 Commerce Department Sessions (Demonstrating Multi-Department Teaching for Dr. John Smith)
            comm_sessions = [
                (date(2026, 9, 2), 4, staff_members[0].id),  # Dr. John Smith teaches interdisciplinary course in Commerce
                (date(2026, 9, 3), 3, staff_members[0].id),  # Dr. John Smith
                (date(2026, 9, 4), 4, staff_members[2].id),  # Dr. Alex Johnson (Commerce primary)
                (date(2026, 9, 5), 3, staff_members[0].id),  # Dr. John Smith
            ]
            comm_rolls = ["22CM001", "22CM002"]
            for idx, (sess_date, hour, stf_id) in enumerate(comm_sessions):
                for roll in comm_rolls:
                    stat = AttendanceStatus.PRESENT if (idx % 3 != 0) else AttendanceStatus.OD
                    att_records.append(
                        AttendanceRecord(
                            date=sess_date,
                            hour_number=hour,
                            roll_no=roll,
                            status=stat,
                            staff_id=stf_id
                        )
                    )
            session.add_all(att_records)

            # 5. Academic Calendar Overrides
            cal_overrides = [
                CalendarOverride(
                    date=date.today(),
                    day_type=DayType.FULL_DAY,
                    active_periods=[1, 2, 3, 4, 5],
                    description="Standard Working Day"
                ),
                CalendarOverride(
                    date=date.today() + timedelta(days=2),
                    day_type=DayType.HOLIDAY,
                    active_periods=[],
                    description="Local Festival Holiday"
                ),
                CalendarOverride(
                    date=date.today() + timedelta(days=4),
                    day_type=DayType.HALF_DAY,
                    active_periods=[1, 2, 3],
                    description="Symposium Half-Day (Periods 1-3)"
                ),
            ]
            session.add_all(cal_overrides)

            await session.commit()
            print("Database successfully seeded with multi-month attendance history and calendar overrides!")
            print("Level 1 (Admin): username=admin, password=admin123")
            print("Level 2 (Dept Terminal CS): username=cs_department, password=dept123")
            print("Level 3 (Staff CS): username=prof_smith, password=staff123, PIN=1234")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())
