import type { KeyboardEvent, SubmitEvent, UIEvent } from "react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

import type { ChatFailure, ChatMessage, TokenUsage } from "./chat.ts";
import { sendChatMessage } from "./chat.ts";

import "./App.css";

const suggestions = [
  {
    label: "Explorar una idea",
    prompt: "Ayúdame a pensar en tres ideas para un proyecto personal.",
  },
  {
    label: "Entender un tema",
    prompt:
      "Explícame cómo funciona la inteligencia artificial con un ejemplo.",
  },
  {
    label: "Empezar a escribir",
    prompt: "Ayúdame a escribir un correo breve para presentar una idea.",
  },
];

interface DisplayMessage extends ChatMessage {
  id: number;
  usage: TokenUsage | null;
}

interface Conversation {
  id: string | null;
  messages: DisplayMessage[];
}

const emptyConversation: Conversation = { id: null, messages: [] };
const tokenCount = new Intl.NumberFormat("es-PE");

const TokenUsageDetails = ({ usage }: { usage: TokenUsage }) => (
  <details className="token-usage">
    <summary className="token-usage-trigger">
      <span>
        <strong>{tokenCount.format(usage.total_tokens)}</strong> tokens
      </span>
      <span aria-hidden="true" className="token-usage-chevron" />
    </summary>
    <div className="token-usage-panel">
      <div aria-hidden="true" className="token-usage-bar">
        <span
          className="token-usage-input"
          style={{ flexGrow: usage.input_tokens }}
        />
        <span
          className="token-usage-output"
          style={{ flexGrow: usage.output_tokens }}
        />
      </div>
      <dl className="token-usage-breakdown">
        <div className="token-usage-input">
          <dt>Entrada</dt>
          <dd>{tokenCount.format(usage.input_tokens)}</dd>
        </div>
        <div className="token-usage-output">
          <dt>Salida</dt>
          <dd>{tokenCount.format(usage.output_tokens)}</dd>
        </div>
      </dl>
    </div>
  </details>
);

const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
  if (
    event.key !== "Enter" ||
    event.shiftKey ||
    event.nativeEvent.isComposing
  ) {
    return;
  }

  event.preventDefault();
  if (!event.repeat) {
    event.currentTarget.form?.requestSubmit();
  }
};

