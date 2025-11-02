from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_allowed_origins, get_settings
from .routers import jobs as jobs_router
from .routers import preferences as preferences_router
from .routers import resumes as resumes_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_allowed_origins(settings),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(resumes_router.router)
    app.include_router(preferences_router.router)
    app.include_router(jobs_router.router)

    return app


app = create_app()


