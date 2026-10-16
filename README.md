# wedding-site

Owen and Haley's wedding planning: a guest portal (public + household-code gated) and an admin
planning dashboard, built as a production-grade system.

> **Public repo, zero real data.** Code, schema, and fake data only. All real content (guests,
> venue, hotels, registry, codes) lives in Postgres and is edited through the admin dashboard.
> CI enforces this with gitleaks and a PII guard. See [CLAUDE.md](CLAUDE.md#hard-rules).

## Stack

| Layer   | Choice                                                                        |
| ------- | ----------------------------------------------------------------------------- |
| Web     | Next.js 16 + Tailwind 4, design tokens via CSS variables (`packages/ui`)      |
| API     | Fastify 5 + Zod 4 (`packages/schema` shared contracts)                        |
| Jobs    | BullMQ worker on Redis                                                        |
| Data    | Postgres 16, Redis, S3-compatible object storage (Cloudflare R2)              |
| Game    | Phaser 3 top-down RPG, lazy-loaded (v1.1)                                     |
| Hosting | Docker Compose on a VPS, Caddy, Cloudflare in front; Terraform + Ansible      |
| CI      | GitHub Actions: lint, typecheck, test, build, gitleaks, PII guard, smoke test |

Monorepo: pnpm workspaces + Turborepo ([ADR-0001](docs/adr/0001-typescript-monorepo.md)).

```
apps/
  web/        Next.js guest portal + /admin
  api/        Fastify API (public, guest, admin scopes)
  worker/     BullMQ jobs
  game/       Phaser game (placeholder until v1.1)
packages/
  schema/     Zod (+ Drizzle) shared schemas, env validation
  ui/         design tokens
  seed/       fake data for seeds/fixtures/tests
tools/
  pii-guard/  CI guard against real data in git
docker/       Dockerfiles
deploy/       app stack Compose file used on hosts
infra/        Terraform (DigitalOcean, Cloudflare) + Ansible; see infra/README.md
docs/adr/     architecture decision records
```

## Quick start

Requires Node 22, pnpm (via corepack), Docker. Windows: see [docs/local-dev.md](docs/local-dev.md)
for WSL2 + Docker Desktop setup.

```bash
corepack enable && pnpm install
docker compose up --build -d --wait   # web :3000, api :4000, postgres, redis, worker
pnpm check                             # format, lint, typecheck, test, build
./scripts/smoke.sh                    # full-stack smoke test
```

Health endpoints: `GET /healthz` (liveness) on web, api, worker; `GET /readyz` on api
(Postgres + Redis reachable).

## Workflow

- Branch per change → PR. `main` is protected; CI must pass.
- `main` → staging. Tagged release → production (manual approval).
- Every PR gets a preview at `pr-N.<domain>`; staging and previews sit behind Cloudflare Access
  ([ADR-0002](docs/adr/0002-hosting-and-ingress.md), [infra/README.md](infra/README.md)).
- Significant decisions → `docs/adr/`.

## Roadmap

- **v0.1** repo, CI (incl. PII guard), infra, preview/staging pipeline
- **v0.2** DB + API core, admin auth, content CMS, guest list + household codes, household login
- **v0.3** planning tools (vendors, budget, tasks)
- **v1.0** RSVP, RSVP dashboard, karaoke requests, audit log
- **v1.1** character creator + top-down RPG
- **v2.0** photo uploads, guestbook, anniversary mode
