FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/index.ts ./src/index.ts
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["bun", "src/index.ts"]
