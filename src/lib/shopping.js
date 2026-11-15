/**
 * Shopping mode: the camera stays on and every new barcode becomes a card in a
 * list (looked up in the background). Pure helpers, unit-tested.
 */
export const REPEAT_MS = 10_000; // the same code again within this time is ignored
export const IDLE_STOP_MS = 5 * 60_000; // camera off after this long without a new code
export const MAX_ITEMS = 50;

/** (code, now) → true when the code should be handled (not seen in the last `windowMs`). */
export function createRepeatFilter(windowMs = REPEAT_MS) {
  const last = new Map();
  return (code, now = Date.now()) => {
    const prev = last.get(code);
    last.set(code, now);
    return prev === undefined || now - prev > windowMs;
  };
}

/**
 * Adds a scanned code to the list (newest first). A code already in the list
 * moves to the top instead of being looked up again.
 * @returns {{items: object[], isNew: boolean}}
 */
export function addScan(items, code, now = Date.now()) {
  const existing = items.find((x) => x.code === code);
  if (existing) return { items: [{ ...existing, at: now }, ...items.filter((x) => x !== existing)], isNew: false };
  return { items: [{ code, state: 'loading', at: now }, ...items].slice(0, MAX_ITEMS), isNew: true };
}

/** Updates one card when its lookup / analysis is done. */
export function updateScan(items, code, patch) {
  return items.map((x) => (x.code === code ? { ...x, ...patch } : x));
}
