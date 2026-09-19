import { installationIdFromSearch, sendUninstallEvent } from "./tracking.mjs";

function feedbackUrls(value) {
  try {
    const url = new URL(value);
    const isGoogleForm = url.protocol === "https:"
      && url.hostname === "docs.google.com"
      && /^\/forms\/(?:d\/e\/[^/]+|d\/[^/]+)\/viewform$/.test(url.pathname)
      && url.searchParams.get("embedded") === "true";
    if (!isGoogleForm) return null;
    return {
      embed: `${url.origin}${url.pathname}?embedded=true`,
      fallback: `${url.origin}${url.pathname}`
    };
  } catch {
    return null;
  }
}

export function configureFeedbackForm(documentRef, configuredUrl) {
  const frame = documentRef.getElementById("feedback-form");
  const link = documentRef.getElementById("feedback-link");
  const urls = feedbackUrls(configuredUrl);

  if (!frame || !link || !urls) return false;

  frame.src = urls.embed;
  frame.hidden = false;
  link.href = urls.fallback;
  return true;
}

export async function initUninstallPage({
  documentRef = globalThis.document,
  search = globalThis.location?.search ?? "",
  config = globalThis.UNINSTALL_CONFIG ?? {},
  fetchImpl = globalThis.fetch,
  now = Date.now
} = {}) {
  configureFeedbackForm(documentRef, config.GOOGLE_FORM_EMBED_URL);

  const installationId = installationIdFromSearch(search);
  return sendUninstallEvent({
    apiKey: config.AMPLITUDE_CLIENT_API_KEY,
    installationId,
    fetchImpl,
    now
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  void initUninstallPage();
}
