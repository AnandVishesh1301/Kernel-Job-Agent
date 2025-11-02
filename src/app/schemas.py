from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ResumeOut(BaseModel):
    id: UUID
    r2_key: str
    file_name: str
    content_type: str
    parsed_profile: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserPreferencesOut(BaseModel):
    id: UUID
    data: dict
    updated_at: datetime

    class Config:
        from_attributes = True


class JobApplicationOut(BaseModel):
    id: UUID
    target_url: str
    resume_id: UUID
    cover_letter_r2_key: Optional[str] = None
    status: Literal["queued", "running", "succeeded", "failed"]
    kernel_session_id: Optional[str] = None
    persistence_id: Optional[str] = None
    live_view_url: Optional[str] = None
    result_summary: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApplicationArtifactOut(BaseModel):
    id: UUID
    job_application_id: UUID
    type: str
    r2_key: str
    created_at: datetime

    class Config:
        from_attributes = True


