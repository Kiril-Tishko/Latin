// Thin, failure-tolerant access to the claude.ai runtime capabilities.
// Outside claude.ai (a local preview, a saved file) every capability is absent
// and the site falls back to browser storage and copy-a-prompt.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Use = (name: string) => Promise<any | null>;

function use(name: string): Promise<any | null> {
  const w = window as unknown as { claude?: { use?: Use } };
  if (!w.claude?.use) return Promise.resolve(null);
  return w.claude.use(name).catch(() => null);
}

export interface DocRef {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(data: Record<string, unknown>): Promise<void>;
}

export interface SampleFn {
  (input: string | { role: "user" | "assistant"; content: string }[], options?: Record<string, unknown>): Promise<{ text: string; truncated: boolean }>;
  json<T = unknown>(input: string | { role: "user" | "assistant"; content: string }[], options?: Record<string, unknown>): Promise<T>;
}

/** The learner's private progress document, or null when the account store is unavailable. */
export async function progressDoc(): Promise<DocRef | null> {
  const [db, user] = await Promise.all([use("db"), use("user")]);
  if (!db || !user) return null;
  const id: string | null = await user.id().catch(() => null);
  if (!id) return null;
  try {
    return db.doc(`data/users/${id}/progress`) as DocRef;
  } catch {
    return null;
  }
}

/** A stored document as snapshots deliver it. */
export interface DocSnap {
  id: string;
  data(): Record<string, unknown> | undefined;
}

/** The viewer's private collection of saved conversations (data/users/<id>/chats/threads). */
export interface ChatCollection {
  doc(id: string): { set(data: Record<string, unknown>): Promise<void>; delete(): Promise<void> };
  orderBy(
    field: string,
    dir: "asc" | "desc",
  ): {
    limit(n: number): {
      onSnapshot(next: (snap: { docs: DocSnap[] }) => void, error?: (e: { code?: string }) => void): () => void;
    };
  };
}

/** Saved Ask Claude conversations, or null when the account store is unavailable. */
export async function chatCollection(): Promise<ChatCollection | null> {
  const [db, user] = await Promise.all([use("db"), use("user")]);
  if (!db || !user) return null;
  const id: string | null = await user.id().catch(() => null);
  if (!id) return null;
  try {
    return db.doc(`data/users/${id}/chats`).collection("threads") as ChatCollection;
  } catch {
    return null;
  }
}

/** A collection of documents, as the store gives it (enough for the messenger). */
export interface DocCollection {
  doc(id: string): { set(data: Record<string, unknown>): Promise<void>; delete(): Promise<void> };
  onSnapshot(next: (snap: { docs: DocSnap[] }) => void, error?: (e: { code?: string }) => void): () => void;
}

/** A document that can be followed live. */
export interface LiveDoc extends DocRef {
  onSnapshot(next: (snap: { exists: boolean; data(): Record<string, unknown> | undefined }) => void, error?: (e: { code?: string }) => void): () => void;
}

/** The messenger's documents in the viewer's private space, or null when the account store is unavailable. */
export async function messengerStore(): Promise<{ meta: LiveDoc; brief: DocRef; threads: DocCollection; inbox: DocCollection } | null> {
  const [db, user] = await Promise.all([use("db"), use("user")]);
  if (!db || !user) return null;
  const id: string | null = await user.id().catch(() => null);
  if (!id) return null;
  try {
    const meta = db.doc(`data/users/${id}/messenger`);
    return { meta, brief: meta.collection("brief").doc("now"), threads: meta.collection("threads"), inbox: meta.collection("inbox") };
  } catch {
    return null;
  }
}

export async function sampler(): Promise<SampleFn | null> {
  return (await use("sample")) as SampleFn | null;
}

export const isFramed = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

/** Viewer-facing text for a failed Claude call. */
export function sampleErrorText(code?: string): string {
  switch (code) {
    case "not_granted":
      return "Claude isn't allowed for this page. You can allow it from the page's Permissions menu.";
    case "sampling_disabled":
      return "Claude isn't available for this account.";
    case "rate_limited":
      return "Too many questions in a short time, or your usage limit is reached. Try again in a little while.";
    case "session_expired":
      return "Your claude.ai session expired. Sign in again and reload the page.";
    case "refused":
      return "Claude declined to answer that. Try rephrasing the question.";
    case "prompt_too_large":
      return "That was too long to send. Try a shorter question.";
    case "cancelled":
      return "";
    case "upstream_error":
      return "Claude's service did not answer this time. Try again in a moment.";
    case "empty_completion":
      return "Claude sent back an empty answer. Try asking a little differently.";
    case "not_declared":
    case "capability_disabled":
    case "capability_removed":
      return "Asking Claude isn't available in this view of the page. Open it on claude.ai in a browser.";
    case "invalid_request":
    case "transform_error":
      return "The page sent the question in a form Claude could not read. That is a bug on the page.";
    case "queue_overflow":
      return "Too many questions were waiting. Reload the page and try again.";
    default:
      return `Something went wrong reaching Claude${code ? ` (${code})` : ""}. Try again.`;
  }
}

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage blocked: the account copy still works */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage blocked */
    }
  },
};
