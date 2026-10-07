import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Conv, Person } from "../types";

type Props = {
  meName: string;
  convs: Conv[];
  activeId: string | null;
  online: boolean;
  onOpen: (id: string) => void;
  onStart: (userId: string) => void;
  onSignOut: () => void;
};

export function Sidebar({ meName, convs, activeId, online, onOpen, onStart, onSignOut }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api<Person[]>(`/users?q=${encodeURIComponent(q)}`).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <aside className="sidebar">
      <header className="side-head">
        <div>
          <strong>{meName}</strong>
          <span className={`dot ${online ? "on" : "off"}`} title={online ? "Connected" : "Reconnecting"} />
        </div>
        <button className="link" onClick={onSignOut}>Sign out</button>
      </header>

      <div className="search">
        <input placeholder="Find someone by name or exact email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find people" />
        {q.trim().length >= 2 && (
          <ul className="results">
            {results.length === 0 && <li className="muted pad">No one found. They need to have signed in at least once.</li>}
            {results.map((p) => (
              <li key={p.id}>
                <button onClick={() => { setQ(""); onStart(p.id); }}>Message {p.name}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="convs">
        {convs.length === 0 && <li className="muted pad">No conversations yet. Search for someone above to say hello.</li>}
        {convs.map((c) => (
          <li key={c.id}>
            <button className={c.id === activeId ? "conv active" : "conv"} onClick={() => onOpen(c.id)}>
              <span className="conv-top">
                <strong>{c.other.name}</strong>
                {c.unread > 0 && <span className="badge">{c.unread > 99 ? "99+" : c.unread}</span>}
              </span>
              <span className="preview">{c.lastMessage ? (c.lastMessage.deleted ? "Message removed" : c.lastMessage.body) : "No messages yet"}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
