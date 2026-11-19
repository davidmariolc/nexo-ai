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

const readChatResponse = (
  data: unknown,
  minimumMessages = 2
): ChatSuccess | ChatFailure =>
  isChatResponse(data, minimumMessages)
    ? {
        id: data.conversation_id,
        messages: data.messages,
        status: "success",
        usage: isTokenUsage(data.usage) ? data.usage : null,
      }
    : unexpectedReply;

const isMissingStreamRoute = async (response: Response): Promise<boolean> => {
  if (response.status !== 404) {
    return false;
  }

  const data: unknown = await response.json().catch(() => null);
  return (
    typeof data === "object" &&
    data !== null &&
    "detail" in data &&
    data.detail === "Not Found"
  );
};

const readChatStream = async (
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
  refreshTimeout: () => void
): Promise<ChatSuccess | ChatFailure> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Stream chunks must be read in order.
      const { done, value } = await reader.read();
      if (done) {
        return {
          message: "La respuesta se interrumpió. Intenta enviar de nuevo.",
          status: "failed",
        };
      }

      refreshTimeout();
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/u);
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        if (!frame.startsWith("data: ")) {
          continue;
        }

        let event: unknown;
        try {
          event = JSON.parse(frame.slice(6));
        } catch {
          return unexpectedReply;
        }

        if (typeof event !== "object" || event === null || !("type" in event)) {
          return unexpectedReply;
        }

        if (
          event.type === "delta" &&
          "text" in event &&
          typeof event.text === "string"
        ) {
          onDelta(event.text);
          continue;
        }

        if (event.type === "done") {
          return readChatResponse(event);
        }

        if (
          event.type === "error" &&
          "message" in event &&
          typeof event.message === "string"
        ) {
          return { message: event.message, status: "failed" };
        }

        return unexpectedReply;
      }
    }
  } finally {
    reader.releaseLock();
  }
};

export const sendChatMessage = async (
  prompt: string,
  conversationId: string | null,
  onDelta?: (text: string) => void
): Promise<ChatSuccess | ChatFailure> => {
  const isCommand = isChatCommand(prompt);
  const controller = new AbortController();
  let timeout: number | undefined;
  const refreshTimeout = () => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => controller.abort(), 45_000);
  };
  const request = {
    body: JSON.stringify({ conversation_id: conversationId, prompt }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal: controller.signal,
  };

  refreshTimeout();
  try {
    let response = isCommand
      ? await fetch("/api/v1/chat/", request)
      : await fetch("/api/v1/chat/stream", {
          ...request,
          headers: { ...request.headers, Accept: "text/event-stream" },
        });

    if (!isCommand && (await isMissingStreamRoute(response))) {
      refreshTimeout();
      response = await fetch("/api/v1/chat/", request);
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

    const contentType = response.headers.get("Content-Type");
    if (contentType?.startsWith("application/json")) {
      const data: unknown = await response.json().catch(() => null);
      return readChatResponse(data, isCommand ? 0 : 2);
    }

    if (
      onDelta &&
      response.body &&
      contentType?.startsWith("text/event-stream")
    ) {
      return await readChatStream(response.body, onDelta, refreshTimeout);
    }

    return unexpectedReply;
  } catch {
    return {
      message: "No se pudo conectar con Nexo. Intenta enviar de nuevo.",
      status: "failed",
    };
  } finally {
    window.clearTimeout(timeout);
    controller.abort();
  }
};
