from app.features.chat.router import router as chat_router
from app.features.items.router import router as items_router
from fastapi import APIRouter

api_router = APIRouter()
api_router.include_router(items_router)
api_router.include_router(chat_router)
