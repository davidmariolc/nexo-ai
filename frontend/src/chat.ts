export interface ChatMessage {
  content: string;
  role: "user" | "assistant";
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

interface ChatResponse {
  conversation_id: string;
  messages: ChatMessage[];
  usage?: unknown;
}

export interface ChatFailure {
  message: string;
  status: "expired" | "failed";
}

interface ChatSuccess {
  id: string;
  messages: ChatMessage[];
  status: "success";
  usage: TokenUsage | null;
}

export const isChatCommand = (prompt: string) =>
  prompt === "/reset" || prompt === "/history";

const isChatMessage = (value: unknown): value is ChatMessage =>
  typeof value === "object" &&
  value !== null &&
  "role" in value &&
  (value.role === "user" || value.role === "assistant") &&
  "content" in value &&
  typeof value.content === "string";

const isChatResponse = (
  value: unknown,
  minimumMessages: number
): value is ChatResponse =>
  typeof value === "object" &&
  value !== null &&
  "conversation_id" in value &&
  typeof value.conversation_id === "string" &&
  value.conversation_id.length > 0 &&
  "messages" in value &&
  Array.isArray(value.messages) &&
  value.messages.length >= minimumMessages &&
  value.messages.every(isChatMessage);

const isTokenCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isTokenUsage = (value: unknown): value is TokenUsage =>
  typeof value === "object" &&
  value !== null &&
  "input_tokens" in value &&
  isTokenCount(value.input_tokens) &&
  "output_tokens" in value &&
  isTokenCount(value.output_tokens) &&
  "total_tokens" in value &&
  isTokenCount(value.total_tokens);

const unexpectedReply: ChatFailure = {
  message:
    "La respuesta no llegó en el formato esperado. Intenta enviar de nuevo.",
  status: "failed",
};

export const sendChatMessage = async (
  prompt: string,
  conversationId: string | null
): Promise<ChatSuccess | ChatFailure> => {
  const isCommand = isChatCommand(prompt);
  let response: Response;

  try {
    response = await fetch("/api/v1/chat/", {
      body: JSON.stringify({ conversation_id: conversationId, prompt }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(40_000),
    });
  } catch {
    return {
      message: "No se pudo conectar con Nexo. Intenta enviar de nuevo.",
      status: "failed",
    };
  }

  if (response.status === 404 && conversationId) {
    return {
      message:
        "Esta conversación expiró. Selecciona «Nuevo chat» para continuar.",
      status: "expired",
    };
  }

  if (!response.ok) {
    return {
      message: isCommand
        ? "No se pudo ejecutar el comando. Intenta enviarlo de nuevo."
        : "Nexo no pudo responder. Intenta enviar de nuevo.",
      status: "failed",
    };
  }

  try {
    const data: unknown = await response.json();
    if (isChatResponse(data, isCommand ? 0 : 2)) {
      return {
        id: data.conversation_id,
        messages: data.messages,
        status: "success",
        usage: isTokenUsage(data.usage) ? data.usage : null,
      };
    }
  } catch {
    return unexpectedReply;
  }

  return unexpectedReply;
};
