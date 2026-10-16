# ADR-0002: Hosting, ingress, and deploy pipeline

- **Status:** Accepted
- **Date:** 2026-10-16
- **Deciders:** Owen (with Claude)

## Context

The site needs a staging environment with a preview per pull request (testable from a phone),
and a production environment that is live for RSVPs by mid-November 2026. The architecture
already chose self-hosting with Docker Compose on a VPS, Cloudflare in front, Terraform and
Ansible, and an exit path to AWS. Constraints:

- One developer, often phone-only: everything must run from GitHub Actions, approvals from the
  GitHub app.
- Public repository: no real values in code, and workflow logs are public.
- Small budget; tiny traffic (~200 guests).

## Decision

**Compute.** Two DigitalOcean droplets built by Terraform: staging (2 vCPU / 4 GB, hosts
staging plus every open PR's preview) and production (1 vCPU / 2 GB, weekly backups). Each has
a reserved IP and a firewall that allows inbound SSH only. Images are built in CI and pushed to
GHCR; hosts only pull and run.

**Ingress: Cloudflare Tunnel.** `cloudflared` on each host makes an outbound connection to
Cloudflare. No web ports are open and no origin certificates exist. The tunnel has one
catch-all rule pointing at Caddy, so a new hostname needs only a DNS record.

**Routing: Caddy via Docker labels** (`caddy-docker-proxy`). Each app stack declares its
hostname on its containers; Caddy picks it up without config edits. Caddy reads Docker through
a filtered, read-only socket proxy rather than the raw socket.

**Access control: Cloudflare Access.** Staging and previews are fully gated by an email
allowlist (one-time PIN). Production is gated until launch, then only `/admin` and
`/api/admin`. The app will still enforce its own admin allowlist (defense in depth).

**Previews.** `pr-N.<domain>`, not `pr-N.staging.<domain>`: Cloudflare's free Universal SSL
covers one subdomain level only. Each preview is its own Compose project with its own
Postgres, Redis and volumes, created on PR open/update and destroyed on close.

**State and secrets.** Terraform state in Cloudflare R2 (S3 backend with lockfile). Secrets live
in GitHub Environments; production requires a reviewer and only deploys from `main`/`v*`.
Database passwords are generated on the host and never pass through CI.

**Release flow.** PR → preview. Merge to `main` → staging. Tag `v*` → production after approval.

## Alternatives considered

| Option                                       | Why not                                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Public Caddy with Cloudflare Origin CA certs | Open 443, IP allowlists to maintain, origin IP discoverable, certs to rotate.                             |
| Vercel / Cloudflare Pages for web            | Splits the stack; API, worker and Postgres still need a host. Less of the system to learn and show.       |
| Managed Postgres (DO)                        | ~$15/mo minimum; overkill for this size. Plain Postgres in Compose keeps the AWS move simple (RDS later). |
| Kubernetes (DOKS)                            | Cost and operational weight far beyond the need.                                                          |
| Traefik                                      | Equivalent label-based routing; Caddy was already the chosen proxy.                                       |
| `pr-N.staging.<domain>`                      | Needs Advanced Certificate Manager ($10/mo).                                                              |
| Terraform Cloud / DO Spaces for state        | Extra account, or $5/mo; R2 is free at this size and already in use.                                      |

## Consequences

- No inbound web exposure; SSH is the only open port (key-only, root disabled, fail2ban).
- Adding a hostname is a DNS record plus labels; no proxy or tunnel edits.
- Previews compete with staging for 4 GB RAM; a handful of concurrent PRs is the practical limit.
- SSH from GitHub-hosted runners can't be IP-restricted (no fixed IPs). Accepted; revisit with a
  self-hosted runner or Tailscale if needed. Host keys are trust-on-first-use per run.
- Gaps to close before RSVP launch: Postgres backups to R2, uptime monitoring, log retention.
- AWS path: droplet → EC2 (same Ansible), Postgres → RDS, R2 → S3, tunnel unchanged.
