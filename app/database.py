import socket
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

import os

def get_effective_database_url() -> str:
    url = settings.DATABASE_URL
    if "mysql" in url:
        try:
            if "unix_socket=" in url:
                sock_path = url.split("unix_socket=")[1].split("&")[0]
                if os.path.exists(sock_path):
                    return url
            else:
                host = "127.0.0.1"
                port = 3306
                if "@" in url:
                    host_port = url.split("@")[1].split("/")[0]
                    if ":" in host_port:
                        h, p = host_port.split(":")
                        host = h
                        port = int(p)
                    else:
                        host = host_port
                with socket.create_connection((host, port), timeout=1.0):
                    return url
        except Exception:
            pass
        print("MySQL server offline. Falling back to local SQLite database.")
        return "sqlite+aiosqlite:///./attendance.db"
    elif "postgresql" in url or "postgres" in url:
        try:
            host = "127.0.0.1"
            port = 5432
            if "@" in url:
                host_port = url.split("@")[1].split("/")[0]
                if ":" in host_port:
                    h, p = host_port.split(":")
                    host = h
                    port = int(p)
                else:
                    host = host_port
            with socket.create_connection((host, port), timeout=1.0):
                return url
        except Exception:
            print("PostgreSQL server offline. Falling back to local SQLite database.")
            return "sqlite+aiosqlite:///./attendance.db"
    return url

effective_database_url = get_effective_database_url()

connect_args = {}
if "sqlite" in effective_database_url:
    connect_args["check_same_thread"] = False

engine = create_async_engine(
    effective_database_url,
    echo=False,
    future=True,
    connect_args=connect_args
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
