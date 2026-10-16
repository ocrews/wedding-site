variable "name" {
  description = "Stack name: staging or production."
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.name)
    error_message = "name must be staging or production."
  }
}

variable "domain" {
  description = "Site apex domain. Comes from the SITE_DOMAIN variable, never committed."
  type        = string
}

variable "region" {
  type    = string
  default = "nyc3"
}

variable "size" {
  type = string
}

variable "image" {
  type    = string
  default = "ubuntu-24-04-x64"
}

variable "backups" {
  type    = bool
  default = false
}

variable "ssh_public_key" {
  description = "Deploy key for this stack. One key per stack (DigitalOcean rejects duplicates)."
  type        = string
}

variable "ssh_allowed_cidrs" {
  description = "Who may reach port 22. GitHub-hosted runners have no fixed IPs, so default is open; auth is key-only."
  type        = list(string)
  default     = ["0.0.0.0/0", "::/0"]
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string
}

variable "public_hostnames" {
  description = "Hostnames (labels under domain, \"@\" = apex) served publicly through the tunnel."
  type        = list(string)
  default     = []
}

variable "protected_hostnames" {
  description = "Hostnames served through the tunnel and gated by Cloudflare Access."
  type        = list(string)
  default     = []
}

variable "protected_wildcards" {
  description = "Access-only wildcard labels (e.g. \"pr-*\"). DNS for these is created per preview, not here."
  type        = list(string)
  default     = []
}

variable "protected_paths" {
  description = "Access-gated paths on the apex domain (e.g. \"/admin\")."
  type        = list(string)
  default     = []
}

variable "access_emails" {
  description = "Emails allowed through Cloudflare Access. From the ACCESS_EMAILS variable, never committed."
  type        = list(string)
  sensitive   = true
}

variable "alert_emails" {
  description = "Where DigitalOcean monitoring alerts go. Empty disables alerts."
  type        = list(string)
  default     = []
  sensitive   = true
}
