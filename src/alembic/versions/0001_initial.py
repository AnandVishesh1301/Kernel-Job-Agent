"""initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2025-11-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg
from sqlalchemy.dialects.postgresql import ENUM as PGEnum


# revision identifiers, used by Alembic.
revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enum type for job status
    job_status = sa.Enum("queued", "running", "succeeded", "failed", name="job_status")
    job_status.create(op.get_bind(), checkfirst=True)

    # resumes
    op.create_table(
        "resumes",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("r2_key", sa.Text(), nullable=False),
        sa.Column("file_name", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("parsed_profile", pg.JSONB(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # user_preferences (single row for MVP)
    op.create_table(
        "user_preferences",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("data", pg.JSONB(), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # job_applications
    op.create_table(
        "job_applications",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("target_url", sa.Text(), nullable=False),
        sa.Column("resume_id", pg.UUID(as_uuid=True), sa.ForeignKey("resumes.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("cover_letter_r2_key", sa.Text(), nullable=True),
        sa.Column(
            "status",
            PGEnum(
                "queued",
                "running",
                "succeeded",
                "failed",
                name="job_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("kernel_session_id", sa.Text(), nullable=True),
        sa.Column("persistence_id", sa.Text(), nullable=True),
        sa.Column("live_view_url", sa.Text(), nullable=True),
        sa.Column("result_summary", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # application_artifacts
    op.create_table(
        "application_artifacts",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("job_application_id", pg.UUID(as_uuid=True), sa.ForeignKey("job_applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("r2_key", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("application_artifacts")
    op.drop_table("job_applications")
    op.drop_table("user_preferences")
    op.drop_table("resumes")

    job_status = sa.Enum(name="job_status")
    job_status.drop(op.get_bind(), checkfirst=True)


