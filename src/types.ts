export type Msg = {
  id: string;
  clientId: string;
  conversationId: string;
  seq: number;
  senderId: string;
  body: string;
  createdAt: string;
  deleted: boolean;
};

/** A message as the UI sees it. Unsent messages live here with status "sending"/"failed" until the server acks them. */
export type ThreadMsg = Msg & { status: "sent" | "sending" | "failed"; error?: string };

export type Conv = {
  id: string;
  lastSeq: number;
  lastMessageAt: string | null;
  other: { id: string; name: string };
  lastMessage: { body: string; senderId: string; deleted: boolean } | null;
  unread: number;
};

export type Person = { id: string; name: string };
