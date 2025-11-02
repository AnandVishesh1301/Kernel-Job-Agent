from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db_session

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("")
async def get_preferences(db: AsyncSession = Depends(get_db_session)):
    # Placeholder for step 2; full implementation in later steps
    return {"data": {}}


