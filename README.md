# Teams Web Backup

Teams Web Backup is a desktop application for creating a resumable local backup of Microsoft Teams Web chats when Microsoft Graph export permissions are unavailable.

The app opens Teams Web in an isolated Electron session. After you sign in normally, it walks the rendered chat interface, captures messages as they appear in Teams, and downloads accessible images, avatars, and shared files. Records and checkpoints are written continuously, so completed work survives an interrupted export.

> [!IMPORTANT]
> This is an unofficial fallback tool, not a Microsoft product and not a replacement for an authorized Microsoft Graph compliance export. Use it only with accounts and conversations you are permitted to back up.

## Highlights

- Backs up the current chat or every chat visible to the signed-in account.
- Scans the Shared area for the current chat or all chats.
- Expands the Teams `See more` chat control before an all-chat pass.
- Tracks chats by stable Teams identifiers, so incoming messages can reorder the list without breaking the sequence.
- Writes Graph-like JSONL records incrementally instead of holding the entire backup in memory.
- Saves checkpoints and resumes an existing export folder without duplicating completed messages or files.
- Uses the authenticated Teams session for image, avatar, and file downloads.
- Keeps message capture moving when an individual file or chat fails.
- Provides a download queue, bounded retries, progress diagnostics, and stuck-operation recovery.
- Supports system, light, and dark appearances.
- Includes English, Simplified Chinese, Traditional Chinese, Japanese, Spanish, French, German, Brazilian Portuguese, and Korean interfaces.
- Builds for macOS and Windows on Intel/AMD and ARM64.

## When to Use It

Use Teams Web Backup when you need a personal or business-authorized backup but your tenant administrator cannot grant the Microsoft Graph permissions required for chat export.

Prefer Microsoft Graph when those permissions are available. Graph is an official structured API and is less likely to be affected by Teams interface changes. This app extracts what Teams Web renders for the signed-in user, so policy-hidden, deleted, unavailable, or unloaded content cannot be recovered.

## How It Works

The exporter uses three cooperating paths:

1. **DOM capture:** The rendered Teams interface is the source of truth for chat names, visible messages, authors, timestamps, attachments, reactions, and file links.
2. **Authenticated downloads:** Electron downloads media and files through the same persistent session used by the embedded Teams page.
3. **Network observation:** Useful Teams network events are recorded for diagnostics, but the export does not depend on recognizing private API payloads.

For an all-chat export, the app first clicks the Recent Chats section's `See more` control until it disappears. It then performs bounded top-to-bottom sweeps and deduplicates by stable chat and message identifiers. If a new message moves a chat to the top during a run, later sweeps can still discover it.

Every message batch, file state change, and checkpoint is persisted promptly. A failed download does not roll back captured messages.

## Getting Started

### Run from source

Requirements:

- Node.js 20 or newer
- npm
- A Microsoft account that can use Teams Web
- Network access to Teams, SharePoint, OneDrive, and Microsoft media hosts used by your chats

```sh
git clone https://github.com/karhoong/Teams-Web-Backup.git
cd Teams-Web-Backup
npm install
npm run dev
```

### Create a backup

1. Sign in to Teams inside the application window.
2. Open the **Chat** area and wait for the readiness indicator.
3. Open **Settings** to choose the interface language, appearance, backup folder, and concurrent download count.
4. Choose an action from **Export Chat** or **Export Files**.
5. Keep the application open while the export and queued downloads run.
6. Open **Queue Items** when a download needs attention. Use **Dev Tools → App** or **Dev Tools → Browser** for deeper troubleshooting.

Current-chat actions remain disabled until a chat is open. All-chat actions remain disabled until the Teams chat list is ready.

## Export Modes

| Action | Scope | Result |
| --- | --- | --- |
| Export Chat → Current Chat | Open conversation | Captures its message history and queues media and attachments. |
| Export Chat → All Chats | Recent Chats list | Expands the list, visits each chat, captures messages, and queues media and attachments. |
| Export Files → Current Chat | Open conversation | Scans its Shared area and downloads available files without scrolling message history. |
| Export Files → All Chats | Recent Chats list | Expands the list, visits each chat, and scans the Shared area where available. |
| Resume | Existing export folder | Loads its checkpoint and continues unfinished chat and file work. |

External or restricted conversations may not expose a Shared area. They are skipped with a diagnostic entry rather than stopping the full run.

## Export Folder

The default location is:

```text
~/Downloads/teams-web-backup/<timestamp>/
```

An export contains:

| Path | Purpose |
| --- | --- |
| `manifest.json` | Export metadata, mode, version, and creation details. |
| `chats.jsonl` | One Graph-like chat record per line. |
| `chat_messages.jsonl` | One Graph-like message envelope per line. |
| `files.jsonl` | Append-only file discovery and download status history. |
| `network_events.jsonl` | Opportunistic network observations useful for troubleshooting. |
| `checkpoint.json` | Resume position and completed identifiers. |
| `files/<chat-name>/` | Files and message images grouped by chat. |
| `files/_profiles/` | Deduplicated participant avatars. |

Example:

