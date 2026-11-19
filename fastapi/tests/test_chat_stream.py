import json
from contextlib import aclosing, asynccontextmanager
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from fastapi.testclient import TestClient

with patch.dict(
    "os.environ",
    {"GROQ_API_KEY": "test-key", "FRONTEND_URL": "http://localhost"},
):
    from app.features.chat import router as chat_module
    from app.main import app


REPLY = "Hola 🌿\n"
USAGE = {"input_tokens": 8, "output_tokens": 4, "total_tokens": 12}


@asynccontextmanager
async def fake_groq(*, completed: bool):
    response = SimpleNamespace(output_text=REPLY, usage=SimpleNamespace(**USAGE))

    async def events():
        yield SimpleNamespace(type="response.reasoning_text.delta", delta="private")
        yield SimpleNamespace(type="response.output_text.delta", delta="Hola ")
        yield SimpleNamespace(type="response.output_text.delta", delta="🌿\n")
        if completed:
            yield SimpleNamespace(type="response.completed", response=response)

    async def create(*, model, input, stream=False):
        return aclosing(events()) if stream else response

    yield SimpleNamespace(responses=SimpleNamespace(create=create))


def stream_events(response):
    return [
        json.loads(frame.removeprefix("data: "))
        for frame in response.text.split("\n\n")
        if frame.startswith("data: ")
    ]


class ChatStreamTests(TestCase):
    def test_completed_turn_is_available_to_json_callers(self):
        with (
            patch.object(
                chat_module, "_groq_client", side_effect=lambda: fake_groq(completed=True)
            ),
            TestClient(app) as client,
        ):
            reply = client.post("/api/v1/chat/stream", json={"prompt": "Hola"})
            self.assertEqual(reply.status_code, 200)
            self.assertIn("text/event-stream", reply.headers["content-type"])
            events = stream_events(reply)
            self.assertEqual(
                events[:-1],
                [
                    {"type": "delta", "text": "Hola "},
                    {"type": "delta", "text": "🌿\n"},
                ],
            )
            final = events[-1]
            self.assertEqual(final["type"], "done")
            self.assertEqual(final["usage"], USAGE)
            self.assertEqual(final["messages"][-1]["content"], REPLY)

            conversation_id = final["conversation_id"]
            continued = client.post(
                "/api/v1/chat/",
                json={"prompt": "Continúa", "conversation_id": conversation_id},
            ).json()
            self.assertEqual(continued["conversation_id"], conversation_id)
            self.assertEqual(continued["messages"][:2], final["messages"])
            self.assertEqual(len(continued["messages"]), 4)

    def test_interrupted_turn_does_not_modify_history(self):
        with (
            patch.object(
                chat_module, "_groq_client", side_effect=lambda: fake_groq(completed=False)
            ),
            TestClient(app) as client,
        ):
            original = client.post("/api/v1/chat/", json={"prompt": "Hola"}).json()
            conversation_id = original["conversation_id"]
            interrupted = client.post(
                "/api/v1/chat/stream",
                json={"prompt": "Continúa", "conversation_id": conversation_id},
            )
            self.assertEqual(
                [event["type"] for event in stream_events(interrupted)],
                ["delta", "delta", "error"],
            )
            history = client.post(
                "/api/v1/chat/",
                json={"prompt": "/history", "conversation_id": conversation_id},
            ).json()
            self.assertEqual(history["messages"], original["messages"])
