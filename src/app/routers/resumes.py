from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db_session
from ..models import Resume
from ..schemas import ResumeOut
from ..services.storage_r2 import build_resume_key, put_file
from ..services.resume_parser import parse_resume_from_r2_key

router = APIRouter(prefix="/resumes", tags=["resumes"])


@router.get("", response_model=List[ResumeOut])
async def list_resumes(db: AsyncSession = Depends(get_db_session)):
    stmt = select(Resume).order_by(Resume.created_at.desc()).limit(100)
    result = await db.execute(stmt)
    resumes = result.scalars().all()
    return resumes


@router.post("", response_model=ResumeOut)
async def upload_resume(file: UploadFile, db: AsyncSession = Depends(get_db_session)):
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    key = build_resume_key(file.filename)

    try:
        # Stream upload to R2
        put_file(file.file, key, content_type=file.content_type)
    finally:
        await file.close()

    resume = Resume(
        r2_key=key,
        file_name=file.filename,
        content_type=file.content_type or "application/octet-stream",
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    return resume


@router.post("/{resume_id}/parse", response_model=ResumeOut)
async def parse_resume(resume_id: UUID, db: AsyncSession = Depends(get_db_session)):
    # Load resume
    stmt = select(Resume).where(Resume.id == resume_id)
    res = await db.execute(stmt)
    resume = res.scalars().first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Parse via Azure OpenAI using content from R2
    try:
        parsed = await parse_resume_from_r2_key(resume.r2_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing failed: {e}")

    resume.parsed_profile = parsed
    await db.commit()
    await db.refresh(resume)
    return resume


