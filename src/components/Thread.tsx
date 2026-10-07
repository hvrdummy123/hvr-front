import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Conv, ThreadMsg } from "../types";

type Props = {
  conv: Conv;
  messages: ThreadMsg[];
  meId: string;
  online: boolean;
  onSend: (body: string) => void;
  onRetry: (m: ThreadMsg) => void;
  onBack: () => void;
};

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function Thread({ conv, messages, meId, online, onSend, onRetry, onBack }: Props) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conv.id]);

  function submit() {
    const body = text.trim();
    if (!body) return;
    onSend(body);
    setText("");
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <section className="thread">
      <header className="thread-head">
        <button className="link back" onClick={onBack}>Back</button>
        <strong>{conv.other.name}</strong>
      </header>

      {!online && <div className="banner">Reconnecting… messages you send now will go out as soon as you're back online.</div>}

      <div className="messages">
        {messages.length === 0 && <p className="muted center">Say hello to {conv.other.name}.</p>}
        {messages.map((m) => {
          const mine = m.senderId === meId;
          return (
            <div key={m.clientId} className={`row ${mine ? "mine" : "theirs"}`}>
              <div className={`bubble ${m.status !== "sent" ? "unsent" : ""}`}>{m.deleted ? <em>Message removed</em> : m.body}</div>
              <div className="meta">
                {m.status === "sending" && (online ? "Sending…" : "Waiting for connection…")}
                {m.status === "failed" && (
                  <>
                    <span className="error">Not sent.</span> <button className="link" onClick={() => onRetry(m)}>Retry</button>
                  </>
                )}
                {m.status === "sent" && time(m.createdAt)}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={`Message ${conv.other.name}`}
          rows={1}
          maxLength={1000}
          aria-label="Message"
        />
        <button className="primary" onClick={submit} disabled={!text.trim()}>Send</button>
      </div>
    </section>
  );
}
