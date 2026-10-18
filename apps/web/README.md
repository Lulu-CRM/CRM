# Lulu CRM web app

Next.js (App Router) + TypeScript + Tailwind v4 + next-intl.

## Run

From the repository root:

```
npm install
npm run dev:web          # http://localhost:3000 -> /en/crm/overview
npm test -w @lulu/web    # unit tests
```

Copy `.env.example` to `apps/web/.env.local`. `NEXT_PUBLIC_USE_MOCK=true` (the default) serves the design's sample data from `packages/shared`. Set it to `false` and set `NEXT_PUBLIC_API_URL` to use the real API.

## Where things are

| Path | What |
| --- | --- |
| `src/app/[locale]/crm/<page>/page.tsx` | One folder per CRM page. Replace `<ComingSoon />` when you build a page |
| `src/components/layout` | App shell: rail, CRM nav, top bar, language switcher, `PageHeader` |
| `src/components/ui` | Shared components: Button, Pill, Avatar, Card, Modal, Drawer, Toast, Table, Pagination, EmptyState, Skeleton |
| `src/lib/api` | `api` client. `mock.ts` and `real.ts` have the same shape; `index.ts` picks one |
| `src/i18n` | Locales, routing, `useFormat()` for money, numbers and dates |
| `messages/*.json` | Translations. Every key must exist in all files (a test checks this) |
| `src/app/globals.css` | Design tokens as CSS variables, exposed to Tailwind (`bg-primary`, `text-text-muted`, ...) |

## Rules

- No text in components. Add a key to `messages/en.json`, `de.json` and `zh.json`.
- Import `Link`, `useRouter` and `usePathname` from `@/i18n/navigation`, not from Next, so the language stays in the URL.
- Show money with `useFormat().money({ amount, currency })`, never by joining strings.
- Show API errors with `useErrorMessage()` from `@/lib/errors`.
- To add a language: add it to `src/i18n/locales.json` and add `messages/<code>.json`. No code change.
