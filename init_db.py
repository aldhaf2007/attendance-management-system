"""
Database Initialization Script for College Attendance Tracker
==============================================================
Designed for fresh deployments and newer systems.
- Creates all required database tables with proper foreign keys and constraints.
- Ensures the database is completely EMPTY of test/dummy data.
- Creates/ensures ONLY the default System Administrator account ('admin' / 'admin123').

Usage:
  python init_db.py          # Initialize tables and ensure admin user exists
  python init_db.py --clean  # Reset/wipe all data, leaving only the admin user
  python init_db.py --check  # Check current table and record counts
"""

import sys
import asyncio
from sqlalchemy import select, delete, func, text
from app.database import engine, AsyncSessionLocal, Base, get_effective_database_url
from app.models import Department, User, UserRole, Student, Staff, StaffDepartment, AttendanceRecord, CalendarOverride
from app.security import get_password_hash
from app.config import settings

async def create_tables_if_not_exist():
    """Create all database tables using SQLAlchemy Declarative Base."""
    print("Ensuring all database tables exist...")
    async with engine.begin() as conn:
        # First ensure departments and staff_departments tables are properly created
        await conn.run_sync(Base.metadata.create_all)
    print("All tables successfully verified and created.")

async def ensure_admin_user(session):
    """Ensure the root System Admin account exists."""
    res = await session.execute(select(User).where(User.username == "admin"))
    admin = res.scalar_one_or_none()
    if not admin:
        print("Creating root System Admin account (username: 'admin')...")
        admin = User(
            username="admin",
            password_hash=get_password_hash("admin123"),
            role=UserRole.ADMIN,
            department_id=None
        )
        session.add(admin)
        await session.commit()
        print("Root System Admin account created successfully! (password: 'admin123')")
    else:
        print("Root System Admin account already exists (username: 'admin').")
    return admin

async def clear_all_test_data(session):
    """Wipe all existing data, leaving the database completely clean with only the admin."""
    print("Clearing all records from database to ensure fresh, empty state...")
    await session.execute(delete(AttendanceRecord))
    await session.execute(delete(CalendarOverride))
    await session.execute(delete(Student))
    await session.execute(delete(Staff))
    await session.execute(delete(StaffDepartment))
    await session.execute(delete(User).where(User.username != "admin"))
    await session.execute(delete(Department))
    await session.commit()
    print("All test records cleared. Database is clean and empty.")

async def check_db_status():
    """Print current record counts for all tables."""
    async with AsyncSessionLocal() as session:
        dept_cnt = (await session.execute(select(func.count(Department.id)))).scalar() or 0
        user_cnt = (await session.execute(select(func.count(User.id)))).scalar() or 0
        staff_cnt = (await session.execute(select(func.count(Staff.id)))).scalar() or 0
        student_cnt = (await session.execute(select(func.count(Student.roll_no)))).scalar() or 0
        rec_cnt = (await session.execute(select(func.count(AttendanceRecord.id)))).scalar() or 0
        cal_cnt = (await session.execute(select(func.count(CalendarOverride.date)))).scalar() or 0

        print("--------------------------------------------------")
        print("Database Status Summary:")
        print(f"  • Database URL: {get_effective_database_url().split('@')[-1] if '@' in get_effective_database_url() else get_effective_database_url()}")
        print(f"  • Departments:         {dept_cnt}")
        print(f"  • Staff Profiles:      {staff_cnt}")
        print(f"  • Enrolled Students:   {student_cnt}")
        print(f"  • Attendance Records:  {rec_cnt}")
        print(f"  • Calendar Overrides:  {cal_cnt}")
        print(f"  • Total Users:         {user_cnt}")
        print("--------------------------------------------------")

async def init_database(clean: bool = False):
    print("==================================================")
    print(" ARIGNAR ANNA COLLEGE - Database Setup")
    print("==================================================")
    
    # 1. Create tables
    await create_tables_if_not_exist()

    # 2. Handle data
    async with AsyncSessionLocal() as session:
        if clean:
            await clear_all_test_data(session)
        
        # 3. Ensure admin user exists
        await ensure_admin_user(session)

    # 4. Display status
    await check_db_status()
    print("==================================================")
    print(" Database initialization complete!")
    print(" Ready for login at http://localhost:3000")
    print(" Login credentials: Username='admin', Password='admin123'")
    print("==================================================")

async def main():
    args = sys.argv[1:]
    try:
        if "--check" in args:
            await check_db_status()
        elif "--clean" in args or "--empty" in args or "--reset" in args:
            await init_database(clean=True)
        else:
            await init_database(clean=False)
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
