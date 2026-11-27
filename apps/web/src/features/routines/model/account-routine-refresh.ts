type RefreshListener = () => void;

const listeners = new Set<RefreshListener>();

export function subscribeAccountRoutines(listener: RefreshListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function notifyAccountRoutinesChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}
