FROM oven/bun:1.2.2

WORKDIR /app

COPY package.json ./

RUN bun install

COPY . .

ENV NODE_ENV=production

# Duty state lives in data/duty.db; mount a volume or it is lost on rebuild.
VOLUME /app/data

CMD bun run ./deploy-commands.ts && bun run ./bot.ts