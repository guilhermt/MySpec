import { useEffect, useMemo, useRef, useState } from "react";
import { messageOf } from "@/lib/errors";
import type { CardImage, CardImageFailure } from "@/lib/wails";
import { readCardImages } from "@/store/actions";

export interface CardImagesRead {
  images: CardImage[];
  failures: CardImageFailure[];
}

/** CardImagesReading is the images of some cards, read into the cache, and whether that is going on. */
export interface CardImagesReading extends CardImagesRead {
  reading: boolean;
  /** settled resolves with the reading in course, or the last one when none runs. */
  settled: () => Promise<CardImagesRead>;
}

const NONE: CardImagesRead = { images: [], failures: [] };

// wholeFailure is a reading that failed altogether: one failure, of no card and with no link.
function wholeFailure(reason: unknown): CardImageFailure {
  return {
    origin: "card",
    issue: "",
    number: 0,
    url: "",
    alt: "",
    reason: messageOf(reason).replace(/\.$/, ""),
  };
}

/**
 * useCardImages reads the images of the cards once they are ready, and again when the cards change
 * or `again` does. A reading that the next one cancels is ignored.
 */
export function useCardImages(
  boardId: string,
  keys: readonly string[],
  ready: boolean,
  again = 0,
): CardImagesReading {
  const [read, setRead] = useState<CardImagesRead>(NONE);
  const [reading, setReading] = useState(false);
  const current = useRef<Promise<CardImagesRead>>(Promise.resolve(NONE));
  // hand gives the reading that will start to whoever settled before the cards were ready.
  const hand = useRef<((reading: Promise<CardImagesRead>) => void) | null>(null);

  // The keys travel as one string so the effect sees a value, not a new array on every render.
  const keyList = keys.join("\n");
  const wanted = useMemo(() => (keyList === "" ? [] : keyList.split("\n")), [keyList]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: again asks for the images again
  useEffect(() => {
    if (wanted.length === 0) {
      current.current = Promise.resolve(NONE);
      hand.current?.(current.current);
      hand.current = null;
      setRead(NONE);
      setReading(false);
      return;
    }
    if (!ready) {
      // The cards are being read again: settled waits for the reading that follows.
      if (hand.current === null) {
        current.current = new Promise((resolve) => {
          hand.current = resolve;
        });
      }
      setRead(NONE);
      setReading(false);
      return;
    }
    let cancelled = false;
    setReading(true);
    const reading = readCardImages(boardId, wanted)
      .then((result) => ({ images: result.images ?? [], failures: result.failures ?? [] }))
      .catch((reason: unknown) => ({ images: [], failures: [wholeFailure(reason)] }));
    current.current = reading;
    hand.current?.(reading);
    hand.current = null;
    void reading.then((result) => {
      if (!cancelled) {
        setRead(result);
        setReading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [boardId, wanted, ready, again]);

  return { ...read, reading, settled: () => current.current };
}
