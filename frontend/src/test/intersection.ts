/** watching are the elements the IntersectionObserver doubles watch, with the doubles of each. */
const watching = new Map<Element, Set<FakeIntersectionObserver>>();

class FakeIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly scrollMargin = "";
  readonly thresholds = [0];
  readonly #callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.#callback = callback;
  }

  observe(target: Element): void {
    const observers = watching.get(target) ?? new Set();
    observers.add(this);
    watching.set(target, observers);
  }

  unobserve(target: Element): void {
    watching.get(target)?.delete(this);
  }

  disconnect(): void {
    for (const observers of watching.values()) {
      observers.delete(this);
    }
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  tell(target: Element, isIntersecting: boolean): void {
    this.#callback([{ target, isIntersecting } as IntersectionObserverEntry], this);
  }
}

/** installIntersectionObserver gives jsdom an IntersectionObserver that only says what a test tells it. */
export function installIntersectionObserver(): void {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: FakeIntersectionObserver,
    writable: true,
    configurable: true,
  });
}

/** intersect tells every observer of the element that it came into view, or left it. */
export function intersect(target: Element, isIntersecting = true): void {
  for (const observer of [...(watching.get(target) ?? [])]) {
    observer.tell(target, isIntersecting);
  }
}

/** observed tells whether an observer watches the element now. */
export function observed(target: Element): boolean {
  return (watching.get(target)?.size ?? 0) > 0;
}
