# All values arrive as TF_VAR_* from GitHub Environments. Nothing real is committed.

variable "domain" {
  type = string
}

variable "region" {
  type    = string
  default = "nyc3"
}

variable "launched" {
  description = "false: serve next.<domain> behind Access. true: serve apex + www publicly, gate /admin."
  type        = bool
  default     = false
}

variable "ssh_public_key" {
  type = string
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string
}

variable "access_emails" {
  type      = list(string)
  sensitive = true
}

variable "alert_emails" {
  type      = list(string)
  default   = []
  sensitive = true
}
