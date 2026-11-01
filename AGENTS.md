# Haus Blick — HACS dashboard card

This is a fresh Home Assistant frontend project. Do not restore the former Python add-on, Supervisor configuration, SQLite database or standalone hosting stack.

- The card receives existing entity states through the Home Assistant `hass` property. Never add MQTT credentials, long-lived access tokens, a second HA connection or a backend for this use case.
- `src/config.ts` validates a detached card configuration and translates rooms/markers into the public Fabriqon model. Validate finite dimensions, bounds, IDs and references before rendering.
- `src/card.ts` owns one SDK viewer per connected, visible card. Update marker materials/text for state changes; do not recreate the viewer or geometry for each `hass` update. Release WebGL, observers and listeners when disconnected or after context loss.
- Use textContent for configuration and entity values. Only static trusted markup belongs in innerHTML. More-info uses the standard composed/bubbling `hass-more-info` event, never a private API or service call.
- `src/editor.ts` emits `config-changed`. Home Assistant owns configuration persistence; no hidden browser storage or automatic writes to HA configuration.
- The SDK is an explicit, checksummed public runtime snapshot in vendor/. Regenerate it with `node scripts/update-sdk.mjs /path/to/clean/sdk COMMIT_SHA`; never hand-edit its generated files. Preserve all upstream MIT notices.
- Build exactly one self-contained `dist/haus-blick.js`. It is intentionally tracked for HACS custom repositories without a release. No CDN, remote fonts, dynamic chunks or private App sources. Dependency upgrades and HACS directory inclusion are separate decisions.
- Run npm ci, npm run check, npm test, npm run build, npm run check:package and npm run test:browser. Use CHROMIUM_PATH if a browser is already installed. CI checks the committed bundle against a reproducible rebuild.
- Browser fixtures simulate Home Assistant. Report real HA/HACS installation and Companion App testing as pending until actually performed. Never describe mocked tests as live HA acceptance.
- Keep README, docs, examples, hacs.json and package version consistent. No secrets, captured sensor payloads, local HA data or generated test output in commits.

Node 22/24 and npm with package-lock.json are the supported development tools. This card and its vendored runtime are MIT licensed; the private Fabriqon App is unrelated.