const App = () => {
  const [conversation, setConversation] = useState(emptyConversation);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<DisplayMessage | null>(null);
  const [error, setError] = useState<ChatFailure | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const thread = useRef<HTMLElement>(null);
  const threadContent = useRef<HTMLDivElement>(null);
  const followThread = useRef(true);
  const nextMessageId = useRef(0);
  const sending = useRef(false);

  const isPending = pending !== null;
  const isExpired = error?.status === "expired";
  const hasMessages = conversation.messages.length > 0 || isPending;
  const canSend = draft.trim().length > 0 && !isPending && !isExpired;
  const visibleMessages = pending
    ? [...conversation.messages, pending]
    : conversation.messages;

  useEffect(() => {
    const container = thread.current;
    const content = threadContent.current;
    if (!(hasMessages && container && content)) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (followThread.current) {
        container.scrollTop = container.scrollHeight;
      }
    });
    observer.observe(container);
    observer.observe(content);
    return () => observer.disconnect();
  }, [hasMessages]);

  const handleThreadScroll = (event: UIEvent<HTMLElement>) => {
    const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
    followThread.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  const focusComposer = () => {
    composer.current?.focus({ preventScroll: true });
  };

  const updateDraft = (value: string) => {
    setDraft(value);
    if (!isExpired) {
      setError(null);
    }
  };

  const startNewChat = () => {
    if (sending.current) {
      return;
    }

    followThread.current = true;
    setConversation(emptyConversation);
    setDraft(isExpired ? draft : "");
    setError(null);
    focusComposer();
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend || sending.current) {
      return;
    }

    const prompt = draft.trim();
    if (prompt === "/reset" || prompt === "/history") {
      setError({
        message:
          "Escribe una pregunta o usa «Nuevo chat» para volver a empezar.",
        status: "failed",
      });
      focusComposer();
      return;
    }

    sending.current = true;
    followThread.current = true;
    nextMessageId.current += 1;
    const outgoing: DisplayMessage = {
      content: prompt,
      id: nextMessageId.current,
      role: "user",
      usage: null,
    };
    const expectedMessages = [...conversation.messages, outgoing];
    focusComposer();
    setDraft("");
    setError(null);
    setPending(outgoing);

    const result = await sendChatMessage(prompt, conversation.id);
    sending.current = false;
    setPending(null);
    if (result.status !== "success") {
      setDraft(draft);
      setError(result);
      return;
    }

    const replyPosition = result.messages.length - 1;
    setConversation({
      id: result.id,
      messages: result.messages.map((message, position) => {
        const previous = expectedMessages[position];
        if (
          previous?.role === message.role &&
          previous.content === message.content
        ) {
          return previous;
        }

        nextMessageId.current += 1;
        return {
          ...message,
          id: nextMessageId.current,
          usage:
            position === replyPosition && message.role === "assistant"
              ? result.usage
              : null,
        };
      }),
    });
  };

  return (
    <div className="chat-shell">
      <header className="chat-header">
        <div className="brand">
          <span aria-hidden="true" className="brand-mark">
            n
          </span>
          <span>Nexo AI</span>
        </div>
        <button
          className="new-chat pressable"
          disabled={isPending}
          onClick={startNewChat}
          type="button"
        >
          <span aria-hidden="true">+</span>
          Nuevo chat
        </button>
      </header>

      <main
        className={hasMessages ? "chat-main chat-main--active" : "chat-main"}
      >
        {hasMessages ? (
          <section
            aria-labelledby="conversation-heading"
            className="thread"
            onScroll={handleThreadScroll}
            ref={thread}
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll the transcript.
            tabIndex={0}
          >
            <h1 className="sr-only" id="conversation-heading">
              Conversación con Nexo
            </h1>
            <div
              aria-label="Mensajes"
              className="thread-inner column"
              ref={threadContent}
              role="log"
            >
              <ol className="message-list">
                {visibleMessages.map((message) => (
                  <li
                    className={`message message--${message.role}`}
                    key={message.id}
                  >
                    {message.role === "user" ? (
                      <p>
                        <span className="sr-only">Tú: </span>
                        {message.content}
                      </p>
                    ) : (
                      <>
                        <span className="message-author">Nexo</span>
                        <div className="message-content">
                          <Markdown disallowedElements={["img"]} skipHtml>
                            {message.content.trim() ||
                              "Nexo devolvió una respuesta vacía."}
                          </Markdown>
                        </div>
                        {message.usage && (
                          <TokenUsageDetails usage={message.usage} />
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ol>
              {isPending && (
                <p aria-hidden="true" className="waiting">
                  Nexo está respondiendo…
                </p>
              )}
            </div>
          </section>
        ) : (
          <h1 className="welcome column">¿En qué te ayudo?</h1>
        )}

        <div className="composer-area column">
          <output className="sr-only">
            {isPending ? "Nexo está respondiendo." : ""}
          </output>
          {error && (
            <p className="composer-error" role="alert">
              {error.message}
            </p>
          )}
          <form className="composer" onSubmit={submit}>
            <label className="sr-only" htmlFor="chat-message">
              Mensaje para Nexo
            </label>
            <textarea
              aria-describedby="composer-keys"
              autoComplete="off"
              className="composer-input"
              enterKeyHint="send"
              id="chat-message"
              onChange={(event) => updateDraft(event.currentTarget.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Escribe tu mensaje…"
              readOnly={isPending}
              ref={composer}
              rows={2}
              value={draft}
            />
            <span className="sr-only" id="composer-keys">
              Enter para enviar. Shift más Enter para una línea nueva.
            </span>
            <button
              aria-label="Enviar mensaje"
              className="send-button pressable"
              disabled={!canSend}
              type="submit"
            >
              <span aria-hidden="true">↑</span>
            </button>
          </form>
        </div>

        {!hasMessages && (
          <ul aria-label="Ideas para empezar" className="suggestions column">
            {suggestions.map((suggestion) => (
              <li key={suggestion.label}>
                <button
                  className="suggestion pressable"
                  onClick={() => {
                    updateDraft(suggestion.prompt);
                    focusComposer();
                  }}
                  type="button"
                >
                  {suggestion.label}
                  <span aria-hidden="true">↗</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default App;
