#!/usr/bin/env bash
# Builds and boots the full Compose stack, then checks every service end to end.
# Used by CI; also handy locally:  ./scripts/smoke.sh   (KEEP_UP=1 to leave it running)
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

cleanup() {
  status=$?
  if [[ $status -ne 0 ]]; then
    echo "::group::compose ps / logs (failure)"
    docker compose ps || true
    docker compose logs --no-color --tail=200 || true
    echo "::endgroup::"
  fi
  if [[ "${KEEP_UP:-0}" != "1" ]]; then
    docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  exit $status
}
trap cleanup EXIT

docker compose build
docker compose up -d --wait --wait-timeout 180

check() {
  local name=$1 url=$2 expect=$3
  local body
  body=$(curl -fsS --max-time 5 "$url")
  if [[ "$body" != *"$expect"* ]]; then
    echo "FAIL $name: $url -> $body"
    exit 1
  fi
  echo "ok   $name"
}

check "web /healthz"   http://127.0.0.1:3000/healthz '"status":"ok"'
check "web /"          http://127.0.0.1:3000/        'under the tent'
check "api /healthz"   http://127.0.0.1:4000/healthz '"status":"ok"'
check "api /readyz"    http://127.0.0.1:4000/readyz  '"postgres":"ok","redis":"ok"'
# Worker has no host port; check from inside its container.
worker=$(docker compose exec -T worker wget -qO- http://127.0.0.1:4100/healthz)
[[ "$worker" == *'"status":"ok"'* ]] || { echo "FAIL worker: $worker"; exit 1; }
echo "ok   worker /healthz"

# Security headers present on the web app.
headers=$(curl -fsS -D - -o /dev/null http://127.0.0.1:3000/)
for h in x-content-type-options x-frame-options referrer-policy; do
  grep -qi "^$h:" <<<"$headers" || { echo "FAIL missing header $h"; exit 1; }
done
echo "ok   security headers"

echo "Smoke test passed."
