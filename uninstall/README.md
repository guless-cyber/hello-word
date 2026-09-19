# Uninstall page

Public route: `https://downloadwebpageaspdf.com/uninstall?installation_id=<UUID>`.

## Configuration

`config.js` contains the two public browser-side configuration values:

- `AMPLITUDE_CLIENT_API_KEY` — Amplitude client API key, never a secret key.
- `GOOGLE_FORM_EMBED_URL` — a Google Forms embed URL ending in `viewform?embedded=true`.

The current Google Form is:
`https://docs.google.com/forms/d/e/1FAIpQLSe-ek0KMli33WJ4BRr567q9w9cTzwRTs5OPq510VAW6YhlPFw/viewform?embedded=true`.

## Run locally

From the website repository root:

```sh
python3 -m http.server 8080
```

Then open `http://localhost:8080/uninstall?installation_id=9c20d91a-8b2f-4c68-8c65-88a534ac5859`.

Run the tests with:

```sh
npm test --prefix uninstall
```

## Extension setup

Generate and persist one UUID per installation, then register the uninstall URL from the extension service worker:

```js
chrome.runtime.setUninstallURL(
  `https://downloadwebpageaspdf.com/uninstall?installation_id=${installationId}`
);
```

Do not add any other query parameters. The page validates the UUID before sending one `extension_uninstalled` event to Amplitude EU. The feedback form never receives the installation ID.
