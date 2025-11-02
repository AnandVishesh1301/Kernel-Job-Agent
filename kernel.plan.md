# Kernel Job Agent MVP – End-to-End Plan

Citations: Kernel features (parallel sessions, persistence, live view, anti-bot) are leveraged per the product overview at [onkernel.com](https://www.onkernel.com/).

### Goals

- **Single-user MVP** that uploads resume, stores preferences, accepts job URLs, and runs multiple applications in parallel via **Kernel** browsers with persistence and live views.
- **FastAPI + LangGraph** backend using **uv** for Python deps.
- **Neon PostgreSQL** for structured data; **Cloudflare R2** for PDFs/screenshots.
- **Next.js** minimal dashboard.
- **Azure OpenAI GPT-5** to parse resume and derive user profile.

### Tech Stack

- **Backend**: Python 3.11+, FastAPI, LangGraph, SQLAlchemy (async) + Alembic, Pydantic, httpx, boto3 (S3-compatible for R2)
- **Kernel**: Kernel CLI preinstalled; one Kernel app with a single action to run Playwright flows; also direct on-demand browser sessions for debugging/live view
- **Playwright**: TypeScript snippets executed inside Kernel action(s)
- **DB**: PostgreSQL on Neon
- **Storage**: Cloudflare R2 (S3-compatible)
- **Frontend**: Next.js (App Router), Tailwind (optional)
- **Tracing**: LangSmith (optional)

### Repository Layout (your folders)

- `src/` (backend)
  - `app/main.py` – FastAPI app factory, lifespan, router mounts
  - `app/config.py` – pydantic `Settings` loading `.env`
  - `app/db.py` – async SQLAlchemy engine/session
  - `app/models.py` – SQLAlchemy models
  - `app/schemas.py` – Pydantic I/O models
  - `app/services/`
    - `storage_r2.py` – R2 client, `put_file`, `get_presigned_url`
    - `resume_parser.py` – Azure OpenAI GPT-5 resume parsing
    - `kernel_client.py` – invoke Kernel actions & create live-view sessions
    - `agent_graph.py` – LangGraph ReAct agent graph with conditional routing
    - `job_runner.py` – orchestrates graph runs; persistence; screenshots upload
    - `selectors/` – optional strategy helpers (e.g., `greenhouse.py`, `lever.py`, `workday.py`)
  - `app/routers/`
    - `resumes.py` – upload to R2, parse via GPT-5
    - `preferences.py` – CRUD for user preferences
    - `jobs.py` – create job entries, trigger runs, list status, artifacts
  - `alembic/` – migrations
  - `pyproject.toml` – managed by `uv`
- `kernel-app/` (Kernel app deployed via `@onkernel/cli`)
  - `actions/fill_job_form.ts` – main action: launches browser, navigates, fills forms, uploads files, screenshots
  - `package.json`, `tsconfig.json`
- `client/` (Next.js frontend)
  - `app/page.tsx` – dashboard: list jobs, statuses, links to live views/screenshots
  - `app/upload/page.tsx` – upload resume UI
  - `app/preferences/page.tsx` – set generic answers (gender, veteran, etc.)
  - `app/jobs/new/page.tsx` – submit job URL, pick resume, optional cover letter
  - `lib/api.ts` – typed client to FastAPI
- `.env.example` – all required variables
- `README.md`

### .env (Backend)

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT` (GPT-5 deployment name)
- `KERNEL_API_KEY`
- `LANGSMITH_API_KEY` (optional)
- `DATABASE_URL` (postgresql+asyncpg://...)
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- `R2_ACCOUNT_ID`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL` (if CDN) or `R2_ENDPOINT` (S3 endpoint)
- `KERNEL_APP_NAME` (e.g., job-filler)
- `KERNEL_ACTION_NAME` (e.g., fill_job_form)
- `ALLOWED_ORIGINS` (for CORS from Next.js)

### Database Schema (minimal MVP)

- `resumes`
  - `id` UUID PK
  - `r2_key` text (path in R2)
  - `file_name` text
  - `content_type` text
  - `parsed_profile` jsonb (from GPT-5)
  - `created_at` timestamptz
- `user_preferences`
  - `id` UUID PK (single row for MVP)
  - `data` jsonb (gender, veteran, etc.)
  - `updated_at` timestamptz
- `job_applications`
  - `id` UUID PK
  - `target_url` text
  - `resume_id` UUID FK
  - `cover_letter_r2_key` text null
  - `status` enum(text): queued|running|succeeded|failed
  - `kernel_session_id` text null (live view/persistence)
  - `persistence_id` text (stable across retries per-site)
  - `live_view_url` text null
  - `result_summary` text null
  - `error` text null
  - `created_at`, `updated_at` timestamptz
- `application_artifacts`
  - `id` UUID PK
  - `job_application_id` UUID FK
  - `type` text: screenshot|html|pdf
  - `r2_key` text
  - `created_at` timestamptz

### Kernel Integration

- Deploy `kernel-app/` with one action `fill_job_form` using Playwright.
- Action responsibilities:
  - Accept payload: `{ url, profile, prefs, r2Assets: { resumeUrl, coverLetterUrl? }, persistenceId, steps?, takeProofScreenshots }`
  - Create/reuse browser session with `persistenceId` (e.g., hash of domain + user)
  - Navigate → fill forms (generic selectors + domain-specific strategies for Greenhouse/Lever/Workday if detected)
  - Upload resume/cover letter using provided URLs (signed or public R2)
  - Take screenshots at critical checkpoints → upload back to R2 (signed PUT from backend or action uploads via signed URL)
  - Return `{ status, summary, liveViewUrl, screenshots: [...], notes }`
- For debugging, expose Live View for each run; store `liveViewUrl` in DB.
- Leverage Kernel features (parallel sessions, persistence, anti-bot, live view) described at [onkernel.com](https://www.onkernel.com/).

### LangGraph: ReAct + Conditional Routing

- **State**: `{ url, profile, prefs, assets, kernel, progress, errors }`
- **Nodes**:
  - `plan` – derive subgoals (login?, ATS type?, file requirements?)
  - `route` – detect ATS/domain and choose strategy (`generic`, `greenhouse`, `lever`, `workday`)
  - `apply_via_kernel` – call Kernel action with Playwright flow
  - `finalize` – summarize result, persist artifacts
  - `handle_error` – capture error details, mark failed
- **Edges**: `plan → route → apply_via_kernel → finalize`; errors → `handle_error`
- **Tools**: simple URL classifier, schema normalizer, R2 signed URL generator for uploads, Kernel invocation client
- **Parallelism**: FastAPI spawns async tasks per job; Kernel scales browsers in parallel.

### FastAPI Endpoints

- `POST /resumes` – multipart upload → R2; return `resume_id`
- `POST /resumes/{id}/parse` – run GPT-5 extraction → store in `parsed_profile`
- `GET /resumes` – list resumes
- `PUT /preferences` – upsert `user_preferences`
- `GET /preferences` – fetch preferences
- `POST /jobs` – create `job_application` with `{ url, resume_id, cover_letter? }`
- `POST /jobs/{id}/run` – trigger async LangGraph run; immediately return `{ id, status: running }`
- `GET /jobs` – list jobs with latest status
- `GET /jobs/{id}` – detail, including `live_view_url`, summary, errors
- `GET /jobs/{id}/artifacts` – list R2 artifact URLs

### Minimal Kernel Action (TypeScript) – shape

```ts
// actions/fill_job_form.ts (outline)
export default async function fill_job_form(input: Input) {
  const { url, profile, prefs, r2Assets, persistenceId, takeProofScreenshots } = input;
  const browser = await kernel.browser.create({ persistenceId, stealth: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // detect ATS → call strategy
  // strategy fills fields, uploads resume/cover letter, navigates steps
  // capture screenshots and return URLs
  return { status: 'succeeded', liveViewUrl: browser.liveViewUrl, screenshots: [], summary: 'Submitted' };
}
```

### R2 Integration

- Use `boto3` S3 client with `endpoint_url` pointing to R2.
- Backend generates short-lived signed URLs for Kernel action to read/write artifacts.
- Store only R2 keys in DB; derive public/CDN URL via `R2_PUBLIC_BASE_URL` when needed.

### Resume Parsing (Azure OpenAI GPT-5)

- Extract text from PDF (fallback to OCR if needed in future). Send chunks + system prompt to GPT-5 to produce a normalized JSON schema: `{ name, email, phone, links, education[], experience[], skills[], address, work_auth, ... }`.
- Store JSON in `resumes.parsed_profile`.

### Next.js Dashboard (MVP)

- Upload page: file picker → `POST /resumes` → show parse button → display parsed profile
- Preferences page: form for generic answers → `PUT /preferences`
- New Job page: inputs `{ url, resume }` (cover letter optional) → `POST /jobs` → `POST /jobs/{id}/run`
- Home page: list jobs, status pills, links to live view and artifacts

### Step-by-step Implementation (condensed)

1) Repo & environment

- Use existing folders: `src/` (backend), `client/` (frontend), `kernel-app/` (Kernel)
- Ensure tools installed: uv (done), Node 18+, pnpm/npm, Kernel CLI (done)
- Create `.env.example` from variables above; copy to `.env` locally
- Reference Kernel features: [onkernel.com](https://www.onkernel.com/)

2) Backend scaffold + DB + migrations (in `src/`)

- Create FastAPI app and modules under `src/app/`
- Add SQLAlchemy async models for the 4 tables; set `DATABASE_URL`
- Initialize Alembic and apply initial migration
- Expose routers: `/resumes`, `/preferences`, `/jobs`; enable CORS from `ALLOWED_ORIGINS`

3) Cloudflare R2 + resume upload

