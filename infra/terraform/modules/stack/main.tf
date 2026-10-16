# One deployable stack (staging or production): a droplet with a fixed IP, a firewall that only
# admits SSH, and a Cloudflare Tunnel that carries all web traffic. No web ports are open on the
# droplet; cloudflared dials out to Cloudflare and forwards everything to Caddy on the host.

locals {
  prefix = "wedding-${var.name}"
  tags   = ["wedding", local.prefix]
  # "@" means the zone apex.
  fqdn = {
    for h in concat(var.public_hostnames, var.protected_hostnames) :
    h => h == "@" ? var.domain : "${h}.${var.domain}"
  }
  protected_destinations = concat(
    [for h in var.protected_hostnames : local.fqdn[h]],
    [for h in var.protected_wildcards : "${h}.${var.domain}"],
    [for p in var.protected_paths : "${var.domain}${p}"],
  )
}

# ---------------------------------------------------------------- DigitalOcean

resource "digitalocean_ssh_key" "deploy" {
  name       = "${local.prefix}-deploy"
  public_key = var.ssh_public_key
}

resource "digitalocean_droplet" "host" {
  name       = local.prefix
  image      = var.image
  region     = var.region
  size       = var.size
  ssh_keys   = [digitalocean_ssh_key.deploy.fingerprint]
  monitoring = true
  ipv6       = true
  backups    = var.backups
  tags       = local.tags

  # Image and key changes would force a rebuild and wipe the database volume; do those deliberately.
  lifecycle {
    ignore_changes = [image, ssh_keys]
  }
}

resource "digitalocean_reserved_ip" "host" {
  region = var.region
}

resource "digitalocean_reserved_ip_assignment" "host" {
  ip_address = digitalocean_reserved_ip.host.ip_address
  droplet_id = digitalocean_droplet.host.id
}

resource "digitalocean_firewall" "host" {
  name        = local.prefix
  droplet_ids = [digitalocean_droplet.host.id]

  # SSH only (key auth, fail2ban). Web traffic arrives through the tunnel, never inbound.
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.ssh_allowed_cidrs
  }

  inbound_rule {
    protocol         = "icmp"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_project" "stack" {
  name        = local.prefix
  description = "Wedding site ${var.name} stack (managed by Terraform)"
  purpose     = "Web Application"
  environment = var.name == "production" ? "Production" : "Staging"
  resources = [
    digitalocean_droplet.host.urn,
    digitalocean_reserved_ip.host.urn,
  ]
}

resource "digitalocean_monitor_alert" "cpu" {
  count       = length(var.alert_emails) > 0 ? 1 : 0
  description = "${local.prefix}: CPU above 85% for 10m"
  type        = "v1/insights/droplet/cpu"
  compare     = "GreaterThan"
  value       = 85
  window      = "10m"
  entities    = [digitalocean_droplet.host.id]
  alerts {
    email = var.alert_emails
  }
}

resource "digitalocean_monitor_alert" "memory" {
  count       = length(var.alert_emails) > 0 ? 1 : 0
  description = "${local.prefix}: memory above 90% for 10m"
  type        = "v1/insights/droplet/memory_utilization_percent"
  compare     = "GreaterThan"
  value       = 90
  window      = "10m"
  entities    = [digitalocean_droplet.host.id]
  alerts {
    email = var.alert_emails
  }
}

resource "digitalocean_monitor_alert" "disk" {
  count       = length(var.alert_emails) > 0 ? 1 : 0
  description = "${local.prefix}: disk above 80%"
  type        = "v1/insights/droplet/disk_utilization_percent"
  compare     = "GreaterThan"
  value       = 80
  window      = "5m"
  entities    = [digitalocean_droplet.host.id]
  alerts {
    email = var.alert_emails
  }
}

# ---------------------------------------------------------------- Cloudflare Tunnel

resource "cloudflare_zero_trust_tunnel_cloudflared" "stack" {
  account_id = var.cloudflare_account_id
  name       = local.prefix
  config_src = "cloudflare"
}

# Catch-all: every hostname routed to this tunnel lands on Caddy, which routes by Host header.
# New hostnames (e.g. per-PR previews) only need a DNS record, not a tunnel change.
resource "cloudflare_zero_trust_tunnel_cloudflared_config" "stack" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.stack.id
  config = {
    ingress = [
      { service = "http://caddy:80" },
    ]
  }
}

data "cloudflare_zero_trust_tunnel_cloudflared_token" "stack" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.stack.id
}

resource "cloudflare_dns_record" "host" {
  for_each = local.fqdn
  zone_id  = var.cloudflare_zone_id
  name     = each.value
  type     = "CNAME"
  content  = "${cloudflare_zero_trust_tunnel_cloudflared.stack.id}.cfargotunnel.com"
  proxied  = true
  ttl      = 1
  comment  = "${local.prefix} tunnel (Terraform)"
}

# ---------------------------------------------------------------- Cloudflare Access

resource "cloudflare_zero_trust_access_policy" "admins" {
  count      = length(local.protected_destinations) > 0 ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = "${local.prefix} admins"
  decision   = "allow"
  include    = [for e in var.access_emails : { email = { email = e } }]
}

resource "cloudflare_zero_trust_access_application" "protected" {
  count            = length(local.protected_destinations) > 0 ? 1 : 0
  account_id       = var.cloudflare_account_id
  name             = "${local.prefix} (protected)"
  type             = "self_hosted"
  session_duration = "720h"
  destinations     = [for d in local.protected_destinations : { type = "public", uri = d }]
  policies = [{
    id         = cloudflare_zero_trust_access_policy.admins[0].id
    precedence = 1
  }]
  app_launcher_visible       = false
  auto_redirect_to_identity  = false
  http_only_cookie_attribute = true
  same_site_cookie_attribute = "lax"
}
