FROM docker.io/oven/bun:canary-slim

WORKDIR /app
COPY . .
RUN bun install
CMD ["bun", "run", "./index.ts"]
