from app.core.config import settings
from openai import APIError, APITimeoutError, OpenAI
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    prompt: str


class ChatResponse(BaseModel):
    message: str


@router.post("/")
def chat(request: ChatRequest):
    try:
        with OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=settings.GROQ_API_KEY,
            timeout=30,
            max_retries=0,
        ) as client:
            messages = [
                {
                    "role": "system",
                    "content": "Eres un asistente amigable y conversacional",
                },
            ]

            messages.append({"role": "user", "content": request.prompt})

            response = client.responses.create(
                model="openai/gpt-oss-120b",
                input=messages,
            )

    except APITimeoutError as exc:
        raise HTTPException(504, "Groq tardó demasiado en responder.") from exc
    except APIError as exc:
        raise HTTPException(502, "No se pudo obtener una respuesta de Groq.") from exc
    messages.append({"role": "assistant", "content": response.output_text})
    return messages
