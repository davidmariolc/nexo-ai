def list_items() -> list[dict[str, int | str]]:
    return [get_item(item_id) for item_id in range(1, 4)]


def get_item(item_id: int) -> dict[str, int | str]:
    return {
        "id": item_id,
        "name": f"Sample Item {item_id}",
        "value": item_id * 100,
    }
