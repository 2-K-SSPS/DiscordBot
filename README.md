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

## Commands

| Command | Who | What |
| --- | --- | --- |
| `/list` | everyone | Short preview of the order |
| `/announce` | everyone | Re-posts who is on duty this week |
| `/complete` | everyone | Finishes the duty early; the person goes to the back |
| `/repeat` | everyone | Puts the previous person back at the front |
| `/reroll` | everyone | Skips whoever is on duty; they get it next week |
| `/undo-reroll` | everyone | Reverses the last `/reroll` exactly |
| `/roster` | admin | The **full** order, with markers for who is on duty and who was skipped |
| `/add` | admin | Adds a person, or every member of a role |
| `/remove` | admin | Removes a person |

`/add`, `/remove` and `/roster` default to Administrator only; the rest are left to whatever
per-server permissions you configure. Every reply is ephemeral — the mutating commands additionally
post to `commandDutyChannelId` so the channel keeps an honest log. A command that cannot do
anything (an empty order, nothing left to reroll, nothing to undo) says so and posts nothing.

### Adding a whole role

`/add role:@Trida` needs Discord's **Server Members Intent**: without it, `GET /guilds/{id}/members`
is refused and the command replies telling you to enable it in the
[Developer Portal](https://discord.com/developers/applications) under *Bot → Privileged Gateway
Intents*. Nothing else breaks in the meantime — the bot never requests the intent at the gateway,
so it always starts, and `/add user:@Nekdo` keeps working either way.

## The weekly announcement

The rotation advances once per ISO week, announced at **Monday 07:40 Europe/Prague**.

The schedule ticks *daily* at 07:40 rather than only on Mondays, and the handler decides whether
the week's announcement is actually due. That makes a missed Monday self-healing: if the bot is
offline all Monday, Tuesday's tick posts it, and the rotation advances **once** no matter how many
weeks were missed. The ISO week of the last announcement is stored in
`duty_state.last_completed_week`, which makes the extra ticks idempotent — the same check runs once
more at startup, so a bot that was down across the whole day catches up as soon as it returns.

A manual `/complete` deliberately does *not* record the week, so finishing a duty early does not
also cancel the coming Monday.

## Storage

Duty state lives in a SQLite database at `data/duty.db`, managed by `utils/db.ts` via Bun's
built-in `bun:sqlite` (no extra dependency). The schema is versioned with `PRAGMA user_version`.

On first start, if the database is empty and the legacy `data/duty.json` is present, the duty
order is imported from it automatically. The JSON file is left untouched as a backup and is never
read again. The database itself is gitignored — it is state, not source.

Every mutation (`/complete`, `/repeat`, `/reroll`, `/undo-reroll`, `/add`, `/remove`) runs as a
single synchronous transaction, so overlapping interactions cannot clobber each other's writes.

Migrations are stepwise and stamped in `PRAGMA user_version`, applied inside the same transaction
as the schema change. A fresh database runs the same steps as an existing one, so the two cannot
drift apart. Schema v2 adds `last_completed_week` and clears any reroll state left over from v1,
whose stored indices meant something different.

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
| `utils/week.ts` | Prague-local ISO week and "is the announcement due" helpers |
| `utils/members.ts` | Lists a role's members over REST, for `/add role:` |
| `utils/replies.ts` | Czech text for mutations that could not do anything |
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
