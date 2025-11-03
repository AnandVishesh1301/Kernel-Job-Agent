from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db_session
from ..models import ApplicationArtifact, JobApplication
from ..schemas import JobApplicationOut
from ..services.job_runner import run_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobCreateIn(BaseModel):
    url: str
    resume_id: UUID
    cover_letter_r2_key: str | None = None


@router.get("", response_model=List[JobApplicationOut])
async def list_jobs(db: AsyncSession = Depends(get_db_session)):
    stmt = select(JobApplication).order_by(JobApplication.created_at.desc()).limit(100)
    result = await db.execute(stmt)
    jobs = result.scalars().all()
    return jobs


@router.post("", response_model=JobApplicationOut)
async def create_job(body: JobCreateIn, db: AsyncSession = Depends(get_db_session)):
    job = JobApplication(
        target_url=body.url,
        resume_id=body.resume_id,
        cover_letter_r2_key=body.cover_letter_r2_key,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


@router.post("/{job_id}/run", response_model=JobApplicationOut)
async def run_job_endpoint(job_id: UUID, db: AsyncSession = Depends(get_db_session)):
    stmt = select(JobApplication).where(JobApplication.id == job_id)
    res = await db.execute(stmt)
    job = res.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Mark running and dispatch background task
    from ..models import JobStatus

    job.status = JobStatus.running
    await db.commit()

    # fire-and-forget background task; production: use a queue
    import asyncio

    _task = asyncio.create_task(run_job(str(job_id)))
    await db.refresh(job)
    return job


@router.get("/{job_id}", response_model=JobApplicationOut)
async def get_job(job_id: UUID, db: AsyncSession = Depends(get_db_session)):
    stmt = select(JobApplication).where(JobApplication.id == job_id)
    res = await db.execute(stmt)
    job = res.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/{job_id}/artifacts")
async def list_artifacts(job_id: UUID, db: AsyncSession = Depends(get_db_session)):
    stmt = select(ApplicationArtifact).where(ApplicationArtifact.job_application_id == job_id)
    res = await db.execute(stmt)
    arts = res.scalars().all()
    return [{"id": str(a.id), "type": a.type, "r2_key": a.r2_key, "created_at": a.created_at} for a in arts]


