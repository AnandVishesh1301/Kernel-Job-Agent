from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Optional

from ..config import get_settings


class KernelClient:
    def __init__(self) -> None:
        # Kernel Python SDK reads KERNEL_API_KEY from env by default.
        # Import inside to avoid mandatory dependency during import cycle.
        from kernel import Kernel  # type: ignore

        settings = get_settings()
        # The SDK uses env; constructing without args is sufficient.
        self._kernel = Kernel()
        self._app_name = settings.KERNEL_APP_NAME or "kernel-job-agent"
        self._action_name = settings.KERNEL_ACTION_NAME or "fill_job_form"
        self._app_version = settings.KERNEL_APP_VERSION or "latest"

    async def invoke_fill_job_form(self, payload: Dict[str, Any], *, timeout_s: int = 120) -> Dict[str, Any]:
        # Create async invocation and poll until completion or timeout
        inv = self._kernel.invocations.create(
            action_name=self._action_name,
            app_name=self._app_name,
            version=self._app_version,
            async_=True,
            payload=json.dumps(payload),
        )
        inv_id = inv.id

        deadline = asyncio.get_event_loop().time() + timeout_s
        status: Optional[str] = None
        # Determine available SDK methods for status/result
        get_status_fn = getattr(self._kernel.invocations, "get_status", None)
        get_fn = getattr(self._kernel.invocations, "get", None)
        get_result_fn = getattr(self._kernel.invocations, "get_result", None)

        while asyncio.get_event_loop().time() < deadline:
            try:
                if callable(get_status_fn):
                    stat = get_status_fn(invocation_id=inv_id)
                    status = getattr(stat, "status", None) or (stat.get("status") if isinstance(stat, dict) else None)
                elif callable(get_fn):
                    info = get_fn(invocation_id=inv_id)
                    status = getattr(info, "status", None) or (info.get("status") if isinstance(info, dict) else None)
                else:
                    # Fallback: attempt result directly; if not ready, SDK should raise
                    if callable(get_result_fn):
                        res_try = get_result_fn(invocation_id=inv_id)
                        return res_try

                if status in ("succeeded", "failed", "cancelled"):
                    break
            except Exception:
                # Ignore transient errors while polling
                pass
            await asyncio.sleep(2)

        # Retrieve final result or error
        if callable(get_result_fn):
            try:
                raw = get_result_fn(invocation_id=inv_id)
                # Normalize SDK variants into { status, result }
                normalized: Dict[str, Any] = {"status": status or "succeeded", "result": None}
                if isinstance(raw, dict):
                    if "output" in raw:  # common SDK envelope { status, output }
                        normalized["status"] = raw.get("status") or normalized["status"]
                        normalized["result"] = raw.get("output")
                    elif "result" in raw and "status" in raw:
                        normalized = {"status": raw.get("status"), "result": raw.get("result")}
                    else:
                        # treat dict as the action's output body
                        normalized["result"] = raw
                else:
                    # Non-dict outputs (unlikely) are wrapped directly
                    normalized["result"] = raw
                return normalized
            except Exception as e:  # noqa: BLE001
                raise RuntimeError(f"Kernel invocation failed: status={status}, id={inv_id}") from e

        # Last resort: return known status
        return {"status": status or "unknown", "result": None}


