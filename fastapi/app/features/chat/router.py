import json
from asyncio import Lock
from collections.abc import AsyncIterator
from typing import Literal
from uuid import UUID, uuid4

from app.core.config import settings
from openai import APIError, APITimeoutError, AsyncOpenAI
from openai.types.responses import Response, ResponseInputParam
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/chat", tags=["chat"])
MODEL = "openai/gpt-oss-120b"
TIMEOUT_MESSAGE = "Groq tardó demasiado en responder."
PROVIDER_ERROR_MESSAGE = "No se pudo obtener una respuesta de Groq."


class ChatRequest(BaseModel):
    prompt: str
    conversation_id: UUID | None = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class TokenUsage(BaseModel):
    input_tokens: int
    output_tokens: int
    total_tokens: int


class ChatResponse(BaseModel):
    conversation_id: UUID
    messages: list[ChatMessage]
    usage: TokenUsage | None = None


class Conversation:
    def __init__(self) -> None:
        self.messages: list[ChatMessage] = []
        self.lock = Lock()


_conversations: dict[UUID, Conversation] = {}


def _groq_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=settings.GROQ_API_KEY,
        timeout=30,
        max_retries=0,
    )


def _model_input(messages: list[ChatMessage]) -> ResponseInputParam:
    return [
        {"role": "system", "content": "Eres un asistente amigable y conversacional"},
        *({"role": message.role, "content": message.content} for message in messages),
    ]


async def _generate_reply(messages: list[ChatMessage]) -> Response:
    try:
        async with _groq_client() as client:
            return await client.responses.create(
                model=MODEL,
                input=_model_input(messages),
            )
    except APITimeoutError as exc:
        raise HTTPException(504, TIMEOUT_MESSAGE) from exc
    except APIError as exc:
        raise HTTPException(502, PROVIDER_ERROR_MESSAGE) from exc


def _complete_turn(
    conversation_id: UUID,
    conversation: Conversation,
    user_message: ChatMessage,
    response: Response,
) -> ChatResponse:
    messages = [
        *conversation.messages,
        user_message,
        ChatMessage(role="assistant", content=response.output_text),
    ]
    usage = response.usage
    result = ChatResponse(
        conversation_id=conversation_id,
        messages=messages,
        usage=(
            TokenUsage(
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                total_tokens=usage.total_tokens,
            )
            if usage is not None
            else None
        ),
    )
    conversation.messages = messages
    _conversations[conversation_id] = conversation
    return result


def _get_conversation(conversation_id: UUID | None) -> tuple[UUID, Conversation]:
    if conversation_id is None:
        return uuid4(), Conversation()

    conversation = _conversations.get(conversation_id)
    if conversation is None:
        raise HTTPException(404, "Conversación no encontrada.")
    return conversation_id, conversation


@router.post("/")
async def chat(request: ChatRequest) -> ChatResponse:
    if request.conversation_id is None:
        if request.prompt == "/history":
            raise HTTPException(
                422, "Indica el conversation_id para consultar el historial."
            )
        if request.prompt == "/reset":
            raise HTTPException(
                422, "Indica el conversation_id para reiniciar la conversación."
            )

    conversation_id, conversation = _get_conversation(request.conversation_id)
    async with conversation.lock:
        if request.prompt == "/reset":
            conversation.messages.clear()
        elif request.prompt != "/history":
            user_message = ChatMessage(role="user", content=request.prompt)
            response = await _generate_reply([*conversation.messages, user_message])
            return _complete_turn(conversation_id, conversation, user_message, response)

        return ChatResponse(
            conversation_id=conversation_id,
            messages=conversation.messages,
        )


def _sse(data: dict[str, object]) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _stream_turn(
    conversation_id: UUID,
    conversation: Conversation,
    user_message: ChatMessage,
) -> AsyncIterator[str]:
    yield ": connected\n\n"
    completed: Response | None = None
    result: ChatResponse | None = None
    try:
        async with conversation.lock:
            messages = [*conversation.messages, user_message]
            async with _groq_client() as client:
                stream = await client.responses.create(
                    model=MODEL,
                    input=_model_input(messages),
                    stream=True,
                )
                async with stream as events:
                    async for event in events:
                        if event.type == "response.output_text.delta":
                            yield _sse({"type": "delta", "text": event.delta})
                        elif event.type == "response.completed":
                            completed = event.response
                            break
                        elif event.type in (
                            "response.failed", "response.incomplete", "error"
                        ):
                            break

            if completed is not None:
                result = _complete_turn(
                    conversation_id, conversation, user_message, completed
                )
    except APITimeoutError:
        yield _sse({"type": "error", "message": TIMEOUT_MESSAGE})
        return
    except APIError:
        yield _sse({"type": "error", "message": PROVIDER_ERROR_MESSAGE})
        return

    if result is None:
        yield _sse({"type": "error", "message": "La respuesta de Groq se interrumpió."})
    else:
        yield _sse({"type": "done", **result.model_dump(mode="json")})


@router.post(
    "/stream",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {}}}},
)
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    if request.prompt in ("/history", "/reset"):
        raise HTTPException(
            422, "Usa la ruta JSON para consultar o reiniciar el historial."
        )

    conversation_id, conversation = _get_conversation(request.conversation_id)
    user_message = ChatMessage(role="user", content=request.prompt)
    return StreamingResponse(
        _stream_turn(conversation_id, conversation, user_message),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
