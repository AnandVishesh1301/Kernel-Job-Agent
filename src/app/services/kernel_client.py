from __future__ import annotations

import asyncio
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

    async def invoke_fill_job_form(self, payload: Dict[str, Any], *, timeout_s: int = 120) -> Dict[str, Any]:
        # Create async invocation and poll status until completion or timeout
        inv = self._kernel.invocations.create(
            action_name=self._action_name,
            app_name=self._app_name,
            async_=True,
            payload=payload,
        )
        inv_id = inv.id

        deadline = asyncio.get_event_loop().time() + timeout_s
        status = None
        while asyncio.get_event_loop().time() < deadline:
            stat = self._kernel.invocations.get_status(invocation_id=inv_id)
            status = stat.status
            if status in ("succeeded", "failed", "cancelled"):
                break
            await asyncio.sleep(2)

        if status != "succeeded":
            # Attempt to fetch error details
            try:
                res = self._kernel.invocations.get_result(invocation_id=inv_id)
                return {"status": status or "unknown", "result": res}
            except Exception as e:  # noqa: BLE001
                raise RuntimeError(f"Kernel invocation failed: status={status}, id={inv_id}") from e

        res = self._kernel.invocations.get_result(invocation_id=inv_id)
        return res


