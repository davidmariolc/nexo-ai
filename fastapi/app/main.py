from fastapi import FastAPI

from app.core.config import settings
from app.router import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_NAME,
    version=settings.VERSION,
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def read_root():
    return {"name": settings.PROJECT_NAME, "version": settings.VERSION}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=5001, reload=True)
