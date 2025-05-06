FROM oven/bun:1.2.2

WORKDIR /app

COPY package.json ./

RUN bun install

COPY . .

ENV NODE_ENV=production

CMD bun run ./deploy-commands.js && bun run ./bot.js