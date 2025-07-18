💡 Prompt sugerido para o agente LLM
Aqui está um prompt de ativação que você pode usar com o seu agente LLM para iniciar o desenvolvimento técnico da Main Page com base no que foi documentado:

Você é um engenheiro front-end responsável por implementar a página principal (Main Page) do app Binary Hub.

Use Next.js com TailwindCSS. Crie um layout responsivo com os seguintes componentes:

- Navbar
- Hero Section com título, descrição e botão para /plans
- KPIs (Net P&L, Win Rate, etc.) com filtro de tempo dinâmico (day, week, month...)
- Gráfico acumulado com Chart.js ou Recharts
- Calendário de eventos (semana, mês, ano) usando react-calendar
- Feed de eventos econômicos relevantes com dados mockados
- Footer com links institucionais e redes sociais

Referência: consulte o documento `Main Page Documentation – Binary Hub`.

Crie os componentes modularizados em `/components`, use hooks personalizados em `/hooks`, e organize os dados mockados em `public/mock`.

Implemente com foco em performance, acessibilidade e boas práticas de UI.

Comece pela seção do Hero e depois avance para os KPIs.