```text
teams-web-backup/2026-07-17T01-23-45-678Z/
├── manifest.json
├── chats.jsonl
├── chat_messages.jsonl
├── files.jsonl
├── network_events.jsonl
├── checkpoint.json
└── files/
    ├── FE Team 2/
    │   ├── 1773373462269-report.pdf
    │   └── 1779716973128-image.jpg
    └── _profiles/
        └── participant-name-hash.jpg
```

JSONL is append-friendly: every non-empty line is an independent JSON object. The format is intentionally similar to Microsoft Graph output, but DOM provenance is retained and some fields may be unavailable or inferred from the rendered page.

## File States

The latest record for a file in `files.jsonl` can have one of these states:

| Status | Meaning |
| --- | --- |
| `queued` | Waiting for an available download worker. |
| `downloading` | Being transferred or awaiting a Teams browser download. |
| `downloaded` | Saved successfully at `localPath`. |
| `failed` | Automatic retries were exhausted. |
| `manual` | Teams redirected to an interactive authorization flow or did not expose an automatic download path. The original URL is retained. |

Normal web links are recorded as message content and are not downloaded. Images, avatars, PDFs, documents, archives, and other actual attachments are eligible for download.

## Resume and Recovery

Choose **Resume**, then select the timestamped export folder itself. The app restores:

- exported chat identifiers;
- exported message identifiers;
- file queue and latest statuses;
- downloaded local paths;
- checkpoint progress.

Already downloaded files and exported messages are skipped. Failed or manual records remain inspectable and may be retried during a later pass if Teams exposes a usable path.

Teams Web can occasionally stop responding to automated scrolling or navigation. Recovery is deliberately bounded:

- chat-open and message-scroll operations retry before being skipped;
- a stuck message pane is nudged by scrolling down and up;
- the exporter may visit another chat and return to recover a frozen conversation;
- Shared scans wait for content but eventually move to the next chat;
- the download queue has per-item retries and a final drain timeout;
- a stalled `See more` expansion is reported, then normal stable-ID sweeps continue;
- warnings and errors are retained by the app's diagnostics log for the current run.

The design favors a completed, inspectable backup with explicit failures over freezing forever on one Teams state.

## Privacy and Security

- Credentials are entered only into Microsoft's Teams sign-in page.
- The authenticated browser state is stored in the app's persistent Electron session on the local machine.
- **Teams → Reset Session** clears that cached session and returns to sign-in.
- Backup folders can contain sensitive messages, names, images, and business files. Protect them with appropriate disk encryption, access control, retention, and transfer policies.
- Do not publish real export folders, logs containing private URLs, or authenticated download links.

Your organization's policies and Microsoft terms still apply even though the app does not require Graph administrator consent.

## Development

```sh
npm install          # Install dependencies
npm run dev          # Build and launch Electron
npm run check        # TypeScript, renderer syntax checks, and tests
npm run test         # Unit tests only
npm run build        # Compile TypeScript into dist/
npm run pack         # Create an unpacked local application
```

The main architecture is split into:

- `src/main/`: application lifecycle, export orchestration, persistence, diagnostics, and download workers;
- `src/preload/teamsPreload.ts`: isolated Teams DOM discovery and interaction helpers;
- `src/preload/appPreload.ts`: safe renderer IPC bridge;
- `src/renderer/`: local controls, Settings, Queue, Diagnostics, themes, and translations;
- `src/shared/`: shared types and utilities;
- `src/test/`: focused persistence, queue, filename, preference, and deduplication tests.

## Packaging

Artifacts are generated under `release/` and are intentionally excluded from Git.

```sh
npm run dist:mac:arm64
npm run dist:mac:x64
npm run dist:win:x64
npm run dist:win:arm64
```

Build every supported target:

```sh
npm run dist
```

Current application identity:

- Product: `Teams Web Backup`
- Version: `1.0.4`
- Application ID: `com.karhoong.teamswebbackup`
- macOS bundle: DMG and ZIP
- Windows bundle: portable ZIP; an NSIS installer can be built with `npm run dist:win:installer`

### macOS signing

Local macOS packages are ad-hoc signed for testing but are not Apple-notarized. A downloaded internal build may be blocked by Gatekeeper. After independently verifying and accepting the build, a tester can remove its quarantine attribute:

```sh
xattr -dr com.apple.quarantine "/Applications/Teams Web Backup.app"
```

Public distribution should use a Developer ID Application certificate, Apple notarization, and a stapled ticket. Verify the local ARM64 bundle with:

```sh
npm run verify:mac:arm64
```

### Windows signing

Portable Windows ZIPs contain `Teams Web Backup.exe`. Unsigned builds may trigger Microsoft Defender SmartScreen. Public distribution should sign the executable and installer with a trusted Windows code-signing certificate.

## Known Limitations

- Teams can change its DOM structure without notice; selectors may require maintenance.
- Capture is limited to content rendered for the signed-in account.
- Very long conversations can take substantial time because Teams loads history incrementally.
- Some SharePoint and OneDrive links require interactive authorization and become `manual` records.
- External chats may not provide a Shared area.
- Deleted, policy-hidden, expired, or inaccessible content cannot be exported.
- Graph-like output is designed for backup and inspection; it is not a legal, compliance, or forensic archive.

## License

Released under the [MIT License](LICENSE).
