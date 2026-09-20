from typing import Dict, Tuple
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "ARIGNAR ANNA COLLEGE - Attendance Tracker API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Security
    SECRET_KEY: str = "super-secret-key-change-in-production-attendance-2026!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    KIOSK_PIN_TOKEN_EXPIRE_MINUTES: int = 15  # 15 minutes short-lived submission window
    
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
