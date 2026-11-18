from threading import Lock
from typing import Literal
from uuid import UUID, uuid4

from app.core.config import settings
from openai import APIError, APITimeoutError, OpenAI
from openai.types.responses import ResponseInputParam
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    prompt: str
    conversation_id: UUID | None = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatResponse(BaseModel):
    conversation_id: UUID
    messages: list[ChatMessage]


class Conversation:
    def __init__(self) -> None:
        self.messages: list[ChatMessage] = []
        self.lock = Lock()


_conversations: dict[UUID, Conversation] = {}
_conversations_lock = Lock()


def _generate_reply(messages: list[ChatMessage]) -> str:
    input_messages: ResponseInputParam = [
        {"role": "system", "content": "Eres un asistente amigable y conversacional"},
        *({"role": message.role, "content": message.content} for message in messages),
    ]

    try:
        with OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=settings.GROQ_API_KEY,
            timeout=30,
            max_retries=0,
        ) as client:
            response = client.responses.create(
                model="openai/gpt-oss-120b",
                input=input_messages,
            )
            return response.output_text
    except APITimeoutError as exc:
        raise HTTPException(504, "Groq tardó demasiado en responder.") from exc
    except APIError as exc:
        raise HTTPException(502, "No se pudo obtener una respuesta de Groq.") from exc


@router.post("/")
def chat(request: ChatRequest) -> ChatResponse:
    conversation_id = request.conversation_id
    if conversation_id is None:
        if request.prompt == "/history":
            raise HTTPException(
                422, "Indica el conversation_id para consultar el historial."
            )
        conversation_id = uuid4()
        conversation = Conversation()
    else:
        with _conversations_lock:
            conversation = _conversations.get(conversation_id)
        if conversation is None:
            raise HTTPException(404, "Conversación no encontrada.")

    with conversation.lock:
        if request.prompt != "/history":
            user_message = ChatMessage(role="user", content=request.prompt)
            reply = _generate_reply([*conversation.messages, user_message])
            conversation.messages.extend(
                [user_message, ChatMessage(role="assistant", content=reply)]
            )
        result = ChatResponse(
            conversation_id=conversation_id, messages=conversation.messages
        )

    if request.conversation_id is None:
        with _conversations_lock:
            _conversations[conversation_id] = conversation

    return result
