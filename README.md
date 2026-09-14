# Influencer Sync for Obsidian

[Download Obsidian from the official website](https://obsidian.md/download).

Influencer Sync periodically synchronizes Jira influencer cards with Obsidian
Markdown notes. Each card is stored in a separate
`<influencerId> <displayName>.md` file.

## Installation

After the plugin is available in the Obsidian Community directory:

1. Open `Settings` → `Community plugins`.
2. Disable restricted mode if it is enabled.
3. Select `Browse`, find `Influencer Sync`, and select `Install`.
4. Select `Enable`.

For manual installation, download `main.js` and `manifest.json` from the
[latest GitHub release](https://github.com/Web-Chats/obsidian-influencers/releases/latest),
place them in `<vault>/.obsidian/plugins/influencers/`, and enable the plugin
under `Community plugins`.

## Features

- Downloads every page of the influencer registry, channels, campaign
  memberships, and comments.
- Provides separate `Download from Jira` and `Send local changes to Jira`
  commands.
- Requires explicit confirmation before every download and upload.
- Uses the status bar button only to download from Jira.
- Supports scheduled downloads from every 5 minutes; the default is 60 minutes.
- Does not send a request when Obsidian starts. The first request occurs on the
  schedule or when a command is run.
- Uses read-only mode when `permissions.write` is unavailable.
- Enables write-back by default only for the explicit upload command.
- Protects remote changes with optimistic locking.
- Downloads the current AI contract from Jira to `Influencers/_AI`.

HTTP requests use Obsidian's `requestUrl`, which lets the desktop and mobile
apps access the configured Jira API without browser CORS restrictions.

## Settings

- Jira API URL, for example
  `https://jira.example.com/rest/asbis-inf/2.0`.
- Personal access token.
- Notes folder; the default is `Influencers`.
- Synchronization interval in minutes.
- Local change upload toggle.

The token is stored in the plugin's local `data.json`. This file is excluded
from Git and is never written to notes.

## Network and privacy

The plugin connects only to the Jira API URL configured by the user. During a
download it retrieves influencer cards, comments, and the AI contract. During
an explicit upload it sends modified allowed fields and new comments. Every
direction requires confirmation.

The personal access token is stored locally by Obsidian and is sent only to the
configured Jira API in the authorization header. The plugin has no telemetry,
analytics, advertising, or third-party network services.

## AI contract

During synchronization, the plugin requests
`GET /ai/obsidian-card-contract` and saves the server-provided
`_AI/influencer-card.schema.json` and `_AI/AI-INSTRUCTIONS.md` files in the
cards folder. The schema is not bundled with the plugin, so Jira remains the
single source of the current contract. The plugin verifies that the contract
does not expand the six-field write allowlist.

The plugin never overwrites files without its service marker. A contract
download failure is shown to the user but does not stop regular card
synchronization.

## Note format and write-back

Frontmatter contains the influencer identifier, version, synchronization time,
status, country, agency, ratings, campaign count, and editable fields. Exactly
six fields can be sent to Jira:

- `realName`
- `email`
- `messenger`
- `agencyManager`
- `commercialOfferUrl`
- `internalRating`

Before each `PUT`, the plugin reads the card again and builds a complete form
using only writable contract fields. Computed fields such as `rating`,
`campaignsCount`, `brands`, `platforms`, `followersByPlatform`,
`accountUrlsByPlatform`, and `minimumPrice` are never included in the request.

Text added below `<!-- comments -->` is sent as one new comment. After a
successful `POST`, the local text is cleared immediately so that a subsequent
read failure cannot send the same comment twice.

If the version changes before `PUT`, or Jira returns `409 VERSION_CONFLICT`,
the plugin does not retry with the new version. It downloads the current card,
saves it to the note, and preserves local values under
`## Not sent (conflict)`.

## Development

Node.js 20 or later is required.

```bash
npm install
npm test
npm run build
```

For a local Jira instance, configure:

```text
http://localhost/rest/asbis-inf/2.0
```

Tests do not use the network and do not require a token. Manual tests can read
the token from `INF_PAT`; never add it to source files, package scripts, or Git.

`npm run build` checks TypeScript and creates `main.js`. Manual installation
requires `main.js` and `manifest.json`.

## Manual verification

1. Run `npm install && npm run build`.
2. Create `<vault>/.obsidian/plugins/influencers/` and copy `main.js` and
   `manifest.json` into it.
3. Enable `Influencer Sync` under Obsidian Community plugins.
4. Configure the API URL, personal token, notes folder, and interval.
5. Run `Download from Jira` or select the status bar action.
6. Confirm that the notes contain `influencerId`, `version`, and `syncedAt` in
   frontmatter.
7. Enable write-back, add a comment below `<!-- comments -->`, and run
   `Send local changes to Jira`.
8. Confirm that the comment appears once in Jira and once in the server comment
   history in the note.
9. To test a conflict, edit a writable field in the note, edit the same card in
   Jira, and upload. The current Jira version must remain in frontmatter, the
   `PUT` must not be retried, and the local value must appear under
   `## Not sent (conflict)`.

## Skeleton origin and license

The `manifest.json`, `versions.json`, `tsconfig.json`, `esbuild.config.mjs`, and
`version-bump.mjs` structure is adapted from the official
[obsidianmd/obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin),
licensed under 0BSD. This project uses the same license; see `LICENSE`.

The Obsidian `requestUrl` configuration for mutating requests (`contentType`
and same-origin `Origin`) was checked against the open-source
[angelperezasenjo/obsidian-to-jira](https://github.com/angelperezasenjo/obsidian-to-jira),
licensed under MIT.
