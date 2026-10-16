#!/usr/bin/env bash
# Values are expanded client-side on purpose (validated again on the host).
# shellcheck disable=SC2029
# CI helper: deploy one app stack to the host configured as `host` in ~/.ssh/config.
#   deploy-stack.sh <stack> <hostname> <image-tag>
# Env: GHCR_USER, GHCR_TOKEN (short-lived workflow token, used only to pull images).
set -euo pipefail

stack=$1 hostname=$2 tag=$3
cd "$(git rev-parse --show-toplevel)"

echo "::group::pull credentials"
printf '%s' "$GHCR_TOKEN" | ssh host "docker login ghcr.io -u '$GHCR_USER' --password-stdin" >/dev/null
echo "::endgroup::"

cleanup() { ssh host 'docker logout ghcr.io >/dev/null 2>&1' || true; }
trap cleanup EXIT

echo "::group::deploy $stack ($tag) → $hostname"
ssh host "wedding-deploy up '$stack' '$hostname' '$tag'" < deploy/compose.app.yaml
echo "::endgroup::"

# Smoke test through Caddy on the host (Access sits in front of the public URL, so test inside).
echo "::group::smoke"
for path in /healthz /api/healthz /api/readyz; do
  for _ in $(seq 1 15); do
    if out=$(ssh host "docker exec edge-caddy-1 wget -qO- --header 'Host: $hostname' http://127.0.0.1$path" 2>/dev/null); then
      echo "ok   $path  $out"
      continue 2
    fi
    sleep 4
  done
  echo "::error::smoke failed for $hostname$path"
  ssh host "cd /opt/wedding/stacks/$stack && docker compose -p '$stack' logs --tail=80" || true
  exit 1
done
echo "::endgroup::"
