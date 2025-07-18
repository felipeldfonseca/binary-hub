###############################
# Outputs – Binary Hub IaC    #
###############################

output "api_url" {
  description = "Base URL of the Cloud Run service (Binary Hub BFF)"
  value       = google_cloud_run_service.bff.status[0].url
}

output "bucket_name" {
  description = "Name of the GCS bucket used for user uploads"
  value       = google_storage_bucket.uploads.name
}

output "sa_email" {
  description = "Service Account email deployed with least‑privilege roles"
  value  ...
}
