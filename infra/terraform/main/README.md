# Binary Hub – IaC (Terraform)

*Guia rápido de uso*

---

## 1. Pré‑requisitos

| Item          | Versão mínima | Observação                                                                                                                                         |
| ------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terraform CLI | **1.7.0**     | `brew install terraform` ou download em [https://developer.hashicorp.com/terraform/downloads](https://developer.hashicorp.com/terraform/downloads) |
| gcloud CLI    | 440+          | `brew install --cask google-cloud-sdk`                                                                                                             |
| Conta GCP     | —             | Projeto com faturamento ligado                                                                                                                     |

> **Auth**: execute `gcloud init` e `gcloud auth application-default login`. O Terraform usará as credenciais Application Default (ADC).

---

## 2. Estrutura de pastas

```
infra/terraform/
  ├─ main.tf         # recursos principais (Cloud Run, SA, Storage, CDN, Logs)
  ├─ variables.tf    # variáveis de entrada (project_id, region, image_tag...)
  └─ outputs.tf      # URLs e IDs gerados (api_url, bucket_name...)
```

---

## 3. Variáveis obrigatórias

Coloque seus valores num arquivo `terraform.tfvars` ou passe via `-var`:

```hcl
# terraform.tfvars — exemplo completo
project_id  = "binaryhub-prod"
region      = "us-central1"
image_tag   = "gcr.io/binaryhub-prod/bff:latest"
# opcional: nome do bucket, caso deseje customizar
bucket_name = "binaryhub-uploads"
# opcional: domínio customizado para Cloud Run
custom_domain = "api.binaryhub.app"
```

| Variável     | Descrição                      | Exemplo          |
| ------------ | ------------------------------ | ---------------- |
| `project_id` | ID do projeto GCP              | `binaryhub-prod` |
| `region`     | Região principal               | `us-central1`    |
| `image_tag`  | Container image para Cloud Run | `gcr.io/…`       |

---

## 4. Comandos básicos

```bash
# dentro de infra/terraform
terraform init                  # baixa provider google, cria backend local
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

O `apply` provisiona:

* Service Account `binaryhub-sa`
* Storage Bucket `binaryhub-uploads`
* Cloud Run service `binaryhub-bff`
* CDN & Cloud Functions (upload‑parser)
* Sink de logs + alertas

---

## 5. Verificando

Após sucesso, o output mostrará algo como:

```
Outputs:
api_url = "https://binaryhub-bff-uc.a.run.app"
bucket_name = "binaryhub-uploads"
sa_email = "binaryhub-sa@binaryhub-prod.iam.gserviceaccount.com"
```

Use `curl $api_url/healthz` para checar liveness.

---

## 6. Limpeza

```bash
terraform destroy -var-file=terraform.tfvars
```

Isso remove todos os recursos criados nesta stack.

---

## 7. Dicas & próximos passos

* Configure **remote backend (GCS)** para *state* compartilhado (`backend "gcs" { bucket = "binaryhub-tfstates" }`).
* Habilite **IAM Workload Identity** para deployment GitHub Actions.
* Para ambientes múltiplos (staging/prod) use `terraform workspace` ou pastas separadas.
