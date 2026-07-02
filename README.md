# Microsoft Teams Web Backup

Electron fallback exporter for Microsoft Teams Web when Microsoft Graph export permissions are unavailable.

The app opens Teams Web with your normal logged-in browser session inside Electron, reads the rendered Teams UI while scrolling, and writes Graph-like JSONL records incrementally to disk. DOM extraction is authoritative. Network capture is opportunistic and never required for export success.

## Usage

```sh
npm install
npm run dev
```

1. Sign in to Teams Web in the app window.
2. Open the Teams Chats view.
3. Choose an export folder if desired.
4. Run **Export current chat** or **Export all chats**.

Exports default to `~/Downloads/teams-web-backup/<timestamp>/` and include:

- `manifest.json`
- `chats.jsonl`
- `chat_messages.jsonl`
- `files.jsonl`
- `network_events.jsonl`
- `checkpoint.json`
- `files/<chat-slug>/...`

## Notes

- Message JSONL is flushed as messages are discovered.
- File downloads are queued and retried without blocking message export.
- Resume from an existing export folder reloads prior message/file state and continues exporting.
- `microsoft-teams-viewer` is intentionally not used or modified.

## Production builds

Release packaging uses Electron Builder. Artifacts are written to `release/`.

```sh
npm run check
npm run dist:mac:arm64
npm run dist:mac:x64
npm run dist:win:x64
npm run dist:win:arm64
```

Convenience commands:

- `npm run pack` creates an unpacked local app directory for packaging smoke tests.
- `npm run dist:mac:all` builds macOS arm64 and x64 DMG/ZIP artifacts.
- `npm run dist:win:all` builds Windows x64 and arm64 ZIP artifacts.
- `npm run dist:win:installer` builds a Windows x64 NSIS installer.
- `npm run dist` builds all configured macOS and Windows ZIP/DMG targets.

Current release identity:

- Product name: `Teams Web Backup`
- App ID: `com.karhoong.teamswebbackup`
- macOS icon: `build/icon.icns`
- Windows icon: `build/icon.ico`
- Runtime/window icon: `build/icon.png`

macOS builds are unsigned unless a valid Developer ID Application certificate is available in the keychain. Unsigned builds are usable for local/internal testing, but public distribution should be signed and notarized.

### macOS Gatekeeper

The macOS build is ad-hoc signed so the bundle is sealed and can be verified locally:

```sh
npm run verify:mac:arm64
```

For sharing outside your own machine, Apple Gatekeeper still expects Developer ID signing and notarization. Without notarization, downloaded copies may show `"Teams Web Backup" is damaged and can't be opened` because browsers add the quarantine attribute.

Internal workaround for trusted recipients:

```sh
xattr -dr com.apple.quarantine "/Applications/Teams Web Backup.app"
```

Real public-distribution fix:

1. Enroll in the Apple Developer Program.
2. Install a valid `Developer ID Application` certificate.
3. Configure Electron Builder notarization credentials.
4. Rebuild the DMG/ZIP and notarize/staple the result before sharing.
