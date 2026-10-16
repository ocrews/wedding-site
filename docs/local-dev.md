# Local development (Windows + WSL2 + Docker Desktop)

## One-time setup

1. **WSL2 + Ubuntu** (PowerShell as admin):
   ```powershell
   wsl --install -d Ubuntu-24.04
   ```
2. **Docker Desktop** → Settings → General: _Use the WSL 2 based engine_.
   Settings → Resources → WSL integration: enable for `Ubuntu-24.04`.
3. In Ubuntu, verify Docker:
   ```bash
   docker version && docker compose version
   ```
4. **Clone inside the Linux filesystem**, not under `/mnt/c` (much faster file I/O, working
   file watchers):
   ```bash
   mkdir -p ~/src && cd ~/src
   git clone git@github.com:ocrews/wedding-site.git && cd wedding-site
   ```
5. **Node 22 + pnpm** (via nvm and corepack):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
   exec $SHELL
   nvm install            # reads .nvmrc
   corepack enable        # pnpm version comes from package.json "packageManager"
   pnpm install
   ```
6. Optional: `cp .env.example .env` to override defaults. Never put real values in it.

## Run

Full stack in containers (same as the CI smoke test):

```bash
docker compose up --build -d --wait
open http://localhost:3000          # web  (in WSL: explorer.exe http://localhost:3000)
curl localhost:4000/readyz          # api
docker compose logs -f api worker
docker compose down                 # add -v to wipe Postgres/Redis volumes
```

Hot-reload dev against containerized Postgres/Redis:

```bash
docker compose up -d postgres redis
pnpm --filter @wedding/web dev      # http://localhost:3000
```

> Redis is not published to the host by default. For hot-reload API/worker dev, add a
> `compose.override.yaml` (gitignored is fine) with `ports: ['127.0.0.1:6379:6379']` on `redis`,
> then run `pnpm --filter @wedding/api dev` with `DATABASE_URL`/`REDIS_URL` pointing at localhost.

## Checks (same as CI)

```bash
pnpm check               # format, lint, typecheck, test, build
pnpm pii-guard          # privacy scan of tracked files
./scripts/smoke.sh      # build + boot compose stack, hit health endpoints, tear down
```

## Troubleshooting

- **Slow installs / file watching broken:** you're probably under `/mnt/c`. Move the clone to `~`.
- **`docker: command not found` in WSL:** enable WSL integration for your distro in Docker Desktop.
- **Port already in use:** something else holds 3000/4000/5432; stop it or change the host port in
  a `compose.override.yaml`.
- **Line-ending errors in scripts:** `.gitattributes` forces LF; run
  `git rm --cached -r . && git reset --hard` once if you cloned before it existed.
