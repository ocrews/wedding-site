# Staging: tracks main, plus per-PR previews (pr-N.<domain>). Everything here is behind Access.

terraform {
  required_version = ">= 1.10"

  # State in Cloudflare R2 (S3-compatible). Bucket/endpoint passed at init; see infra/README.md.
  backend "s3" {
    key                         = "staging/terraform.tfstate"
    region                      = "auto"
    use_path_style              = true
    use_lockfile                = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.106"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28"
    }
  }
}

provider "digitalocean" {}
provider "cloudflare" {}

module "stack" {
  source = "../../modules/stack"

  name   = "staging"
  domain = var.domain
  region = var.region
  size   = "s-2vcpu-4gb"

  ssh_public_key        = var.ssh_public_key
  cloudflare_account_id = var.cloudflare_account_id
  cloudflare_zone_id    = var.cloudflare_zone_id

  protected_hostnames = ["staging"]
  protected_wildcards = ["pr-*"]

  access_emails = var.access_emails
  alert_emails  = var.alert_emails
}

output "ipv4" {
  value = module.stack.ipv4
}

output "tunnel_id" {
  value = module.stack.tunnel_id
}

output "tunnel_token" {
  value     = module.stack.tunnel_token
  sensitive = true
}
