from typing import Dict, Tuple, List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "ARIGNAR ANNA COLLEGE - Attendance Tracker API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    PORT: int = 8000
    
    # Environment & Security
    ENVIRONMENT: str = "development"
    DEFAULT_INSECURE_SECRET_KEY: str = "super-secret-key-change-in-production-attendance-2026!"
    SECRET_KEY: str = "super-secret-key-change-in-production-attendance-2026!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    KIOSK_PIN_TOKEN_EXPIRE_MINUTES: int = 15  # 15 minutes short-lived submission window
    
    # Allowed CORS Origins Whitelist
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8001",
        "http://127.0.0.1:8001"
    ]
    
    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if not v.strip():
                return []
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Database Pool Settings
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_RECYCLE: int = 1800  # Recycle after 30 mins to avoid MySQL timeout
    
    # Database URL: Primary Async MySQL Database
    DATABASE_URL: str = "mysql+aiomysql://root@localhost/attendance_db?unix_socket=/var/lib/mysql/mysql.sock"
    
    # Time-Lock Settings
    ALLOW_TIME_LOCK_BYPASS: bool = False
    
    # Rule 1: Global Lock Window (IST 09:00 AM - 05:00 PM)
    GLOBAL_START_TIME: str = "09:00"
    GLOBAL_END_TIME: str = "17:00"
    
    # Rule 2: 5-Period Specific Active Windows (24h format HH:MM - HH:MM IST)
    HOUR_SLOTS: Dict[int, Tuple[str, str]] = {
        1: ("10:00", "10:30"),
        2: ("11:00", "11:30"),
        3: ("12:00", "12:30"),
        4: ("13:30", "14:00"),
        5: ("14:30", "15:00")
    }

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
