from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_ignore_empty=True,
        extra="ignore",
        env_file=".env.local",
        env_file_encoding="utf-8"
    )

    PROJECT_NAME: str = "Vercel + FastAPI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    GROQ_API_KEY: str
    FRONTEND_URL: str

settings = Settings()
