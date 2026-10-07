import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { api } from "./lib/api";
import { createSocket } from "./lib/socket";
import type { Conv, Msg, ThreadMsg } from "./types";

const byOrder = (a: ThreadMsg, b: ThreadMsg) => {
  if (a.seq && b.seq) return a.seq - b.seq;
  if (a.seq) return -1; // confirmed messages first, unsent ones after
  if (b.seq) return 1;
  return a.createdAt.localeCompare(b.createdAt);
};

/** Insert or replace. Matching on clientId is what swaps an optimistic "sending" bubble for the server's copy. */
function merge(list: ThreadMsg[], incoming: ThreadMsg): ThreadMsg[] {
  const i = list.findIndex((m) => m.id === incoming.id || m.clientId === incoming.clientId);
  const next = i >= 0 ? list.map((m, j) => (j === i ? incoming : m)) : [...list, incoming];
  return next.sort(byOrder);
}

const lastSeqOf = (list: ThreadMsg[] | undefined) => (list ?? []).reduce((n, m) => (m.status === "sent" ? Math.max(n, m.seq) : n), 0);

type Ack = { ok: true; message: Msg } | { ok: false; error: string };

export function useChat(meId: string) {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, ThreadMsg[]>>({});
  const [online, setOnline] = useState(false);

  // Refs let socket handlers (created once) always see current state.
  const socketRef = useRef<Socket | null>(null);
  const convsRef = useRef(convs);
  const threadsRef = useRef(threads);
  const activeRef = useRef(activeId);
  convsRef.current = convs;
  threadsRef.current = threads;
  activeRef.current = activeId;

  const refreshConvs = useCallback(async () => {
    try {
      setConvs(await api<Conv[]>("/conversations"));
    } catch {
      /* offline: keep what we have */
    }
  }, []);

  const putMsgs = useCallback((cid: string, msgs: Msg[]) => {
    setThreads((t) => ({ ...t, [cid]: msgs.reduce((acc, m) => merge(acc, { ...m, status: "sent" }), t[cid] ?? []) }));
  }, []);

  const markRead = useCallback((cid: string) => {
    const seq = lastSeqOf(threadsRef.current[cid]);
    if (seq) socketRef.current?.emit("message:read", { conversationId: cid, seq });
    setConvs((cs) => cs.map((c) => (c.id === cid ? { ...c, unread: 0 } : c)));
  }, []);

  /** Ask the server for everything after the newest message we hold. This single call heals every kind of gap. */
  const catchUp = useCallback(
    async (cid: string) => {
      try {
        for (;;) {
          const after = lastSeqOf(threadsRef.current[cid]);
          const msgs = await api<Msg[]>(`/conversations/${cid}/messages?afterSeq=${after}&limit=100`);
          if (!msgs.length) break;
          putMsgs(cid, msgs);
          threadsRef.current = { ...threadsRef.current, [cid]: msgs.reduce((acc, m) => merge(acc, { ...m, status: "sent" }), threadsRef.current[cid] ?? []) };
          if (msgs.length < 100) break;
        }
        if (activeRef.current === cid) markRead(cid);
      } catch {
        /* next reconnect will retry */
      }
    },
    [putMsgs, markRead],
  );

  const setStatus = useCallback((cid: string, clientId: string, status: ThreadMsg["status"], error?: string) => {
    setThreads((t) => ({ ...t, [cid]: (t[cid] ?? []).map((m) => (m.clientId === clientId ? { ...m, status, error } : m)) }));
  }, []);

  /** Send over the socket and wait for the server's ack (which only comes after the DB commit). */
  const deliver = useCallback(
    async (m: ThreadMsg) => {
      const s = socketRef.current;
      if (!s?.connected) return; // stays "sending"; resent automatically when the socket reconnects
      try {
        const ack = (await s.timeout(8000).emitWithAck("message:send", {
          conversationId: m.conversationId,
          clientId: m.clientId,
          body: m.body,
        })) as Ack;
        if (ack.ok) putMsgs(m.conversationId, [ack.message]);
        else setStatus(m.conversationId, m.clientId, "failed", ack.error);
      } catch {
        // No ack in time: the message may or may not be stored. Re-sending with the SAME clientId is always safe.
        setStatus(m.conversationId, m.clientId, "failed");
      }
    },
    [putMsgs, setStatus],
  );

  const resendPending = useCallback(() => {
    Object.values(threadsRef.current)
      .flat()
      .filter((m) => m.senderId === meId && (m.status === "sending" || (m.status === "failed" && !m.error)))
      .forEach((m) => {
        setStatus(m.conversationId, m.clientId, "sending");
        void deliver({ ...m, status: "sending" });
      });
  }, [deliver, meId, setStatus]);

  useEffect(() => {
    const s = createSocket();
    socketRef.current = s;

    const resync = () => {
      void refreshConvs();
      if (activeRef.current) void catchUp(activeRef.current);
    };

    s.on("connect", () => {
      setOnline(true);
      resync();
      resendPending();
    });
    s.on("disconnect", () => setOnline(false));
    s.on("connect_error", () => setOnline(false));
    s.on("resync", resync); // server-side listener restarted: we may have missed pushes

    s.on("message:new", (m: Msg) => {
      const cid = m.conversationId;
      if (!convsRef.current.some((c) => c.id === cid)) {
        void refreshConvs(); // someone started a new conversation with us
        return;
      }
      const loaded = threadsRef.current[cid];
      if (loaded) {
        if (m.seq === lastSeqOf(loaded) + 1 || m.seq <= lastSeqOf(loaded)) putMsgs(cid, [m]);
        else void catchUp(cid); // gap detected: fetch what we missed instead of showing a hole
      }
      const mine = m.senderId === meId;
      const watching = activeRef.current === cid && document.visibilityState === "visible";
      setConvs((cs) => {
        const updated = cs.map((c) =>
          c.id === cid
            ? {
                ...c,
                lastSeq: m.seq,
                lastMessageAt: m.createdAt,
                lastMessage: { body: m.body, senderId: m.senderId, deleted: m.deleted },
                unread: mine || watching ? c.unread : c.unread + 1,
              }
            : c,
        );
        return updated.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
      });
      if (watching && !mine) setTimeout(() => markRead(cid), 0);
    });

    const onVisible = () => {
      if (document.visibilityState === "visible" && s.connected) resync();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      s.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = useCallback(
    async (cid: string) => {
      setActiveId(cid);
      activeRef.current = cid;
      try {
        const latest = await api<Msg[]>(`/conversations/${cid}/messages?limit=50`);
        setThreads((t) => ({ ...t, [cid]: latest.reduce((acc, m) => merge(acc, { ...m, status: "sent" }), (t[cid] ?? []).filter((m) => m.status !== "sent")) }));
        threadsRef.current = { ...threadsRef.current, [cid]: threadsRef.current[cid] ?? [] };
        setTimeout(() => markRead(cid), 0);
      } catch {
        setThreads((t) => ({ ...t, [cid]: t[cid] ?? [] }));
      }
    },
    [markRead],
  );

  const startWith = useCallback(
    async (userId: string) => {
      const { id } = await api<{ id: string }>("/conversations", { method: "POST", body: JSON.stringify({ userId }) });
      await refreshConvs();
      await open(id);
    },
    [open, refreshConvs],
  );

  const send = useCallback(
    (cid: string, body: string) => {
      const clientId = crypto.randomUUID();
      const pending: ThreadMsg = {
        id: clientId,
        clientId,
        conversationId: cid,
        seq: 0,
        senderId: meId,
        body,
        createdAt: new Date().toISOString(),
        deleted: false,
        status: "sending",
      };
      setThreads((t) => ({ ...t, [cid]: merge(t[cid] ?? [], pending) }));
      void deliver(pending);
    },
    [deliver, meId],
  );

  const retry = useCallback(
    (m: ThreadMsg) => {
      setStatus(m.conversationId, m.clientId, "sending");
      void deliver({ ...m, status: "sending" });
    },
    [deliver, setStatus],
  );

  return { convs, activeId, threads, online, open, startWith, send, retry, close: () => setActiveId(null) };
}
