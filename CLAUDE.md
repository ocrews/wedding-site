# CLAUDE.md

Guidance for Claude (and any AI agent) working in this repo. Humans: see README.md.

## Hard rules

1. **Never commit real wedding or guest data.** This repo is public. No last names, guest names,
   emails, phone numbers, addresses (venue, hotels, guests), booking links/codes, registry URLs,
   real photos, or household/invite codes. Real content lives in Postgres and is edited via the
   admin dashboard; the repo only knows the _shape_ (Zod/Drizzle schema).
   Seeds, fixtures, and tests use `@wedding/seed` (names tagged `(Fake)`, emails `@example.test`,
   phones `555-01xx`).
2. **Never read or print secrets.** Don't open `.env*` (except `.env.example`), `*.pem`, `*.key`,
   or anything under `secrets/`. Secrets live only in GitHub Environments.
3. **Branch + PR for everything.** Branch names: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
   Never push to `main`, never force-push, **never merge** — Owen reviews and merges.
4. **Ask first** before: infrastructure changes (Terraform, Ansible, DNS, Cloudflare), anything
   that costs money, adding a heavy dependency, or changing auth/security behavior.
5. No book/film IP in game or theme assets. No real coordinates in map assets.

## Before opening a PR

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm pii-guard            # pattern scan; CI also checks a private denylist
./scripts/smoke.sh        # needs Docker; CI runs it if you can't
```

Significant decisions get an ADR in `docs/adr/` (copy `0000-template.md`).
The full architecture/roadmap doc is kept in private planning notes, not in this repo, because it
references real plans. ADRs here capture the public, technical decisions.

## Layout

- `apps/web` Next.js + Tailwind (guest portal + `/admin`) · `apps/api` Fastify + Zod
- `apps/worker` BullMQ jobs · `apps/game` Phaser 3 (v1.1, lazy-loaded)
- `packages/schema` shared Zod (+ Drizzle in v0.2) · `packages/ui` design tokens
- `packages/seed` fake data · `tools/pii-guard` CI privacy guard

## Conventions

- TypeScript strict, ESM, Node 22. Validate env at boot with `parseEnv`.
- Styling only through design tokens (`--wd-*` CSS variables in `packages/ui/src/tokens.css`).
- Household-gated content must never reach unauthenticated clients: enforce server-side, send
  `Cache-Control: private, no-store`, and add a test proving it.
- Never log request bodies, cookies, auth headers, or codes.
