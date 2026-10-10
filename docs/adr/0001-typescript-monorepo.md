# ADR-0001: TypeScript monorepo with pnpm workspaces and Turborepo

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Owen (with Claude)

## Context

The site is one product with two sides (guest portal and admin planning dashboard) built from
several deployables: a Next.js web app, a Fastify API, a BullMQ worker, and later a Phaser game.
They share request/response schemas, env validation, design tokens, and fake seed data.

Constraints:

- Small team (two people, one developer), hard deadlines tied to the wedding calendar
  (household login live before cards mail in early December; RSVP by mid-March 2027).
- Public repository that must never contain real wedding or guest data.
- Self-hosted on a VPS today, with an exit path to AWS. Builds must produce plain container images.
- Doubles as a portfolio piece, so the structure should read like production work.

## Decision

- **One repository, TypeScript everywhere**, managed with **pnpm workspaces** and orchestrated by
  **Turborepo** (`build`, `typecheck`, `test` with dependency-aware caching).
- Layout: `apps/{web,api,worker,game}`, `packages/{schema,ui,seed}`, `tools/pii-guard`.
- **Internal packages ship as TypeScript source** (no per-package build step). Next.js compiles
  them via `transpilePackages`; Node services are bundled with esbuild, which inlines
  `@wedding/*` and keeps each app's own third-party dependencies external.
  Images are assembled with `pnpm deploy --prod` (only production deps).
- **Shared contracts in `packages/schema`** (Zod now, Drizzle tables in v0.2). Every service
  validates its environment at boot and fails fast (12-factor).
- **Toolchain pins** (Oct 2026): Node 22 LTS, pnpm 10 (via `packageManager`), TypeScript 6.0
  (TS 7 is not yet supported by typescript-eslint), ESLint 10 flat config. `eslint-config-next`
  bundles plugins that don't support ESLint 10 yet, so `@next/eslint-plugin-next` and
  `eslint-plugin-react-hooks` are wired directly; revisit when it catches up.
- **Lint runs once at the root** (single flat config); typecheck/test/build run per package
  through Turbo.

## Alternatives considered

| Option                                | Why not                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Next.js only (API routes, no Fastify) | Couples API scaling/deploy to the web app; harder to give the game and admin a clean, separately-scoped API.            |
| Polyrepo                              | Schema changes would need cross-repo version bumps; too much ceremony for one developer.                                |
| Nx                                    | More capable, but heavier config and plugin surface than this project needs. Turbo covers caching + task graph.         |
| npm/yarn workspaces                   | pnpm's strict, symlinked `node_modules` catches undeclared deps; `pnpm deploy` produces lean images.                    |
| Per-package `tsc` builds              | Extra build step and `dist` juggling for every internal package; source-only packages + bundling is simpler and faster. |

## Consequences

- One PR can change schema, API, and UI atomically; CI checks the whole graph.
- Internal packages can't be consumed outside this repo without a build step (acceptable).
- Docker images rebuild from the repo root context; `.dockerignore` and cache mounts keep it fast.
- Toolchain pins above need a periodic check (Dependabot is enabled weekly).
