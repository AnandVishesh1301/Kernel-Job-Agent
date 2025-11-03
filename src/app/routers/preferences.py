from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db_session
from ..models import UserPreferences

router = APIRouter(prefix="/preferences", tags=["preferences"])


class UpdatePreferencesRequest(BaseModel):
    data: dict


@router.get("")
async def get_preferences(db: AsyncSession = Depends(get_db_session)):
    stmt = select(UserPreferences).limit(1)
    res = await db.execute(stmt)
    row = res.scalars().first()
    return {"data": row.data if row else {}}


@router.put("")
async def upsert_preferences(payload: UpdatePreferencesRequest, db: AsyncSession = Depends(get_db_session)):
    stmt = select(UserPreferences).limit(1)
    res = await db.execute(stmt)
    row = res.scalars().first()
    if row is None:
        row = UserPreferences(data=payload.data)
        db.add(row)
    else:
        row.data = payload.data
    await db.commit()
    return {"ok": True}


