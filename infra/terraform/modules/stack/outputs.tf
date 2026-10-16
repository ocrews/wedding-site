output "ipv4" {
  description = "Reserved (stable) IPv4 for SSH."
  value       = digitalocean_reserved_ip.host.ip_address
}

output "tunnel_id" {
  value = cloudflare_zero_trust_tunnel_cloudflared.stack.id
}

output "tunnel_token" {
  description = "cloudflared connector token. Written to the host by Ansible, never logged."
  value       = data.cloudflare_zero_trust_tunnel_cloudflared_token.stack.token
  sensitive   = true
}
