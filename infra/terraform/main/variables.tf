###############################
# Variables – Binary Hub IaC  #
###############################

variable "project_id" {
  description = "GCP project ID where Binary Hub resources will be created"
  type        = string
}

variable "region" {
  description = "Primary GCP region"
  type        = string
  default     = "us-central1"
}

variable "image_tag" {
  description = "Container image (gcr.io/…) used by Cloud Run"
  type        = string
}

variable "bucket_name" {
  description = "(Optional) Name of the GCS bucket for user uploads"
  type        = string
  default     = "binaryhub-uploads"
}

variable "custom_domain" {
  description = "(Optional) Custom domain mapped to Cloud Run service (e.g. api.binaryhub.app)"
  type        = string
  default     = ""
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "binaryhub-bff"
}
