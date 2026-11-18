from fastapi import APIRouter, Depends

from app.features.items import service
from app.features.items.dependencies import get_timestamp

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/")
def read_items(timestamp: str = Depends(get_timestamp)):
    items = service.list_items()
    return {
        "data": items,
        "total": len(items),
        "timestamp": timestamp,
    }


@router.get("/{item_id}")
def read_item(item_id: int, timestamp: str = Depends(get_timestamp)):
    return {
        "item": service.get_item(item_id),
        "timestamp": timestamp,
    }
