# Lulu CRM

Monorepo for Lulu, a SaaS where a business runs itself. This repo contains the CRM module: a Next.js frontend (`apps/web`), an Express API (`apps/api`) and shared Zod schemas (`packages/shared`).

## One-command start (Docker)

Requires Docker with the compose plugin.

```sh
npm run docker:up
```

This builds the API image, starts PostgreSQL 16 and Redis 7, waits for both to be healthy, applies all Prisma migrations, runs the idempotent seed (design sample data: 1 workspace, 2 users, 4 companies, 5 contacts, a default pipeline with 6 stages, 4 deals, 3 notes, 5 activities) and serves the API on port 4000. The first run takes a few minutes while the image builds.

Once the `api` service is `healthy`:

```sh
curl http://localhost:4000/health        # {"data":{"status":"ok","checks":{"database":"ok","redis":"ok"}}}
curl http://localhost:4000/health/live   # liveness only, no dependencies touched
```

Stop the stack with `Ctrl+C` or `npm run docker:down`. To also delete the database volumes and start from scratch next time: `npm run docker:reset`.

### Ports

| Service    | Host port |
| ---------- | --------- |
| API        | 4000      |
| PostgreSQL | 5432      |
| Redis      | 6379      |

Stop any local Postgres/Redis already using those ports before starting the stack.

### Configuration

`docker compose` interpolates from a root `.env` (optional for a first start):

```sh
cp .env.example .env
```

`JWT_SECRET`, `AI_PROVIDER`, `AI_API_KEY`, `CORS_ORIGIN`, `NODE_ENV` and `SEED_ON_START` are read from there; the local `lulu` / `lulu_dev_password` database credentials in `docker-compose.yml` are throwaway container values. Real secrets never go into git.

### Reseed and reset

```sh
npm run docker:up          # start (migrations + seed run on boot)
docker compose exec api npm run seed   # reseed (idempotent)
npm run docker:reset       # stop and DELETE the database volumes
```

## Non-Docker start

Run the API on the host against a local or hosted database and cache. Local works with anything that speaks the Postgres and Redis protocols on `localhost` — for example the databases from the Docker stack:

```sh
docker compose up -d postgres redis    # just the databases, no API container
npm install
cp apps/api/.env.example apps/api/.env # defaults point at the compose databases above
npm run db:generate -w @lulu/api       # generate the Prisma client
npm run db:migrate -w @lulu/api        # apply migrations
npm run seed -w @lulu/api              # optional: load the sample data
npm run dev:api                        # API on http://localhost:4000
```

The `.env.example` defaults (`lulu` / `lulu_dev_password` on `localhost:5432`, Redis on `localhost:6379`) match the compose databases, so the copy step needs no edits for local work. For a hosted database (Neon) and cache (Upstash), replace `DATABASE_URL` and `REDIS_URL` in `apps/api/.env` with your URLs first — Upstash uses `rediss://`.

Stop the databases with `docker compose down`. Copy the root `.env.example` to `.env` as well if you want the web app or `docker compose` interpolation to pick up your values.

## Repository layout

| Path              | What it is                                              |
| ----------------- | ------------------------------------------------------- |
| `apps/web`        | Next.js frontend (i18n: English, German, Chinese)       |
| `apps/api`        | Express API — see `apps/api/README.md` for scripts      |
| `packages/shared` | Zod schemas and types used by both apps                 |
| `docs`            | Plan, data model and API contract                       |
| `design`          | MagicPath design export — reference only, never edit    |
| `tasks.md`        | Task list and per-task done criteria                    |

Working agreements and conventions live in [`AGENTS.md`](AGENTS.md).
