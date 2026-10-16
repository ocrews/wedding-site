# Production. Until launch it serves only next.<domain> (behind Access) so the static landing page
# on the apex keeps working. At cutover: move "@" and "www" into public_hostnames, drop "next",
# and remove the apex/www custom domains from the landing-page Worker first.

terraform {
  required_version = ">= 1.10"

  backend "s3" {
    key                         = "production/terraform.tfstate"
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

  name    = "production"
  domain  = var.domain
  region  = var.region
  size    = "s-1vcpu-2gb"
  backups = true

  ssh_public_key        = var.ssh_public_key
  cloudflare_account_id = var.cloudflare_account_id
  cloudflare_zone_id    = var.cloudflare_zone_id

  public_hostnames    = var.launched ? ["@", "www"] : []
  protected_hostnames = var.launched ? [] : ["next"]
  protected_paths     = var.launched ? ["/admin", "/api/admin"] : []

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
