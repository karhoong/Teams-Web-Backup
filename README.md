# Teams Web Backup

Teams Web Backup is an Electron desktop app for exporting Microsoft Teams Web chats when Microsoft Graph export permissions are not available.

It opens Teams Web inside Electron, lets you sign in normally, then drives the rendered Teams UI to capture chats, messages, images, avatars, and shared files into a resumable local export folder. The output is written incrementally so a failed file download, Teams UI glitch, or app restart should not lose already captured data.

This project is a fallback backup tool. If your tenant admin can grant the required Microsoft Graph permissions, Graph export remains the cleaner and more stable option.

## Features

- Uses your normal Teams Web login session.
- Exports current chat, all chats, current Shared tab, or Shared files for all chats.
- Writes Graph-like JSONL records while exporting.
- Saves a checkpoint so exports can resume from an existing folder.
- Downloads images and avatars through the logged-in Teams session.
- Attempts Teams Shared-tab downloads through the Teams UI when direct file URLs redirect to Microsoft sign-in.
- Keeps message export moving when file downloads fail.
- Shows a resizable download queue and diagnostics window.
- Retries or skips stuck chats, stuck scrolls, failed Shared scans, and slow downloads instead of freezing indefinitely.
- Supports light mode, dark mode, or the system appearance. System appearance is the default.
- Includes English, Simplified Chinese, Traditional Chinese, Japanese, Spanish, French, German, Brazilian Portuguese, and Korean interfaces.
- Shows the installed app version in the window title, toolbar, Settings, queue, and diagnostics windows.

## How It Works

The app uses a hybrid capture model:

- DOM extraction is the authoritative source for visible chat messages and file links.
- Electron session downloads use the logged-in Teams session where possible.
- Network observation is opportunistic and useful for diagnostics, but export does not depend on matching Teams network payloads.

For all-chat export, the app walks the Teams chat list by stable Teams chat keys, not row positions. Because Teams can reorder chats when new messages arrive, the exporter performs bounded top-to-bottom sweeps and rescans the top of the list for newly bumped chats before finishing.

## Export Output

By default, exports are written to:

```text
~/Downloads/teams-web-backup/<timestamp>/
```

Each export folder contains:

```text
manifest.json
chats.jsonl
chat_messages.jsonl
files.jsonl
network_events.jsonl
checkpoint.json
files/
```

Typical file layout:

```text
files/
  <chat-name>/
    <message-id>-<filename>
  _profiles/
    <person>-<hash>.jpg
```

JSONL files are append-friendly: each line is a standalone JSON object. This makes the export easier to inspect, stream, repair, and resume.

## Status Values

File records in `files.jsonl` can have these statuses:

- `queued`: waiting for a download worker.
- `downloading`: currently being downloaded or waiting for Teams browser download completion.
- `downloaded`: saved locally.
- `failed`: failed after retries.
- `manual`: could not be downloaded automatically; the original URL is preserved for manual handling.

The exporter does not block message capture on file failures.

## Requirements

- Node.js 20 or newer is recommended.
- npm.
- A Microsoft account that can open Teams Web.
- Network access to Teams and Microsoft file hosts.

## Development

Install dependencies:

```sh
npm install
```

Run the app locally:

```sh
npm run dev
```

Run static checks and tests:

```sh
npm run check
```

Run tests only:

```sh
npm run test
```

Build TypeScript only:

```sh
npm run build
```

## Using the App

1. Start the app.
2. Sign in to Teams Web inside the app window.
3. Open the Teams Chat view.
4. Choose an export folder, or let the app create one under Downloads.
5. Open `Settings` to choose an appearance and interface language. Settings are saved automatically for future launches.
6. Use one of the export actions:
   - `Export Current Chat`
   - `Export All Chats`
   - `Shared Current`
   - `Shared All Chats`
7. Watch Diagnostics and Queue Items if anything appears stuck.
8. If the app is stopped or closed, use `Resume` and choose the existing export folder.

## Resume Behavior

Resume loads:

- already exported chats,
- already exported message IDs,
- existing file statuses,
- checkpoint metadata.

Downloaded files are skipped. Manual or failed file records can be revisited by later export passes if Teams exposes a better download path.

## Stuck Export Protection

Teams Web is a large, dynamic app and can occasionally stop responding to UI automation. The exporter is designed to keep moving:

- chat open failures are retried, then skipped with diagnostics;
- message scroll failures trigger scroll recovery;
- the app may switch to a neighboring chat and back to unstick the message pane;
- Shared-tab scan failures are logged and skipped;
- Shared file menu download failures become `manual` file records;
- final queue drain has a time limit, after which remaining pending files become `manual`;
- all-chat export performs multiple bounded list sweeps to catch chats that move upward due to new messages.

These protections favor completing the export pass over waiting forever on one Teams UI state.

## Packaging

Release packaging uses Electron Builder. Artifacts are written to `release/`.

```sh
npm run pack
npm run dist:mac:arm64
npm run dist:mac:x64
npm run dist:win:x64
npm run dist:win:arm64
```

Convenience commands:

```sh
npm run dist:mac:all
npm run dist:win:all
npm run dist
```

Current app identity:

- Product name: `Teams Web Backup`
- App ID: `com.karhoong.teamswebbackup`
- Version: `1.0.2`
- macOS icon: `build/icon.icns`
- Windows icon: `build/icon.ico`
- Runtime/window icon: `build/icon.png`

## Windows Distribution

Windows ZIP builds are produced by:

```sh
npm run dist:win:x64
```

The ZIP contains a portable unpacked app. Users can extract it and run `Teams Web Backup.exe`.

Unsigned Windows builds may show SmartScreen warnings. For broader distribution, sign the executable with a trusted code-signing certificate.

## macOS Distribution

The local macOS build is ad-hoc signed for internal testing. It is not Apple-notarized by default.

Verify an arm64 build:

```sh
npm run verify:mac:arm64
```

If a trusted internal tester sees a macOS warning such as `"Teams Web Backup" is damaged and can't be opened`, it is usually Gatekeeper quarantine on an unsigned or unnotarized download. They can remove quarantine manually:

```sh
xattr -dr com.apple.quarantine "/Applications/Teams Web Backup.app"
```

For public macOS distribution:

1. Enroll in the Apple Developer Program.
2. Install a `Developer ID Application` certificate.
3. Configure Electron Builder notarization credentials.
4. Build, notarize, and staple the app before sharing.

## Privacy and Security

Exports may contain sensitive personal, business, and file data. Store export folders securely and only use this tool for accounts and chats you are authorized to back up.

The app does not require Microsoft Graph admin permissions, but it operates through your logged-in Teams Web session. Your organization's policies and Microsoft Teams terms still apply.

## Limitations

- Teams Web DOM structure can change and may require selector updates.
- Very old messages may require long scroll sessions.
- Some SharePoint/OneDrive file URLs may redirect to Microsoft sign-in and become `manual`.
- External chats may not expose a Shared tab.
- Deleted, edited, or policy-hidden messages are only captured as Teams Web renders them.
- This is not a forensic archive tool; it is a practical user-session backup fallback.

## Repository Hygiene

The repo intentionally ignores:

- `node_modules/`
- `dist/`
- `release/`
- local environment files
- logs
- OS/editor noise

Build resources under `build/` are tracked because Electron Builder needs the icons and macOS entitlements.