- Implement `storage_r2.py` with boto3 S3 client (R2 endpoint)
- `POST /resumes` to stream upload to R2 and persist DB row; `GET /resumes` to list

4) Resume parsing with Azure GPT-5

- Implement `resume_parser.py` (pdf text → GPT-5 → normalized JSON)
- `POST /resumes/{id}/parse` to store `parsed_profile`

5) Kernel app action and deploy (in `kernel-app/`)

- Scaffold `actions/fill_job_form.ts` with Playwright
- Implement generic flow + ATS stubs; use `persistenceId`
- `kernel deploy`; set `KERNEL_APP_NAME`/`KERNEL_ACTION_NAME` in `.env`

6) LangGraph orchestration + job API (in `src/`)

- Build ReAct graph `plan → route → apply_via_kernel → finalize` (+ `handle_error`)
- `kernel_client.py` to invoke action with signed R2 URLs for assets and proof uploads
- Job endpoints: create/run/status/artifacts; run graph via background tasks; save `live_view_url`

7) Frontend MVP (in `client/`)

- Create pages: upload, preferences, new job, dashboard; wire to API via `NEXT_PUBLIC_API_BASE_URL`
- Show job statuses with links to live view and artifact URLs

8) Test, parallelism, persistence, hardening

- Run backend (uvicorn) and frontend (next dev); smoke-test: upload → parse → two jobs in parallel
- Ensure `persistenceId` per domain; backoff on transient errors; basic logging, validation, and CORS