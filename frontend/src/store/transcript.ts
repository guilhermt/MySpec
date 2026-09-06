import type { Entry, Transcript, TranscriptEvent } from "@/lib/wails";

/** TranscriptState is the conversation of one task as the interface holds it. */
export interface TranscriptState {
  /** status is loading until the first GetTranscript answers. */
  status: "loading" | "ready";
  /** entries are the conversation, ordered by seq. */
  entries: Entry[];
  /** pending are the queued user messages, in arrival order. */
  pending: Entry[];
  /** buffered holds the events that arrived while loading. */
  buffered: TranscriptEvent[];
}

/** emptyTranscript is the state of a conversation nobody has loaded yet. */
export function emptyTranscript(): TranscriptState {
  return { status: "loading", entries: [], pending: [], buffered: [] };
}

/** fromTranscript turns a loaded conversation into a ready state. */
export function fromTranscript(transcript: Transcript): TranscriptState {
  return {
    status: "ready",
    entries: transcript.entries ?? [],
    pending: transcript.pending ?? [],
    buffered: [],
  };
}

// Entries arrive whole and out of order, so an entry already in the list is
// replaced instead of appended: applying an event twice changes nothing.
function upsertBySeq(entries: Entry[], entry: Entry): Entry[] {
  const rest = entries.filter((current) => current.id !== entry.id);
  const at = rest.findIndex((current) => current.seq > entry.seq);
  if (at === -1) {
    return [...rest, entry];
  }
  return [...rest.slice(0, at), entry, ...rest.slice(at)];
}

// Queued messages have no seq of their own; they keep the order they arrived in.
function upsertPending(pending: Entry[], entry: Entry): Entry[] {
  if (pending.some((current) => current.id === entry.id)) {
    return pending.map((current) => (current.id === entry.id ? entry : current));
  }
  return [...pending, entry];
}

function without(entries: Entry[], id: string): Entry[] {
  return entries.some((entry) => entry.id === id)
    ? entries.filter((entry) => entry.id !== id)
    : entries;
}

/**
 * applyEvent folds one change into a conversation. Every event is idempotent,
 * so replaying one, or applying one that GetTranscript already answered with,
 * leaves the same state.
 */
export function applyEvent(state: TranscriptState, event: TranscriptEvent): TranscriptState {
  switch (event.kind) {
    case "entry": {
      const entry = event.entry;
      if (entry === null) {
        return state;
      }
      if (entry.user?.pending === true) {
        return {
          ...state,
          entries: without(state.entries, entry.id),
          pending: upsertPending(state.pending, entry),
        };
      }
      return {
        ...state,
        entries: upsertBySeq(state.entries, entry),
        pending: without(state.pending, entry.id),
      };
    }
    case "text": {
      let found = false;
      const entries = state.entries.map((entry) => {
        if (entry.id !== event.entryId || entry.assistant === null) {
          return entry;
        }
        found = true;
        return { ...entry, assistant: { ...entry.assistant, text: event.text } };
      });
      return found ? { ...state, entries } : state;
    }
    case "remove":
      return {
        ...state,
        entries: without(state.entries, event.entryId),
        pending: without(state.pending, event.entryId),
      };
    case "reset":
      return { ...state, status: "loading", buffered: [] };
    default:
      return state;
  }
}
