# Política de Segurança – Binary Hub

Garantir a segurança dos dados dos usuários e da infraestrutura do projeto Binary Hub é uma prioridade. Este documento descreve boas práticas, canais de contato e procedimentos para relatar vulnerabilidades de forma responsável.

---

## 1. Boas Práticas Recomendadas

- **Use sempre variáveis de ambiente** para segredos e credenciais (ex: `.env`, Secret Manager).
- **Nunca suba credenciais em commits.** Adote ferramentas como Git hooks e `dotenv-linter`.
- **Limite escopos de API keys** apenas ao necessário (ex: leitura, escrita específica).
- **Atualize dependências regularmente.** Use Dependabot ou Snyk.
- **Sanitize entradas do usuário.** Contra injeção SQL, XSS e outros ataques comuns.
- **Use HTTPS sempre.** Inclusive entre serviços internos.

---

## 2. Relato de Vulnerabilidades

Se você encontrar uma vulnerabilidade, por favor:

- **Não divulgue publicamente.**
- **Envie um e-mail para:** `security@binaryhub.dev`
- Inclua:
  - Descrição do problema
  - Reprodutibilidade (passos)
  - Impacto potencial
  - Logs ou evidências, se possível

Responderemos em até **72h** úteis e manteremos **confidencialidade total** sobre sua identidade.

---

## 3. Escopo de Segurança

Inclui:

- Backend (API, banco de dados, autenticação)
- Painel admin e frontend público
- Pipelines CI/CD
- Serviços de CDN e upload (ex: imagens de operação)
- Integrações de IA (como chat LLM)

Não inclui:

- Apps de terceiros não mantidos por nós
- Serviços fora do domínio `binaryhub.dev`

---

## 4. Política de Divulgações

Ao confirmar e mitigar a vulnerabilidade:

- Daremos crédito ao pesquisador se desejar
- Publicaremos uma nota no `CHANGELOG.md`
- Poderemos emitir CVE se for relevante

---

## 5. Recursos Úteis

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Guia de Boas Práticas da GitHub Security](https://docs.github.com/en/code-security)
- [RFC 9110: HTTP Security](https://datatracker.ietf.org/doc/html/rfc9110)

---

Agradecemos profundamente quem contribui para a segurança do Binary Hub.
