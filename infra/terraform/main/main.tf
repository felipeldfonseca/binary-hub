###############################
# Binary Hub – Terraform IaC  #
# Environment: GCP            #
# Author: LLM Assistant       #
###############################

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

###############################
# 0. Providers & Backend      #
###############################

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Remote backend (GCS state)
terraform {
  backend "gcs" {
    bucket = var.tf_state_bucket
    prefix = "terraform/state"
  }
}

###############################
# 1. Enable Required APIs     #
###############################

resource "google_project_service" "required" {
  for_each = toset([
    "run.googleapis.com",        # Cloud Run
    "compute.googleapis.com",    # Networking, Cloud CDN
    "cloudbuild.googleapis.com", # Image builds
    "artifactregistry.googleapis.com", # Container registry
    "storage.googleapis.com",    # GCS buckets
    "firestore.googleapis.com",  # Firestore DB
    "iam.googleapis.com"         # IAM
  ])
  service = each.value
}

###############################
# 2. IAM Service Accounts     #
###############################

resource "google_service_account" "cloud_run_sa" {
  account_id   = "binaryhub-run-sa"
  display_name = "Binary Hub Cloud Run Service Account"
}

# Bind roles to SA
resource "google_project_iam_member" "run_sa_roles" {
  for_each = toset([
    "roles/run.invoker",
    "roles/storage.objectAdmin",
    "roles/datastore.user"
  ])
  role   = each.value
  member = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

###############################
# 3. Artifact Registry        #
###############################

resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = "binaryhub-docker"
  format        = "DOCKER"
}

###############################
# 4. Cloud Run Service (BFF)  #
###############################

resource "google_cloud_run_service" "bff_api" {
  name     = "binaryhub-api"
  location = var.region
  template {
    spec {
      service_account_name = google_service_account.cloud_run_sa.email
      containers {
        image = "${google_artifact_registry_repository.docker_repo.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/binaryhub-api:latest"
        env = [
          {
            name  = "GOOGLE_PROJECT_ID"
            value = var.project_id
          },
          {
            name  = "FIRESTORE_EMULATOR_HOST"
            value = ""
          }
        ]
        resources {
          limits = {
            memory = "512Mi"
            cpu    = "1"
          }
        }
      }
    }
  }
  traffic {
    percent         = 100
    latest_revision = true
  }
}

output "cloud_run_url" {
  value = google_cloud_run_service.bff_api.status[0].url
}

###############################
# 5. GCS Buckets for Uploads  #
###############################

resource "google_storage_bucket" "uploads" {
  name          = "binaryhub-uploads-${var.project_id}"
  location      = var.region
  uniform_bucket_level_access = true
  cors {
    origin          = ["*"]
    method          = ["GET", "PUT", "POST"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
  lifecycle_rule {
    action {
      type = "SetStorageClass"
      storage_class = "NEARLINE"
    }
    condition {
      age = 30
    }
  }
}

# Cloud CDN (optional) via Load Balancer – simplified placeholder
# Module or additional resources would be needed for production.

data "google_compute_default_service_account" "default" {}

###############################
# 6. Variables                #
###############################

variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "Default region"
}

variable "zone" {
  type        = string
  default     = "us-central1-a"
}

variable "tf_state_bucket" {
  type        = string
  description = "GCS bucket to store Terraform state"
}

###############################
# 7. Outputs                  #
###############################

output "uploads_bucket" {
  value = google_storage_bucket.uploads.name
}
