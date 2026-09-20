import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
from app.database import AsyncSessionLocal, engine, Base
from app.models import Department, User, UserRole, Student, AttendanceRecord, Staff, StaffDepartment, CalendarOverride
from app.security import get_password_hash

async def clear_test_data(keep_admin: bool = True):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        print("Clearing pre-defined test data from database...")
        
        # 0. Delete Calendar Overrides
        await session.execute(delete(CalendarOverride))

        # 1. Delete all Attendance Records
        await session.execute(delete(AttendanceRecord))
        
        # 2. Delete all Students
        await session.execute(delete(Student))

        # 3. Delete all Staff
        await session.execute(delete(Staff))

        # 4. Delete all Staff Departments
        await session.execute(delete(StaffDepartment))
        
        # 5. Delete all non-admin Users
        await session.execute(delete(User).where(User.username != "admin"))
        
        # 6. Delete all Departments
        await session.execute(delete(Department))
        
        # Ensure existing admin user has department_id = None
        admin_res = await session.execute(select(User).where(User.username == "admin"))
        admin_user = admin_res.scalar_one_or_none()
        if admin_user:
            admin_user.department_id = None
            admin_user.role = UserRole.ADMIN
        elif keep_admin:
            print("Creating default System Admin account...")
            admin_user = User(
                username="admin",
                password_hash=get_password_hash("admin123"),
                role=UserRole.ADMIN,
                department_id=None
            )
            session.add(admin_user)

        await session.commit()
        print("Database cleared. Only admin account remains.")
        print("Admin account: username='admin', password='admin123'")

if __name__ == "__main__":
    asyncio.run(clear_test_data(keep_admin=True))
