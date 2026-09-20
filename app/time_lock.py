from datetime import datetime, date as dt_date, time, timezone, timedelta
from typing import Optional, List, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models import CalendarOverride, DayType

# Indian Standard Time (IST) UTC+5:30
IST = timezone(timedelta(hours=5, minutes=30))

def parse_time_str(time_str: str) -> time:
    h, m = map(int, time_str.split(":"))
    return time(h, m)

def get_current_ist_datetime() -> datetime:
    return datetime.now(IST)

def get_current_ist_time() -> time:
    return datetime.now(IST).time()

def get_current_ist_date() -> dt_date:
    return datetime.now(IST).date()

async def resolve_calendar_status(
    target_date: dt_date,
    db: AsyncSession
) -> Tuple[str, List[int], Optional[str]]:
    """
    Checks the CalendarOverride table for target_date.
    - If found: returns (override.day_type, override.active_periods, override.description).
    - If not found:
        - Monday - Friday (weekday 0-4): ('full_day', [1, 2, 3, 4, 5], 'Regular Academic Day')
        - Saturday - Sunday (weekday 5-6): ('holiday', [], 'Weekend Holiday')
    """
    stmt = select(CalendarOverride).where(CalendarOverride.date == target_date)
    res = await db.execute(stmt)
    override = res.scalar_one_or_none()

    if override:
        day_type = override.day_type.value if hasattr(override.day_type, "value") else str(override.day_type)
        active_periods = list(override.active_periods) if override.active_periods is not None else []
        return day_type, active_periods, override.description

    # Default weekly schedule: Monday=0, Sunday=6
    if target_date.weekday() < 5:
        return DayType.FULL_DAY.value, [1, 2, 3, 4, 5], "Regular Academic Day"
    else:
        return DayType.HOLIDAY.value, [], "Weekend Holiday"

async def verify_dual_layer_time_lock(
    hour_number: int,
    db: Optional[AsyncSession] = None,
    target_date: Optional[dt_date] = None,
    bypass_header: Optional[str] = None
) -> None:
    """
    Academic Calendar & Dual-Layer Time-Lock Dependency:
    
    Layer 0 (Academic Calendar & Holiday Lock):
    - Checks CalendarOverride table for target date.
    - If 'holiday': completely rejects attendance submissions with HTTP 403 Forbidden.
    - If 'half_day': only permits submissions for periods in active_periods (e.g. [1, 2, 3]).
    
    Layer 1 (Global Lock):
    - Completely rejects attendance submissions outside 09:00 AM to 05:00 PM IST.
    
    Layer 2 (Period Lock):
    - Enforces the active time window for the requested period (1 to 5).
    """
    if hour_number not in settings.HOUR_SLOTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid period/hour_number '{hour_number}'. Must be an integer between 1 and 5."
        )

    # Bypass is strictly disallowed in production mode
    can_bypass = settings.ENVIRONMENT in ["development", "test", "testing"] or settings.ALLOW_TIME_LOCK_BYPASS

    # Complete bypass for internal tests that need to bypass calendar checks as well
    if can_bypass and bypass_header == "bypass-all":
        return

    # 1. Calendar Status & Active Periods Enforcement
    curr_date = target_date or get_current_ist_date()

    if db is not None:
        day_type, active_periods, description = await resolve_calendar_status(curr_date, db)

        # Holiday check: completely reject with 403 Forbidden
        if day_type == DayType.HOLIDAY.value or day_type == "holiday":
            desc_text = f" ({description})" if description else ""
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Attendance Forbidden: Today ({curr_date.isoformat()}) is a Holiday{desc_text}. Attendance taking is closed."
            )

        # Half-day and active periods check
        if hour_number not in active_periods:
            desc_text = f" ({description})" if description else ""
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Period Lock Violation: Period {hour_number} is not an active period on this {day_type.replace('_', ' ')}"
                    f"{desc_text}. Active periods today: {active_periods}."
                )
            )

    # Bypass check for local development & automated test execution (bypasses clock time slots)
    if can_bypass and (settings.ALLOW_TIME_LOCK_BYPASS or bypass_header == "bypass-secret-test"):
        return

    current_time = get_current_ist_time()

    # --- Layer 1: Global Lock (09:00 AM - 05:00 PM IST) ---
    global_start = parse_time_str(settings.GLOBAL_START_TIME)
    global_end = parse_time_str(settings.GLOBAL_END_TIME)

    if not (global_start <= current_time <= global_end):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Global Lock Violation: Attendance system is completely closed outside 09:00 AM to 05:00 PM IST. "
                f"Current IST Time: {current_time.strftime('%H:%M:%S')}."
            )
        )

    # --- Layer 2: Period Lock ---
    period_start_str, period_end_str = settings.HOUR_SLOTS[hour_number]
    period_start = parse_time_str(period_start_str)
    period_end = parse_time_str(period_end_str)

    if not (period_start <= current_time <= period_end):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Period Lock Violation: Attendance slot for Period {hour_number} is locked. "
                f"Active window for Period {hour_number} is {period_start_str} to {period_end_str} IST. "
                f"Current IST Time: {current_time.strftime('%H:%M:%S')}."
            )
        )

