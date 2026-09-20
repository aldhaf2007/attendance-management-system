from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, UserRole, Staff
from app.security import decode_token

security_scheme = HTTPBearer()

class CurrentUserContext:
    def __init__(
        self,
        user_id: int,
        username: str,
        role: UserRole,
        department_id: Optional[int],
        staff_id: Optional[int] = None,
        is_kiosk_scoped_staff: bool = False,
        kiosk_user_id: Optional[int] = None,
        allowed_department_ids: Optional[List[int]] = None
    ):
        self.user_id = user_id
        self.username = username
        self.role = role
        self.department_id = department_id
        self.staff_id = staff_id or (user_id if is_kiosk_scoped_staff else None)
        self.is_kiosk_scoped_staff = is_kiosk_scoped_staff
        self.kiosk_user_id = kiosk_user_id
        self.allowed_department_ids = allowed_department_ids or ([department_id] if department_id else [])

async def get_current_user_context(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db)
) -> CurrentUserContext:
    token = credentials.credentials
    payload = decode_token(token)
    
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing subject claim"
        )
    
    user_id = int(sub)
    scope = payload.get("scope")
    
    # Handle short-lived Kiosk Staff PIN submission token
    if scope == "kiosk_attendance_submission":
        department_id = payload.get("department_id")
        allowed_department_ids = payload.get("allowed_department_ids", [])
        if department_id and department_id not in allowed_department_ids:
            allowed_department_ids.append(department_id)
        kiosk_user_id = payload.get("kiosk_user_id")
        username = payload.get("username", "Staff")
        return CurrentUserContext(
            user_id=user_id,
            username=username,
            role=UserRole.STAFF,
            department_id=department_id,
            staff_id=user_id,
            is_kiosk_scoped_staff=True,
            kiosk_user_id=kiosk_user_id,
            allowed_department_ids=allowed_department_ids
        )
    
    # Standard user token lookup from DB
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token not found"
        )

    resolved_staff_id = None
    allowed_depts = [user.department_id] if user.department_id else []
    if user.role == UserRole.STAFF:
        staff_res = await db.execute(
            select(Staff).options(selectinload(Staff.staff_department)).where(Staff.user_id == user.id)
        )
        staff_obj = staff_res.scalar_one_or_none()
        if staff_obj:
            resolved_staff_id = staff_obj.id
            if staff_obj.all_department_ids:
                allowed_depts = list(dict.fromkeys(allowed_depts + staff_obj.all_department_ids))
    
    return CurrentUserContext(
        user_id=user.id,
        username=user.username,
        role=user.role,
        department_id=user.department_id,
        staff_id=resolved_staff_id,
        allowed_department_ids=allowed_depts
    )

def require_roles(*allowed_roles: UserRole):
    def role_checker(ctx: CurrentUserContext = Depends(get_current_user_context)) -> CurrentUserContext:
        if ctx.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: User role '{ctx.role}' does not have permission for this resource."
            )
        return ctx
    return role_checker

# Explicit Level 1, 2, 3 RBAC helper dependencies
require_admin = require_roles(UserRole.ADMIN)
require_department = require_roles(UserRole.DEPARTMENT, UserRole.ADMIN)
require_staff = require_roles(UserRole.STAFF, UserRole.ADMIN)

def verify_department_access(target_department_id: int, ctx: CurrentUserContext) -> None:
    """
    Data Isolation Check:
    Global Admins can access any department.
    Department terminals and Staff can only access their assigned or permitted departments.
    """
    if ctx.role == UserRole.ADMIN:
        return
    
    if target_department_id in ctx.allowed_department_ids or ctx.department_id == target_department_id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: Department data isolation restriction."
    )
