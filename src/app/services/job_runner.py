from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional
from urllib.parse import urlparse
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import SessionLocal
from ..models import JobApplication, Resume, JobStatus, UserPreferences
from ..services.agent_graph import build_graph, AgentState
from ..services.kernel_client import KernelClient
from ..services.storage_r2 import get_presigned_get_url


async def run_job(job_id: str) -> None:
    # Create independent session for background task
    async with SessionLocal() as db:
        await _run_job_with_session(db, job_id)


async def _run_job_with_session(db: AsyncSession, job_id: str) -> None:
    # Load job + resume
    job_uuid = uuid.UUID(job_id)
    stmt = select(JobApplication).where(JobApplication.id == job_uuid)
    res = await db.execute(stmt)
    job = res.scalars().first()
    if not job:
        return

    job.status = JobStatus.running
    await db.commit()

    stmt_r = select(Resume).where(Resume.id == job.resume_id)
    res_r = await db.execute(stmt_r)
    resume = res_r.scalars().first()
    if not resume:
        job.status = JobStatus.failed
        job.error = "Resume not found"
        await db.commit()
        return

    # Build graph
    graph = build_graph()

    async def apply_via_kernel(state: AgentState) -> AgentState:
        kernel = KernelClient()
        resume_url = get_presigned_get_url(resume.r2_key)
        # Load preferences (single row MVP)
        prefs_stmt = select(UserPreferences).limit(1)
        prefs_res = await db.execute(prefs_stmt)
        prefs_row = prefs_res.scalars().first()
        prefs_data: Dict[str, Any] = (prefs_row.data if prefs_row else {})
        domain = urlparse(job.target_url).netloc
        payload: Dict[str, Any] = {
            "url": job.target_url,
            "profile": resume.parsed_profile or {},
            "prefs": prefs_data,
            "r2Assets": {"resumeUrl": resume_url},
            "persistenceId": f"{domain}:single-user",
            "takeProofScreenshots": True,
        }
        result = await kernel.invoke_fill_job_form(payload)
        state["kernel_result"] = result
        return state

    def finalize(state: AgentState) -> AgentState:
        result = state.get("kernel_result", {}) or {}
        # Update DB with results
        try:
            job.status = JobStatus.succeeded

            def safe_get(d: dict | None, key: str) -> str | None:
                if isinstance(d, dict):
                    v = d.get(key)
                    return v if isinstance(v, str) and v else None
                return None

            # unwrap common nesting patterns
            nested_result = result.get("result") if isinstance(result, dict) else None
            output = nested_result.get("output") if isinstance(nested_result, dict) else None

            # summary
            job.result_summary = (
                safe_get(result if isinstance(result, dict) else None, "summary")
                or safe_get(nested_result if isinstance(nested_result, dict) else None, "summary")
                or safe_get(output if isinstance(output, dict) else None, "summary")
            )

            # live view url
            job.live_view_url = (
                safe_get(result if isinstance(result, dict) else None, "liveViewUrl")
                or safe_get(result if isinstance(result, dict) else None, "browser_live_view_url")
                or safe_get(result if isinstance(result, dict) else None, "live_view_url")
                or safe_get(nested_result if isinstance(nested_result, dict) else None, "liveViewUrl")
                or safe_get(nested_result if isinstance(nested_result, dict) else None, "browser_live_view_url")
                or safe_get(nested_result if isinstance(nested_result, dict) else None, "live_view_url")
                or safe_get(output if isinstance(output, dict) else None, "liveViewUrl")
                or safe_get(output if isinstance(output, dict) else None, "browser_live_view_url")
                or safe_get(output if isinstance(output, dict) else None, "live_view_url")
            )
            job.error = None
        except Exception as e:  # noqa: BLE001
            job.status = JobStatus.failed
            job.error = str(e)
        return state

    def handle_error(state: AgentState) -> AgentState:
        job.status = JobStatus.failed
        job.error = "Graph execution failed"
        return state

    graph.add_node("apply_via_kernel", apply_via_kernel)
    graph.add_node("finalize", finalize)
    graph.add_node("handle_error", handle_error)

    graph.set_entry_point("plan")
    graph.add_edge("plan", "route")
    graph.add_edge("route", "apply_via_kernel")
    graph.add_edge("apply_via_kernel", "finalize")
    # Compile graph to executable app that supports async invocation
    app = graph.compile()

    try:
        await app.ainvoke(AgentState({"url": job.target_url}))
        await db.commit()
    except Exception as e:  # noqa: BLE001
        job.status = JobStatus.failed
        job.error = str(e)
        await db.commit()


