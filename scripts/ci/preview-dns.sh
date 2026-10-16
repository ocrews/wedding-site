#!/usr/bin/env bash
# CI helper: create or delete the DNS record for a PR preview (pr-N.<domain> → staging tunnel).
#   preview-dns.sh ensure <name>     e.g. ensure pr-12
#   preview-dns.sh delete <name>
# Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ZONE_ID, SITE_DOMAIN
set -euo pipefail

action=$1 name=$2
[[ "$name" =~ ^pr-[0-9]{1,5}$ ]] || { echo "invalid preview name: $name" >&2; exit 1; }
fqdn="$name.$SITE_DOMAIN"
api=https://api.cloudflare.com/client/v4

cf() { curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' "$@"; }

record_id=$(cf "$api/zones/$CLOUDFLARE_ZONE_ID/dns_records?type=CNAME&name=$fqdn" | jq -r '.result[0].id // empty')

case "$action" in
  ensure)
    tunnel_id=$(cf "$api/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel?name=wedding-staging&is_deleted=false" | jq -r '.result[0].id // empty')
    [[ -n "$tunnel_id" ]] || { echo "::error::staging tunnel not found; run Infra apply for staging"; exit 1; }
    body=$(jq -n --arg n "$fqdn" --arg c "$tunnel_id.cfargotunnel.com" \
      '{type:"CNAME", name:$n, content:$c, proxied:true, ttl:1, comment:"PR preview (CI)"}')
    if [[ -z "$record_id" ]]; then
      cf -X POST "$api/zones/$CLOUDFLARE_ZONE_ID/dns_records" --data "$body" >/dev/null
      echo "created $fqdn"
    else
      cf -X PUT "$api/zones/$CLOUDFLARE_ZONE_ID/dns_records/$record_id" --data "$body" >/dev/null
      echo "updated $fqdn"
    fi
    ;;
  delete)
    if [[ -n "$record_id" ]]; then
      cf -X DELETE "$api/zones/$CLOUDFLARE_ZONE_ID/dns_records/$record_id" >/dev/null
      echo "deleted $fqdn"
    else
      echo "no record for $fqdn"
    fi
    ;;
  *) echo "usage: $0 ensure|delete pr-N" >&2; exit 2 ;;
esac
