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

/** Verified original RO UI raster used as the installable app icon (scaled nearest-neighbour only). */
export const PWA_ICON_ASSET_ID = "ui.skill.sm_bash.icon";
/** Integer nearest-neighbour scales of the 24×24 source: 192 px and 384 px. */
export const PWA_ICON_SCALES = [8, 16] as const;

export interface ManifestIcon { src: string; sizes: string; type: "image/png"; purpose: "any" }

/**
 * Runtime manifest: the static manifest plus icons rendered from a verified RO raster. URLs are made
 * absolute because the manifest itself is served from a blob: URL. Nothing here is written to Git.
 */
export function runtimeManifest(base: Record<string, unknown>, pageHref: string, icons: readonly ManifestIcon[]): Record<string, unknown> {
  const root = new URL("./", pageHref).href;
  return { ...base, start_url: root, scope: root, icons: [...icons] };
}

/** Exact integer upscale of a verified raster to PNG data URLs (no smoothing, no new pixels). */
async function scaledIcons(raster: { url: string; width: number; height: number }): Promise<ManifestIcon[]> {
  const image = new Image();
  image.src = raster.url;
  await image.decode();
  return PWA_ICON_SCALES.map((scale) => {
    const canvas = document.createElement("canvas");
    canvas.width = raster.width * scale;
    canvas.height = raster.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { src: canvas.toDataURL("image/png"), sizes: `${canvas.width}x${canvas.height}`, type: "image/png", purpose: "any" };
  });
}

/**
 * Replace the static (icon-less) manifest with one whose icons come from the verified RO raster, and
 * set the iOS touch icon. Best effort: failure leaves the offline shell working without an icon.
 */
export async function installRoAppIcon(raster: { url: string; width: number; height: number } | undefined): Promise<boolean> {
  if (!raster) return false;
  try {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return false;
    const base = (await (await fetch(link.href)).json()) as Record<string, unknown>;
    const icons = await scaledIcons(raster);
    const manifest = runtimeManifest(base, location.href, icons);
    link.href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
    let touch = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!touch) {
      touch = document.createElement("link");
      touch.rel = "apple-touch-icon";
      document.head.append(touch);
    }
    touch.href = icons[0]?.src ?? "";
    return true;
  } catch {
    return false;
  }
}
