# discordbot1k

A Discord bot that manages a weekly classroom duty rotation (`služba`).

## Setup

Install dependencies:

```bash
bun install
```

Create `config.json` (untracked) from the template, then fill in your bot credentials
and the two duty channel IDs (`cronDutyChannelId` for the weekly announcement,
`commandDutyChannelId` for command output):

```bash
cp config.example.json config.json
```

## Running

Register the slash commands with your guild, then start the bot:

```bash
bun run deploy        # bun run deploy-commands.ts
bun run start         # bun run bot.ts
```

Typecheck without emitting, and run the duty-rotation tests:

```bash
bun run typecheck
bun run test
```

## Storage

Duty state lives in a SQLite database at `data/duty.db`, managed by `utils/db.ts` via Bun's
built-in `bun:sqlite` (no extra dependency). The schema is versioned with `PRAGMA user_version`.

On first start, if the database is empty and the legacy `data/duty.json` is present, the duty
order is imported from it automatically. The JSON file is left untouched as a backup and is never
read again. The database itself is gitignored — it is state, not source.

Every mutation (`/complete`, `/repeat`, `/reroll`, `/undo-reroll`) runs as a single synchronous
transaction, so overlapping interactions cannot clobber each other's writes.

The connection is opened lazily on first use, so `bun run deploy` — which imports every command
module but needs no duty state — never touches the database.

Set `DUTY_DB_PATH` to override the database location (the tests use `:memory:`).

### Docker

State is in `data/`, so it must be mounted or it is lost on every rebuild:

```bash
docker run -v duty-data:/app/data discordbot1k
```

With a **named volume** Docker seeds the fresh volume from the image, so `data/duty.json` is
present and the first-boot import works. With a **bind mount** (`-v ./data:/app/data`) the host
directory shadows the image, so copy `duty.json` into it first or start from an empty order.

## Layout

| Path | Purpose |
| --- | --- |
| `bot.ts` | Client entrypoint: command dispatch and the cron schedules |
| `deploy-commands.ts` | Registers slash commands with the guild |
| `commands/utility/*.ts` | One slash command per file, default-exporting a `Command` |
| `utils/duty.ts` | Reads and mutates the duty rotation in `data/duty.db` |
| `utils/db.ts` | SQLite connection, schema migration and the legacy JSON import |
| `paths.ts` | `projectRoot`, split out so path users need not load `config.json` |
| `utils/channels.ts` | Resolves a channel id to a sendable channel, with fetch fallback |
| `utils/commands.ts` | Shared command loader used by both entrypoints |
| `types.ts` | `Command`, `Config`, `LegacyDutyData` and the `Client.commands` augmentation |
| `constants.ts` | Tunables not tied to a deployment |

### Adding a command

Create a file under `commands/utility/` that default-exports a `Command`, then re-run
`bun run deploy`. Both the bot and the deploy script discover it automatically.

This project uses [Bun](https://bun.sh), which runs TypeScript directly — there is no build step.
