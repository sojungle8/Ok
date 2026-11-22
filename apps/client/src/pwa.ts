/**
 * Register the offline app shell (built HTML/JS/CSS only). Production builds over http(s) only;
 * a new version waits and applies at the next launch, so a running game is never reloaded.
 */
export function registerAppShell(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || !/^https?:$/u.test(location.protocol)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline shell is a convenience; the game still runs online */
    });
  });
}

/** Device pixel ratio budget: phones/tablets (coarse pointer) render at most 1.5×, desktop 2×. */
export function renderPixelRatio(devicePixelRatio: number, coarsePointer: boolean): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(dpr, coarsePointer ? 1.5 : 2);
}
