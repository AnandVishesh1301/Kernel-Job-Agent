from __future__ import annotations

import re
import uuid
from typing import Optional

import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError

from ..config import get_settings


def _get_endpoint_url(settings) -> Optional[str]:
    if settings.R2_ENDPOINT:
        return settings.R2_ENDPOINT
    if settings.R2_ACCOUNT_ID:
        return f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    return None


def get_s3_client():
    settings = get_settings()
    if not settings.R2_ACCESS_KEY_ID or not settings.R2_SECRET_ACCESS_KEY:
        raise RuntimeError("R2 credentials not configured")

    endpoint_url = _get_endpoint_url(settings)
    if not endpoint_url:
        raise RuntimeError("R2 endpoint not configured; set R2_ENDPOINT or R2_ACCOUNT_ID")

    # Cloudflare R2 uses S3-compatible API with signature v4
    session = boto3.session.Session()
    client = session.client(
        service_name="s3",
        region_name="auto",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        endpoint_url=endpoint_url,
        config=Config(signature_version="s3v4"),
    )
    return client


def sanitize_filename(filename: str) -> str:
    name = re.sub(r"[^A-Za-z0-9._-]", "-", filename)
    name = re.sub(r"-+", "-", name).strip("-")
    return name or "file"


def build_resume_key(original_filename: str) -> str:
    settings = get_settings()
    safe_name = sanitize_filename(original_filename)
    return f"resumes/{uuid.uuid4()}-{safe_name}"


def put_file(fileobj, key: str, content_type: Optional[str] = None) -> None:
    settings = get_settings()
    bucket = settings.R2_BUCKET
    if not bucket:
        raise RuntimeError("R2_BUCKET is not configured")
    client = get_s3_client()

    extra_args = {"ContentType": content_type} if content_type else None
    try:
        client.upload_fileobj(fileobj, bucket, key, ExtraArgs=extra_args)
    except (BotoCoreError, ClientError) as e:
        raise RuntimeError(f"Failed to upload to R2: {e}")


def get_public_url(key: str) -> Optional[str]:
    settings = get_settings()
    if settings.R2_PUBLIC_BASE_URL:
        base = settings.R2_PUBLIC_BASE_URL.rstrip("/")
        return f"{base}/{key}"
    return None


def get_presigned_get_url(key: str, expires_seconds: int = 900) -> str:
    settings = get_settings()
    bucket = settings.R2_BUCKET
    if not bucket:
        raise RuntimeError("R2_BUCKET is not configured")
    client = get_s3_client()
    try:
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires_seconds,
        )
    except (BotoCoreError, ClientError) as e:
        raise RuntimeError(f"Failed to sign URL: {e}")


