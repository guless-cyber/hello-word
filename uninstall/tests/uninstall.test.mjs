import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { initUninstallPage } from "../main.mjs";
import { AMPLITUDE_EU_ENDPOINT, sendUninstallEvent } from "../tracking.mjs";

const VALID_ID = "9c20d91a-8b2f-4c68-8c65-88a534ac5859";
const API_KEY = "client-api-key";
const FORM_URL = "https://docs.google.com/forms/d/e/example/viewform?embedded=true";

function fakeDocument() {
  const frame = { hidden: true, src: "" };
  const link = { href: "" };
  return {
    frame,
    link,
    getElementById(id) {
      if (id === "feedback-form") return frame;
      if (id === "feedback-link") return link;
      return null;
    }
  };
}

test("valid UUID sends one exact event to Amplitude EU", async () => {
  const requests = [];
  const result = await sendUninstallEvent({
    apiKey: API_KEY,
    installationId: VALID_ID,
    now: () => 1_795_000_000_123,
    fetchImpl: async (...args) => {
      requests.push(args);
      return { ok: true };
    }
  });

  assert.equal(result, true);
  assert.equal(requests.length, 1);
  const [url, options] = requests[0];
  assert.equal(url, AMPLITUDE_EU_ENDPOINT);
  assert.deepEqual(options, {
    method: "POST",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    redirect: "error",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: API_KEY,
      events: [{
        event_type: "extension_uninstalled",
        device_id: VALID_ID,
        time: 1_795_000_000_123,
        insert_id: `extension_uninstalled:${VALID_ID}`,
        event_properties: {
          schema_version: 1,
          surface: "uninstall_page"
        }
      }]
    })
  });
});

test("missing or invalid UUID does not send a request", async () => {
  let requestCount = 0;
  const fetchImpl = async () => {
    requestCount += 1;
    return { ok: true };
  };

  assert.equal(await sendUninstallEvent({ apiKey: API_KEY, installationId: null, fetchImpl }), false);
  assert.equal(await sendUninstallEvent({ apiKey: API_KEY, installationId: "not-a-uuid", fetchImpl }), false);
  assert.equal(requestCount, 0);
});

test("network failure leaves the feedback form available", async () => {
  const documentRef = fakeDocument();
  const result = await initUninstallPage({
    documentRef,
    search: `?installation_id=${VALID_ID}`,
    config: {
      AMPLITUDE_CLIENT_API_KEY: API_KEY,
      GOOGLE_FORM_EMBED_URL: FORM_URL
    },
    fetchImpl: async () => {
      throw new Error("network unavailable");
    }
  });

  assert.equal(result, false);
  assert.equal(documentRef.frame.hidden, false);
  assert.equal(documentRef.frame.src, FORM_URL);
  assert.equal(documentRef.link.href, "https://docs.google.com/forms/d/e/example/viewform");
});

test("event omits user identity, page data, referrer, and extra query parameters", async () => {
  let body;
  await initUninstallPage({
    documentRef: fakeDocument(),
    search: `?installation_id=${VALID_ID}&email=person%40example.com&url=https%3A%2F%2Fprivate.example&anything=secret`,
    config: {
      AMPLITUDE_CLIENT_API_KEY: API_KEY,
      GOOGLE_FORM_EMBED_URL: FORM_URL
    },
    now: () => 1,
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return { ok: true };
    }
  });

  assert.deepEqual(Object.keys(body.events[0]).sort(), [
    "device_id",
    "event_properties",
    "event_type",
    "insert_id",
    "time"
  ]);
  assert.deepEqual(body.events[0].event_properties, {
    schema_version: 1,
    surface: "uninstall_page"
  });
  assert.equal(JSON.stringify(body).includes("person@example.com"), false);
  assert.equal(JSON.stringify(body).includes("private.example"), false);
  assert.equal(JSON.stringify(body).includes("anything"), false);
  assert.equal("user_id" in body.events[0], false);
});

test("HTML keeps the form independent from installation_id", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="feedback-form"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.doesNotMatch(html, /installation_id/);
});
