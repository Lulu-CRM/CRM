# @lulu/api

Express API for the Lulu CRM module. Boots without connecting to anything yet; database and Redis checks land in a later prompt.

## Scripts

| Script        | What it does                                        |
| ------------- | --------------------------------------------------- |
| `npm run dev` | Runs `src/server.ts` in watch mode with tsx          |
| `npm run build` | Compiles TypeScript to `dist/` (CommonJS)          |
| `npm start`   | Runs the compiled server (`node dist/server.js`)     |
| `npm run typecheck` | Type-checks everything, no emit                 |
| `npm run lint` | ESLint (type-checked rules, floating promises, any) |
| `npm run format` | Prettier write                                     |
| `npm test`    | Vitest run (unit tests, `*.int.test.ts` excluded)   |
| `npm run test:watch` | Vitest in watch mode                         |

## Folders

| Folder        | Purpose                                              |
| ------------- | ---------------------------------------------------- |
| `src/config`  | Env loading and parsing (`env.ts` is the only source of config) |
| `src/routes`  | Express routers, mounted under `/api/v1` by `routes/index.ts` |
| `src/services`| Business logic used by routes                        |
| `src/middleware` | Express middleware (auth, errors, etc.)           |
| `src/jobs`    | BullMQ background jobs (import, AI analysis)         |
| `src/lib`     | Small shared helpers                                 |
| `src/db`      | Database client setup (Prisma, later)                |

## Conventions

- Never read `process.env` outside `src/config/env.ts`; import `env` from there.
- Health is served at `GET /health` and `GET /api/v1/health`.
- Test env vars are injected by `vitest.config.ts` (`test.env`); no real `.env` is needed to run tests.
