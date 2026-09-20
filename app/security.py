from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import bcrypt
import jwt
from fastapi import HTTPException, status

from app.config import settings

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password or not plain_password:
        return False
    try:
        pwd_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        return False

def get_pin_hash(pin: str) -> str:
    return get_password_hash(pin)

def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    return verify_password(plain_pin, hashed_pin)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_kiosk_unlock_token(
    staff_id: int,
    staff_username: str,
    unlocked_hour: int,
    department_id: int,
    kiosk_user_id: Optional[int] = None,
    allowed_department_ids: Optional[list] = None
) -> str:
    """
    Returns a short-lived scoped JWT containing staff_id, unlocked_hour, department_id, and allowed_department_ids.
    """
    expires_delta = timedelta(minutes=settings.KIOSK_PIN_TOKEN_EXPIRE_MINUTES)
    expire = datetime.now(timezone.utc) + expires_delta
    
    dept_ids = list(allowed_department_ids) if allowed_department_ids else [department_id]
    if department_id not in dept_ids:
        dept_ids.append(department_id)

    to_encode = {
        "sub": str(staff_id),
        "username": staff_username,
        "role": "Staff",
        "scope": "kiosk_attendance_submission",
        "unlocked_hour": unlocked_hour,
        "department_id": department_id,
        "allowed_department_ids": dept_ids,
        "kiosk_user_id": kiosk_user_id,
        "exp": expire
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Thread-safe in-memory token revocation blacklist
import threading
import time

_revoked_tokens: Dict[str, float] = {}
_blacklist_lock = threading.Lock()

def revoke_token(token: str, ttl_seconds: int = 86400) -> None:
    """
    Revokes a JWT token upon logout so it cannot be reused.
    """
    now = time.time()
    with _blacklist_lock:
        _revoked_tokens[token] = now + ttl_seconds
        if len(_revoked_tokens) > 1000:
            expired = [t for t, exp in _revoked_tokens.items() if exp < now]
            for t in expired:
                del _revoked_tokens[t]

def is_token_revoked(token: str) -> bool:
    """
    Checks if a token has been revoked.
    """
    now = time.time()
    with _blacklist_lock:
        expiry = _revoked_tokens.get(token)
        if expiry is None:
            return False
        if now > expiry:
            del _revoked_tokens[token]
            return False
        return True

