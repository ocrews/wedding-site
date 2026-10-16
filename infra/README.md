# Infrastructure

Two stacks, same shape, built by Terraform and configured by Ansible from GitHub Actions.
Nothing is run from a laptop. Design rationale: [ADR-0002](../docs/adr/0002-hosting-and-ingress.md).

```
 Guest ─HTTPS─▶ Cloudflare (DNS, WAF, Access) ══ Tunnel ══▶ cloudflared ─▶ Caddy ─▶ web / api
                                                   (outbound only)     │
                                                                       └─ routes by Host:
                                                                          staging.<domain>
                                                                          pr-N.<domain>
                                                                          next.<domain> / apex
 Droplet firewall: inbound SSH only. Postgres, Redis, worker never leave the host network.
```

| Stack      | Droplet                       | Hostnames                                             | Access                                           |
| ---------- | ----------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| staging    | 2 vCPU / 4 GB                 | `staging.<domain>`, `pr-N.<domain>` (one per open PR) | all behind Cloudflare Access                     |
| production | 1 vCPU / 2 GB, weekly backups | `next.<domain>` until launch, then apex + `www`       | until launch: all; after: `/admin`, `/api/admin` |

## One-time setup (GitHub → Settings)

Values are stored only in GitHub. Workflow logs in a public repo are public, so workflows mask
IPs, emails and tokens.

**Repository secrets** (Secrets and variables → Actions → Secrets)

| Name                                                   | What                                                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`                                 | Custom token: Zone/DNS Edit (this zone), Account/Cloudflare Tunnel Edit, Account/Access: Apps and Policies Edit |
| `TF_STATE_ACCESS_KEY_ID`, `TF_STATE_SECRET_ACCESS_KEY` | R2 API token, Object Read & Write on bucket `wedding-tfstate`                                                   |
| `PII_DENYLIST`                                         | (from PR #1) private names/places the PII guard blocks                                                          |

**Repository variables** (… → Variables)

| Name                                          | Example                                                        |
| --------------------------------------------- | -------------------------------------------------------------- |
| `SITE_DOMAIN`                                 | `example.com`                                                  |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID` | from the domain's Overview page                                |
| `ACCESS_EMAILS`                               | `you@example.com, partner@example.com` (who can pass Access)   |
| `ALERT_EMAILS`                                | optional; defaults to `ACCESS_EMAILS`                          |
| `PROD_HOSTNAME`                               | `next.example.com` until launch, then `example.com`            |
| `STAGING_READY` / `PRODUCTION_READY`          | set to `true` after that stack's first apply; turns on deploys |
| `PROD_LAUNCHED`                               | `true` only at cutover (see below)                             |

**Environment `staging`**: secret `DIGITALOCEAN_TOKEN`, secret `DEPLOY_SSH_PRIVATE_KEY`,
variable `DEPLOY_SSH_PUBLIC_KEY`. Deployment branches: all.

**Environment `production`**: same three, with a **different** SSH key. Required reviewer: Owen.
Deployment branches/tags: `main` and `v*`.

Generate a key per stack (Windows PowerShell; empty passphrase so CI can use it):

```powershell
ssh-keygen -t ed25519 -C "wedding-deploy-staging" -f $HOME\.ssh\wedding-deploy-staging -N '""'
Get-Content $HOME\.ssh\wedding-deploy-staging      # → DEPLOY_SSH_PRIVATE_KEY
Get-Content $HOME\.ssh\wedding-deploy-staging.pub  # → DEPLOY_SSH_PUBLIC_KEY
```

Also: **Settings → Actions → General → Fork pull request workflows → Require approval for all
external contributors**, and Cloudflare **Zero Trust** enabled (free plan, any team name).

## Bring up a stack

1. Actions → **Infra** → Run workflow → stack `staging`, action `plan`. Read the plan summary.
2. Run again with action `apply`. Terraform creates the droplet, IP, firewall, tunnel, DNS and
   Access app; Ansible then hardens the host, installs Docker and starts cloudflared + Caddy.
3. Set repo variable `STAGING_READY=true`. From now on:
   - merge to `main` → deploys to `staging.<domain>`
   - open/update a PR → deploys `pr-N.<domain>` and comments the link; closing the PR removes it

Production is the same with stack `production` (the apply waits for your approval), then
`PRODUCTION_READY=true`, `PROD_HOSTNAME=next.<domain>`, and a release tag deploys it:

```bash
git tag v0.2.0 && git push origin v0.2.0   # or create a release in the GitHub app
```

## Launch cutover (apex → production)

1. Cloudflare → the landing-page Worker → Settings → Domains: remove the apex and `www`.
2. Set `PROD_LAUNCHED=true` and `PROD_HOSTNAME=<domain>`; run Infra `apply` for production.
   Apex and `www` now route to production; `/admin` stays behind Access.
3. Push a release tag to redeploy with the new hostname.

## Day-2

| Task                                          | How                                                          |
| --------------------------------------------- | ------------------------------------------------------------ |
| Re-converge a host (packages, config drift)   | Infra → `apply` (no Terraform changes → just Ansible)        |
| See what's running                            | `ssh deploy@<ip> wedding-deploy ls` / `docker ps`            |
| Remove a stuck preview                        | `ssh deploy@<ip> wedding-deploy down pr-N`                   |
| Rotate the DigitalOcean token (90-day expiry) | new token → update `DIGITALOCEAN_TOKEN` in both environments |
| Rotate a deploy key                           | new key → update secret + variable → Infra `apply`           |

Known gaps (tracked for later PRs): Postgres backups to R2, uptime checks, log shipping,
SSH host-key pinning (currently trust-on-first-use per run).
