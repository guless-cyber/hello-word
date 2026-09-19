export const AMPLITUDE_EU_ENDPOINT = "https://api.eu.amplitude.com/2/httpapi";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validInstallationId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function installationIdFromSearch(search) {
  const value = new URLSearchParams(search).get("installation_id");
  return validInstallationId(value) ? value : null;
}

export function buildUninstallPayload({ apiKey, installationId, time }) {
  return {
    api_key: apiKey,
    events: [
      {
        event_type: "extension_uninstalled",
        device_id: installationId,
        time,
        insert_id: `extension_uninstalled:${installationId}`,
        event_properties: {
          schema_version: 1,
          surface: "uninstall_page"
        }
      }
    ]
  };
}

export async function sendUninstallEvent({
  apiKey,
  installationId,
  fetchImpl = globalThis.fetch,
  now = Date.now
}) {
  if (!validInstallationId(installationId) || typeof apiKey !== "string" || apiKey.length === 0) {
    return false;
  }

  const payload = buildUninstallPayload({
    apiKey,
    installationId,
    time: now()
  });

  try {
    const response = await fetchImpl(AMPLITUDE_EU_ENDPOINT, {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    return response?.ok === true;
  } catch {
    return false;
  }
}
