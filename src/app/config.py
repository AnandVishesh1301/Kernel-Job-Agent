from functools import lru_cache
from typing import List, Optional

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )
    # Core
    APP_NAME: str = "Kernel Job Agent"
    DEBUG: bool = False

    # CORS
    ALLOWED_ORIGINS: str = "*"

    # Database (PostgreSQL + asyncpg)
    DATABASE_URL: str

    # Cloudflare R2 (support multiple env naming styles)
    R2_ACCESS_KEY_ID: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("R2_ACCESS_KEY_ID", "r2_access_key", "R2_ACCESS_KEY"),
    )
    R2_SECRET_ACCESS_KEY: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("R2_SECRET_ACCESS_KEY", "r2_secret_key", "R2_SECRET_KEY"),
    )
    R2_ACCOUNT_ID: Optional[str] = None
    R2_BUCKET: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("R2_BUCKET", "r2_bucket_name", "r2_bucket"),
    )
    R2_PUBLIC_BASE_URL: Optional[str] = None
    R2_ENDPOINT: Optional[str] = None

    # Azure OpenAI
    AZURE_OPENAI_ENDPOINT: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("AZURE_OPENAI_ENDPOINT", "azure_openai_endpoint")
    )
    AZURE_OPENAI_API_KEY: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("AZURE_OPENAI_API_KEY", "azure_openai_api", "AZURE_OPENAI_KEY"),
    )
    AZURE_OPENAI_DEPLOYMENT: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("AZURE_OPENAI_DEPLOYMENT", "azure_openai_deployment_name")
    )
    AZURE_OPENAI_API_VERSION: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("AZURE_OPENAI_API_VERSION", "azure_openai_api_version")
    )

    # Kernel
    KERNEL_API_KEY: Optional[str] = None
    KERNEL_APP_NAME: Optional[str] = None
    KERNEL_ACTION_NAME: Optional[str] = None

    # Optional tracing
    LANGSMITH_API_KEY: Optional[str] = None

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def get_allowed_origins(settings: Settings) -> List[str]:
    raw = (settings.ALLOWED_ORIGINS or "").strip()
    if not raw:
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


