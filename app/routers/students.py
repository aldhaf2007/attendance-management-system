from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.models import Student
from app.schemas import StudentOut
from app.dependencies import get_current_user_context, CurrentUserContext, verify_department_access

router = APIRouter(prefix="/students", tags=["Students"])

@router.get("/class/{dept_id}/{year}", response_model=List[StudentOut])
async def get_students_for_class(
    dept_id: int,
    year: int,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the list of students for a specific department and year.
    Enforces department data isolation.
    """
    verify_department_access(dept_id, ctx)
    if year not in (1, 2, 3):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Academic year must be 1, 2, or 3. 4th year is not supported."
        )
    result = await db.execute(
        select(Student)
        .where(and_(Student.department_id == dept_id, Student.year == year))
        .order_by(Student.roll_no)
    )
    students = result.scalars().all()
    return students
