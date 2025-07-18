# Plano de Execução – Binary Hub (MVP)

## 🧱 Fase 1 – Fundações
1. [x] Validar escopo MVP com base em `mvp_scope.md` e `prd.md`
2. [x] Criar estrutura inicial do projeto (`/api`, `/design`, `/docs`, etc.)
3. [x] Definir tokens de design e importar fontes/cores (ver `style_guide_ui.md`)
4. [x] Preparar ambiente de CI/CD (base Vercel + Firebase CLI)

---

## 🧠 Fase 2 – Backend + IA
5. [x] Implementar o modelo de dados (`data_model.md`) no Firebase Firestore
6. [x] Criar as funções backend do Firebase (Funções de análise, registro, IA)
7. [x] Integrar a LLM com base no `prompt_guide.md`
8. [x] Expor os endpoints definidos em `OPENAPI.yaml`

---

## 🧪 Fase 3 – Testes de API
9. [x] Testar todos os endpoints com ferramentas como Postman ou Insomnia
10. [x] Criar testes unitários de função e integração (`TEST_STRATEGY.md`)

---

## 🖼️ Fase 4 – Frontend
11. [x] Criar UI com base no `style_guide_ui.md` e `visual_identity.md`
12. [x] Integrar com Firebase e backend (hooks, chamadas REST)
13. [x] Implementar sistema de autenticação completo (email/password + OAuth)
14. [ ] Implementar lógica de registro manual de operação
15. [ ] Implementar fluxo de IA (upload de imagem + análise automática)
16. [ ] Testar responsividade e UX completa

---

## 🚀 Fase 5 – Deploy
16. [x] Deploy do frontend no Vercel
17. [x] Deploy do backend com Firebase Hosting + Functions
18. [ ] Criar URLs temporárias para teste

---

## 📊 Fase 6 – Analytics & Observabilidade
19. [ ] Integrar Firebase Analytics e Sentry (ou alternativa leve)
20. [ ] Testar fluxo completo de registro + análise com métricas reais

---

## 📚 Fase 7 – Documentação Final
21. [ ] Revisar `README.md` principal
22. [ ] Atualizar `CHANGELOG.md`
23. [ ] Incluir capturas de tela no `README.md` do frontend
24. [ ] Gerar versão final do `LICENSE`, `CODE_OF_CONDUCT.md` e `CONTRIBUTING.md`

---

> **Dica:** sempre avance linearmente. Não pule para frontend sem o backend funcional.  
> Evite acoplar IA antes do upload manual funcionar. Teste partes isoladas primeiro.
