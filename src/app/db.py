from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


def _normalize_asyncpg_url(url: str) -> str:
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _strip_libpq_params(url: str) -> str:
    # Remove libpq-only params that asyncpg doesn't accept (e.g., sslmode, channel_binding)
    parts = urlsplit(url)
    if not parts.query:
        return url
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.pop("sslmode", None)
    query.pop("channel_binding", None)
    new_query = urlencode(query)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))


class Base(DeclarativeBase):
    pass


def get_engine() -> AsyncEngine:
    settings = get_settings()
    database_url = _strip_libpq_params(_normalize_asyncpg_url(settings.DATABASE_URL))
    return create_async_engine(
        database_url,
        future=True,
        pool_pre_ping=True,
        connect_args={"ssl": True},
    )


engine: AsyncEngine = get_engine()
SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


