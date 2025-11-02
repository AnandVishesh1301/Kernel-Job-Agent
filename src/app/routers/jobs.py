from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db_session

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("")
async def list_jobs(db: AsyncSession = Depends(get_db_session)):
    # Placeholder for step 2; full implementation in later steps
    return {"items": [], "count": 0}


