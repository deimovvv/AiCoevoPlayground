/**
 * Single source of truth for downloading generated media.
 * ─────────────────────────────────────────────────────────
 * Why this exists: a plain `<a download>` (or `fetch()` then blob) FAILS for the
 * URLs we deal with. Fal CDN doesn't send `Access-Control-Allow-Origin`, so a
 * client-side fetch throws, and browsers ignore the `download` attribute on a
 * cross-origin URL — the file just opens in a new tab instead of saving.
 *
 * The fix: route every remote download through our backend proxy, which fetches
 * the file server-side (no CORS) and streams it back with a
 * `Content-Disposition: attachment` header so the browser always saves it.
 *
 * blob:/data: URLs are same-origin and download directly — no proxy needed.
 */

const API_BASE = "http://127.0.0.1:8000";

function clickDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Download any media URL as a file (never opens a new tab).
 * @param url       Fal CDN, our /static (absolute or relative), Google Storage, or a blob:/data: URL.
 * @param filename  The name the browser should save it as (include the extension).
 */
export function downloadFile(url: string, filename: string) {
  if (!url) return;

  // Local URLs: the download attribute works (same-origin), skip the proxy.
  if (url.startsWith("blob:") || url.startsWith("data:")) {
    clickDownload(url, filename);
    return;
  }

  // Resolve relative /static paths to the backend origin so the proxy can fetch them.
  const abs = url.startsWith("http") ? url : `${API_BASE}${url}`;
  const proxied = `${API_BASE}/api/download?url=${encodeURIComponent(abs)}&filename=${encodeURIComponent(filename)}`;
  clickDownload(proxied, filename);
}
