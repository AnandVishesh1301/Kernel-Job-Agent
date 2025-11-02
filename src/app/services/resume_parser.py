from __future__ import annotations

import json
import re
from io import BytesIO
from typing import Any, Dict

import httpx
from openai import AzureOpenAI
from pypdf import PdfReader

from ..config import get_settings
from .storage_r2 import get_presigned_get_url


def _extract_json(text: str) -> Dict[str, Any]:
    # Try to extract JSON from model output, handling possible code fences
    fence = re.search(r"```[a-zA-Z]*\n([\s\S]*?)\n```", text)
    if fence:
        candidate = fence.group(1)
    else:
        candidate = text
    candidate = candidate.strip()
    return json.loads(candidate)


def _pdf_bytes_to_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(pdf_bytes))
    parts: list[str] = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            # Continue on minor extraction failures
            continue
    text = "\n".join(parts)
    # Trim to a large but bounded size to avoid context overflows
    return text[:200_000]


def _get_azure_client() -> AzureOpenAI:
    settings = get_settings()
    if not settings.AZURE_OPENAI_ENDPOINT or not settings.AZURE_OPENAI_API_KEY:
        raise RuntimeError("Azure OpenAI not configured")
    return AzureOpenAI(
        api_key=settings.AZURE_OPENAI_API_KEY,
        api_version=settings.AZURE_OPENAI_API_VERSION or "2024-10-21",
        azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
    )


SYSTEM_PROMPT = (
    "You are an expert resume parser. Extract a normalized JSON profile with fields: "
    "{ name, email, phone, links: string[], education: { school, degree, start, end }[], "
    "experience: { company, title, start, end, location?, bullets: string[] }[], "
    "skills: string[], address?, work_auth? }. Return ONLY JSON."
)


async def parse_resume_from_r2_key(r2_key: str) -> Dict[str, Any]:
    settings = get_settings()
    # Fetch file from R2 via presigned URL
    url = get_presigned_get_url(r2_key)
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        pdf_bytes = resp.content

    text = _pdf_bytes_to_text(pdf_bytes)

    # Call Azure OpenAI (GPT-5 deployment) to extract JSON
    client = _get_azure_client()
    deployment = settings.AZURE_OPENAI_DEPLOYMENT
    if not deployment:
        raise RuntimeError("AZURE_OPENAI_DEPLOYMENT not configured")

    completion = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )

    content = completion.choices[0].message.content
    return _extract_json(content)


