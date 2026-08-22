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

Typecheck without emitting:

```bash
bun run typecheck
```

## Layout

| Path | Purpose |
| --- | --- |
| `bot.ts` | Client entrypoint: command dispatch and the cron schedules |
| `deploy-commands.ts` | Registers slash commands with the guild |
| `commands/utility/*.ts` | One slash command per file, default-exporting a `Command` |
| `utils/duty.ts` | Reads and mutates the duty rotation in `data/duty.json` |
| `utils/commands.ts` | Shared command loader used by both entrypoints |
| `types.ts` | `Command`, `Config`, `DutyData` and the `Client.commands` augmentation |
| `constants.ts` | Tunables not tied to a deployment |

### Adding a command

Create a file under `commands/utility/` that default-exports a `Command`, then re-run
`bun run deploy`. Both the bot and the deploy script discover it automatically.

This project uses [Bun](https://bun.sh), which runs TypeScript directly — there is no build step.
