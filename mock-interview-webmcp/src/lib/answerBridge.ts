// The "bridge" is the mechanism that lets a WebMCP tool call BLOCK
// until the human types their answer on the page. It's a promise the
// tool `await`s, and the UI resolves it when the user clicks Submit.

type Resolver<T> = (value: T) => void;

interface PendingAnswer {
  questionId: string;
  resolve: Resolver<string>;
  reject: (reason: unknown) => void;
  createdAt: number;
}

let pending: PendingAnswer | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Subscribe to bridge state changes (used by the UI to re-render). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot for React's `useSyncExternalStore`. */
export function getSnapshot(): PendingAnswer | null {
  return pending;
}

/** Server-side snapshot — always null (bridge is client-only). */
export function getServerSnapshot(): PendingAnswer | null {
  return null;
}

/**
 * Called from a WebMCP tool. Blocks until the human clicks Submit
 * on the page, then returns their typed answer.
 * Throws if a previous request is still pending (one-at-a-time).
 */
export function awaitAnswer(questionId: string, timeoutMs = 10 * 60 * 1000): Promise<string> {
  if (pending) {
    return Promise.reject(new Error("Another answer request is already pending."));
  }

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending && pending.questionId === questionId) {
        pending = null;
        emit();
        reject(new Error("Timed out waiting for the candidate to submit an answer."));
      }
    }, timeoutMs);

    pending = {
      questionId,
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (reason) => {
        clearTimeout(timer);
        reject(reason);
      },
      createdAt: Date.now(),
    };
    emit();
  });
}

/** Called from the UI when the human clicks Submit. */
export function submitAnswer(answer: string): boolean {
  if (!pending) return false;
  const p = pending;
  pending = null;
  emit();
  p.resolve(answer);
  return true;
}

/** Cancel any pending wait (e.g., candidate ends interview). */
export function cancelPending(reason = "Cancelled by user."): void {
  if (!pending) return;
  const p = pending;
  pending = null;
  emit();
  p.reject(new Error(reason));
}
