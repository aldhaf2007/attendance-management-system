from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base
from app.routers import auth, attendance, students, analytics, export, admin, staff_portal

from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables on startup
    async with engine.begin() as conn:
        # 0. Ensure all declarative tables exist first
        await conn.run_sync(Base.metadata.create_all)

        # 1. Ensure staff_departments table exists
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS staff_departments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    department_1_id INT NULL,
                    department_2_id INT NULL,
                    department_3_id INT NULL,
                    department_4_id INT NULL,
                    department_5_id INT NULL,
                    department_6_id INT NULL,
                    department_7_id INT NULL,
                    department_8_id INT NULL,
                    department_9_id INT NULL,
                    FOREIGN KEY (department_1_id) REFERENCES departments(id) ON DELETE SET NULL,
                    FOREIGN KEY (department_2_id) REFERENCES departments(id) ON DELETE SET NULL,
                    FOREIGN KEY (department_3_id) REFERENCES departments(id) ON DELETE SET NULL,
                    FOREIGN KEY (department_4_id) REFERENCES departments(id) ON DELETE SET NULL,
                    FOREIGN KEY (department_5_id) REFERENCES departments(id) ON DELETE SET NULL,
                    FOREIGN KEY (department_6_id) REFERENCES departments(id) ON DELETE SET NULL,
                    FOREIGN KEY (department_7_id) REFERENCES departments(id) ON DELETE SET NULL,
                    FOREIGN KEY (department_8_id) REFERENCES departments(id) ON DELETE SET NULL,
                    FOREIGN KEY (department_9_id) REFERENCES departments(id) ON DELETE SET NULL
                );
            """))
        except Exception:
            pass

        # 2. Add columns department_1_id..9_id to staff_departments if missing
        for i in range(1, 10):
            try:
                await conn.execute(text(f"ALTER TABLE staff_departments ADD COLUMN department_{i}_id INT NULL;"))
            except Exception:
                pass

        # 3. If staff_departments has staff_id, migrate staffs.department_id to staff_departments.id
        try:
            # First, insert staff_departments rows for staff members that don't have matching staff_departments row yet
            await conn.execute(text("""
                INSERT INTO staff_departments (department_1_id)
                SELECT department_id FROM staffs s
                WHERE s.department_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM staff_departments sd WHERE sd.id = s.department_id
                );
            """))
        except Exception:
            pass

        # Check if staff_departments has staff_id column; if so, map staffs.department_id to sd.id
        try:
            await conn.execute(text("""
                UPDATE staffs s
                JOIN staff_departments sd ON sd.staff_id = s.id
                SET s.department_id = sd.id;
            """))
        except Exception:
            pass

        # 4. Drop staff_id column or foreign keys from staff_departments
        try:
            fk_res = await conn.execute(text("""
                SELECT CONSTRAINT_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff_departments' AND COLUMN_NAME = 'staff_id';
            """))
            for (fk_name,) in fk_res.fetchall():
                await conn.execute(text(f"ALTER TABLE staff_departments DROP FOREIGN KEY {fk_name};"))
        except Exception:
            pass

        try:
            await conn.execute(text("ALTER TABLE staff_departments DROP INDEX uq_staff_department;"))
        except Exception:
            pass

        try:
            await conn.execute(text("ALTER TABLE staff_departments DROP INDEX staff_id;"))
        except Exception:
            pass

        try:
            await conn.execute(text("ALTER TABLE staff_departments DROP COLUMN staff_id;"))
        except Exception:
            pass

        # 5. Drop old FK on staffs.department_id pointing to departments(id), if present
        try:
            fk_res = await conn.execute(text("""
                SELECT CONSTRAINT_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staffs' AND COLUMN_NAME = 'department_id' AND REFERENCED_TABLE_NAME = 'departments';
            """))
            for (fk_name,) in fk_res.fetchall():
                await conn.execute(text(f"ALTER TABLE staffs DROP FOREIGN KEY {fk_name};"))
        except Exception:
            pass

        # 6. Ensure staffs.department_id references staff_departments(id)
        try:
            fk_check = await conn.execute(text("""
                SELECT CONSTRAINT_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staffs' AND COLUMN_NAME = 'department_id' AND REFERENCED_TABLE_NAME = 'staff_departments';
            """))
            if not fk_check.fetchall():
                await conn.execute(text("""
                    ALTER TABLE staffs ADD CONSTRAINT fk_staffs_department_id
                    FOREIGN KEY (department_id) REFERENCES staff_departments(id) ON DELETE SET NULL;
                """))
        except Exception:
            pass

        await conn.run_sync(Base.metadata.create_all)

        # 7. Ensure default admin account exists
        try:
            admin_check = await conn.execute(text("SELECT id FROM users WHERE username = 'admin' LIMIT 1;"))
            if not admin_check.scalar_one_or_none():
                from app.security import get_password_hash
                admin_hash = get_password_hash("admin123")
                await conn.execute(
                    text("INSERT INTO users (username, password_hash, role) VALUES ('admin', :pwd_hash, 'Admin');"),
                    {"pwd_hash": admin_hash}
                )
        except Exception:
            pass
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(attendance.router, prefix=settings.API_V1_STR)
app.include_router(students.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(export.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(staff_portal.router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "message": "ARIGNAR ANNA COLLEGE - Attendance Tracker API Foundation is operational with 3-Level RBAC",
        "college": "ARIGNAR ANNA COLLEGE",
        "version": settings.VERSION
    }
