"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowUp, Bot, Plus, UserRound } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Message = { id?: number; role: "user" | "assistant"; content: string };
type ChatSession = { id: number; title: string; scholarship_id: string | null };

export default function AdvisorPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [provider, setProvider] = useState("AI");

  async function refreshSessions() {
    try {
      setSessions(await apiFetch<ChatSession[]>("/api/ai/sessions"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load chat history.",
      );
    }
  }
  useEffect(() => {
    let active = true;
    apiFetch<ChatSession[]>("/api/ai/sessions")
      .then((loaded) => {
        if (active) setSessions(loaded);
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load chat history.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function openSession(id: number) {
    setSessionId(id);
    setError("");
    try {
      const data = await apiFetch<{ messages: Message[] }>(
        `/api/ai/sessions/${id}`,
      );
      setMessages(data.messages);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open chat.");
    }
  }
  function newChat() {
    setSessionId(null);
    setMessages([]);
    setError("");
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    setMessages((current) => [...current, { role: "user", content: text }]);
    try {
      const response = await apiFetch<{ session_id: number; message: Message; provider?: string }>(
        "/api/ai/chat",
        {
          method: "POST",
          body: JSON.stringify({ message: text, session_id: sessionId }),
        },
      );
      setSessionId(response.session_id);
      setProvider(response.provider ?? "AI");
      setMessages((current) => [...current, response.message]);
      await refreshSessions();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The advisor could not respond.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="advisor-layout">
      <aside className="advisor-history">
        <div className="advisor-history-head">
          <strong>Conversations</strong>
          <button
            className="icon-action small-action"
            onClick={newChat}
            aria-label="Start a new conversation"
          >
            <Plus size={16} />
          </button>
        </div>
        {sessions.map((session) => (
          <button
            key={session.id}
            className={`session-button ${session.id === sessionId ? "active" : ""}`}
            onClick={() => openSession(session.id)}
          >
            {session.title}
          </button>
        ))}
        {sessions.length === 0 && (
          <span className="input-hint">
            Your recent conversations will appear here.
          </span>
        )}
      </aside>
      <section className="advisor-main">
        <div className="advisor-title">
          <div className="advisor-avatar">
            <Bot size={20} />
          </div>
          <div>
            <p className="eyebrow">SCHOLARSHIP ADVISOR</p>
            <h1>A thoughtful place to ask.</h1>
            <span>
              {provider.startsWith("mock") ? "Demo AI" : provider === "gemini" ? "Gemini AI" : provider} · answers
              grounded in the scholarship catalogue
            </span>
          </div>
        </div>
        <div className="chat-thread">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <Bot size={28} />
              <strong>What would you like to understand?</strong>
              <p>
                Ask about a scholarship&apos;s deadline, IELTS requirement, funding,
                or documents.
              </p>
              <div className="suggested-prompts">
                {[
                  "How do I compare these opportunities?",
                  "What documents should I prepare?",
                  "How does IELTS affect my matches?",
                ].map((prompt) => (
                  <button key={prompt} onClick={() => setMessage(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((item, index) => (
              <article
                className={`chat-message ${item.role}`}
                key={item.id || `${item.role}-${index}`}
              >
                <span>
                  {item.role === "assistant" ? (
                    <Bot size={15} />
                  ) : (
                    <UserRound size={15} />
                  )}
                </span>
                <p>{item.content}</p>
              </article>
            ))
          )}
          {busy && (
            <p className="typing-line">Thinking through the catalogue...</p>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <form className="chat-composer" onSubmit={send}>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask about scholarships, requirements, or next steps"
            rows={2}
          />
          <button
            className="send-message"
            disabled={busy || !message.trim()}
            aria-label="Send message"
          >
            <ArrowUp size={17} />
          </button>
          <small>
            AI can make mistakes. Verify requirements with the official
            scholarship source.
          </small>
        </form>
      </section>
    </div>
  );
}
