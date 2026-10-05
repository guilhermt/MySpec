/**
 * frames counts the frames a response loses: the display refreshes that go by between the frame an
 * event arrives in and the one that shows what the event changed, the refresh right after the event
 * left out. Zero is the target of every key and every update of the lists
 * (docs/development/target-machine.md, As listas virtualizadas). A time from the event to the next
 * frame never falls below the time left to the display's next refresh, however small the work, so the
 * measures count refreshes instead.
 *
 * The event arrives at the start of a frame, in its requestAnimationFrame. The frame that paints the
 * response is the first one whose requestAnimationFrame finds it committed, and its painting ends
 * where a task posted from that callback runs. The response is on screen at the first refresh after
 * that end: a frame lost is a refresh it missed.
 */

/** FRAMES_TO_TIME is how many frames frameInterval reads the interval of the display from. */
const FRAMES_TO_TIME = 60;

/** GIVE_UP_MS is how long countDropped waits for the response before it counts what it waited. */
const GIVE_UP_MS = 2000;

/** frame waits for the next frame and returns its time, with the layout of what was committed done. */
export function frame(): Promise<number> {
  return new Promise((done) =>
    requestAnimationFrame((time) => {
      void document.body.offsetHeight;
      done(time);
    }),
  );
}

/** median is the middle value of a list, the upper one of an even list. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * frameInterval is the time between two frames of the display, the mean of sixty idle frames: a
 * browser that rounds its clock to the millisecond, as WebKitGTK does, gives 16 and 17 ms in turn,
 * whose median would be a millisecond off.
 */
export async function frameInterval(): Promise<number> {
  const first = await frame();
  let last = first;
  for (let count = 0; count < FRAMES_TO_TIME; count++) {
    last = await frame();
  }
  return (last - first) / FRAMES_TO_TIME;
}

/** MICROTASK_TURNS is how many turns of microtasks countDropped lets run after the act. */
const MICROTASK_TURNS = 10;

// painting waits for the painting of the frame it is called in, from its requestAnimationFrame, and
// returns the time it ended: a posted task runs once the frame's rendering is done.
function painting(): Promise<number> {
  return new Promise((done) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      done(performance.now());
    };
    channel.port2.postMessage(null);
  });
}

/**
 * countDropped acts at the start of a frame, as an event that arrives then, and returns how many
 * refreshes of the display the response missed: zero when it is painted in time for the refresh
 * after the event. painted tells whether the response is committed; without it, the response is what
 * the act committed.
 */
export async function countDropped(
  interval: number,
  act: () => void,
  painted: () => boolean = () => true,
): Promise<number> {
  const start = await frame();
  act();
  // React commits a key in a microtask, before the frame paints.
  for (let turn = 0; turn < MICROTASK_TURNS; turn++) {
    await Promise.resolve();
  }
  while (!painted() && performance.now() - start < GIVE_UP_MS) {
    await frame();
  }
  const ended = await painting();
  return Math.max(0, Math.ceil((ended - start) / interval) - 1);
}

/** Dropped is what a count says: the cold run, and the median and the maximum of the warm ones. */
export interface Dropped {
  coldFrames: number;
  medianFrames: number;
  maxFrames: number;
}

/** droppedOf sums up the counts of a measure, the cold one first. */
export function droppedOf(counts: readonly number[]): Dropped {
  const [cold = 0, ...warm] = counts;
  return { coldFrames: cold, medianFrames: median(warm), maxFrames: Math.max(0, ...warm) };
}
