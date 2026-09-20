import time
import threading
from typing import Dict, List, Tuple

class RateLimiter:
    """
    Thread-safe in-memory rate limiter and account lockout manager:
    1. IP-based Sliding Window: Limits requests from an IP address to max_requests per window.
    2. Account-based Failed PIN Lockout: Tracks consecutive failed PIN attempts for a staff account.
       Locks the account for lockout_seconds after max_failed_attempts.
    """
    def __init__(self):
        self._lock = threading.Lock()
        # IP -> list of timestamps
        self._ip_attempts: Dict[str, List[float]] = {}
        # Account Key -> {"failed_count": int, "locked_until": float, "last_attempt": float}
        self._account_lockouts: Dict[str, Dict[str, float]] = {}

    def check_ip_rate_limit(self, ip: str, max_requests: int = 10, window_seconds: int = 60) -> Tuple[bool, int]:
        """
        Returns (is_allowed, remaining_seconds_to_wait)
        """
        from app.config import settings
        if settings.ENVIRONMENT in ["test", "testing"]:
            return True, 0

        now = time.time()
        with self._lock:
            if ip not in self._ip_attempts:
                self._ip_attempts[ip] = []
            
            # Clean up old timestamps
            self._ip_attempts[ip] = [ts for ts in self._ip_attempts[ip] if now - ts < window_seconds]
            
            if len(self._ip_attempts[ip]) >= max_requests:
                oldest = self._ip_attempts[ip][0]
                wait_seconds = max(1, int(window_seconds - (now - oldest)))
                return False, wait_seconds
            
            self._ip_attempts[ip].append(now)
            return True, 0

    def is_account_locked(self, account_key: str) -> Tuple[bool, int]:
        """
        Checks if an account is currently locked out.
        Returns (is_locked, remaining_lockout_seconds)
        """
        now = time.time()
        clean_key = account_key.strip().upper()
        with self._lock:
            record = self._account_lockouts.get(clean_key)
            if not record:
                return False, 0
            
            locked_until = record.get("locked_until", 0)
            if now < locked_until:
                remaining = int(locked_until - now)
                return True, max(1, remaining)
            
            # Lockout expired, reset failed counter if window has passed
            if now - record.get("last_attempt", 0) > 900:  # 15 minutes window
                del self._account_lockouts[clean_key]
            
            return False, 0

    def record_failed_pin(self, account_key: str, max_attempts: int = 5, lockout_seconds: int = 900) -> Tuple[bool, int, int]:
        """
        Records a failed PIN attempt for account_key.
        Returns (is_now_locked, attempts_remaining, lockout_seconds_if_locked)
        """
        now = time.time()
        clean_key = account_key.strip().upper()
        with self._lock:
            record = self._account_lockouts.get(clean_key, {"failed_count": 0, "locked_until": 0, "last_attempt": now})
            
            # Reset if previous attempts were more than 15 mins ago
            if now - record.get("last_attempt", 0) > lockout_seconds and record.get("locked_until", 0) <= now:
                record["failed_count"] = 0
            
            record["failed_count"] += 1
            record["last_attempt"] = now
            
            if record["failed_count"] >= max_attempts:
                record["locked_until"] = now + lockout_seconds
                self._account_lockouts[clean_key] = record
                return True, 0, lockout_seconds
            
            self._account_lockouts[clean_key] = record
            remaining_attempts = max_attempts - record["failed_count"]
            return False, remaining_attempts, 0

    def reset_failed_pin(self, account_key: str):
        """
        Resets failed attempts on successful verification.
        """
        clean_key = account_key.strip().upper()
        with self._lock:
            if clean_key in self._account_lockouts:
                del self._account_lockouts[clean_key]

    def reset_all(self):
        """
        Resets all rate limits and lockouts (useful in tests).
        """
        with self._lock:
            self._ip_attempts.clear()
            self._account_lockouts.clear()

# Global singleton
rate_limiter = RateLimiter()
