// Saved Ask Claude conversations. With the account store each conversation is
// one private document (data/users/<id>/chats/threads/<chatId>) that every
// device sees live; this browser keeps a copy so the list shows at once and
// survives when the account store is unavailable.
import { useEffect, useState } from "preact/hooks";
import type { AskContext } from "./ask";
import { ChatCollection, chatCollection, DocSnap, storage } from "./platform";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  at: number;
  /** Skill ids Claude suggested drilling. */
  practice?: string[];
  /** Which model tier answered ("quick", "default", "complex"). */
  tier?: string;
  /** For a question: what was on screen when it was asked (the full description only on the latest). */
  screen?: { label: string; detail?: string };
  /** For a question: the learner had switched off sharing the screen. */
  noScreen?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  /** The screen the conversation started from (an exercise, a word, a rule). */
  context: AskContext | null;
  /** Whether Claude sees the screen in this conversation, once the learner has chosen (unset: the page decides). */
  share?: boolean;
  turns: ChatTurn[];
  createdAt: number;
  updatedAt: number;
}

const LOCAL_KEY = "tabula-latina-chats-v1";
/** When this browser last saw the account's list: older local-only conversations were deleted elsewhere. */
const SYNCED_KEY = "tabula-latina-chats-synced";
const MAX_CHATS = 100;
const MAX_TURNS = 80;

let chats: Chat[] = loadLocal();
let col: ChatCollection | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function loadLocal(): Chat[] {
  try {
    const raw = JSON.parse(storage.get(LOCAL_KEY) ?? "[]");
    return Array.isArray(raw) ? (raw.map((x) => fromBody(String(x?.id ?? ""), x)).filter(Boolean) as Chat[]) : [];
  } catch {
    return [];
  }
}

function saveLocal() {
  // newest conversations first, as many as fit comfortably in browser storage
  let keep = chats.slice(0, 40);
  while (keep.length > 1 && JSON.stringify(keep).length > 400_000) keep = keep.slice(0, -1);
  storage.set(LOCAL_KEY, JSON.stringify(keep));
}

function fromBody(id: string, b: unknown): Chat | null {
  const x = b as Partial<Chat> | undefined;
  if (!id || !x || !Array.isArray(x.turns)) return null;
  const turns = x.turns
    .filter((t): t is ChatTurn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .map((t) => (t.screen && typeof t.screen.label !== "string" ? { ...t, screen: undefined } : t));
  return {
    id,
    title: typeof x.title === "string" ? x.title : turns[0]?.content.slice(0, 80) ?? "Conversation",
    context: x.context && typeof x.context === "object" ? (x.context as AskContext) : null,
    share: typeof x.share === "boolean" ? x.share : undefined,
    turns,
    createdAt: Number(x.createdAt) || 0,
    updatedAt: Number(x.updatedAt) || 0,
  };
}

// plain JSON: fields left undefined are dropped rather than sent
const toBody = (c: Chat): Record<string, unknown> =>
  JSON.parse(
    JSON.stringify({
      title: c.title,
      context: c.context,
      share: c.share,
      turns: c.turns.slice(-MAX_TURNS),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }),
  );

export const getChats = () => chats;
export const getChat = (id: string | null) => (id ? chats.find((c) => c.id === id) ?? null : null);

export function useChats(): Chat[] {
  const [, setT] = useState(0);
  useEffect(() => {
    const l = () => setT((t) => t + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return chats;
}

export const newChatId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Saves a conversation: shown at once, written to the account (one write at a time per conversation). */
export function saveChat(chat: Chat) {
  const c = { ...chat, turns: chat.turns.slice(-MAX_TURNS) };
  chats = [c, ...chats.filter((x) => x.id !== c.id)].sort((a, b) => b.updatedAt - a.updatedAt);
  saveLocal();
  emit();
  if (col) void write(c);
}

export function deleteChat(id: string) {
  chats = chats.filter((c) => c.id !== id);
  saveLocal();
  emit();
  if (col) void col.doc(id).delete().catch(() => undefined);
}

const queue = new Map<string, { busy: boolean; next: Chat | null }>();

async function write(chat: Chat) {
  const q = queue.get(chat.id) ?? { busy: false, next: null };
  queue.set(chat.id, q);
  if (q.busy) {
    q.next = chat;
    return;
  }
  q.busy = true;
  let current: Chat | null = chat;
  while (current && col) {
    try {
      await col.doc(current.id).set(toBody(current));
    } catch (e) {
      // a passing hiccup: one more try after a moment; otherwise the browser copy keeps it
      if ((e as { code?: string })?.code === "unavailable") {
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 800));
        await col.doc(current.id).set(toBody(current)).catch(() => undefined);
      }
    }
    current = q.next;
    q.next = null;
  }
  q.busy = false;
}

/** Connects to the account store and follows the conversations live (once per page load). */
export async function connectChats() {
  const c = await chatCollection();
  if (!c) return;
  col = c;
  let first = true;
  const lastSynced = Number(storage.get(SYNCED_KEY)) || 0;
  // conversations from this browser that the account has not seen yet, until they arrive
  const toUpload = new Set<string>();
  c.orderBy("updatedAt", "desc")
    .limit(MAX_CHATS)
    .onSnapshot(
      (snap) => {
        const remote = snap.docs.map((d: DocSnap) => fromBody(d.id, d.data())).filter(Boolean) as Chat[];
        const byId = new Map(remote.map((r) => [r.id, r]));
        if (first) {
          first = false;
          // conversations this browser saved while the account store was out of reach go up now
          // (one missing from the account but older than the last sync was deleted on another device)
          for (const local of chats) {
            const stored = byId.get(local.id);
            if (stored ? stored.updatedAt < local.updatedAt : local.updatedAt > lastSynced) {
              if (!stored) toUpload.add(local.id);
              void write(local);
            }
          }
        }
        // a conversation being written here is newer than its last stored copy
        const merged = remote.map((r) => {
          const mine = chats.find((x) => x.id === r.id);
          return mine && mine.updatedAt > r.updatedAt ? mine : r;
        });
        const pending = chats.filter((x) => !byId.has(x.id) && queue.get(x.id)?.busy);
        for (const id of byId.keys()) toUpload.delete(id);
        const uploading = chats.filter((x) => toUpload.has(x.id) && !pending.includes(x));
        chats = [...merged, ...pending, ...uploading].sort((a, b) => b.updatedAt - a.updatedAt);
        storage.set(SYNCED_KEY, String(Date.now()));
        saveLocal();
        emit();
      },
      () => {
        // the store went away for this page load: keep working from this browser
        col = null;
      },
    );
}
