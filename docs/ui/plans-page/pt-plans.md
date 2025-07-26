# Documentação da Página de Planos em Português

## Visão Geral
A página de planos em português é implementada em duas versões:
1. **Versão pré-login**: `/pt` - Página pública de planos para usuários não autenticados
2. **Versão pós-login**: `/dashboard/pt` - Página de planos autenticada com indicação do plano atual

## Estrutura da Página

### 1. Seção Hero
**Localização**: Topo de ambas as páginas  
**Componente**: Seção hero com título, descrição e informações adicionais

#### Título
- **Texto**: "Escolha o plano que impulsiona sua jornada como trader"
- **Estilização**: 
  - Fonte: `font-poly` (família de fontes Poly)
  - Tamanho: `text-3xl md:text-4xl lg:text-5xl` (tamanho responsivo)
  - Peso: `font-bold`
  - Cor: `text-white`
  - Destaque: "sua jornada de trading" em `text-primary` (verde)

#### Descrição
- **Texto**: "Comece grátis. Desbloqueie análises premium quando estiver pronto."
- **Estilização**:
  - Fonte: `font-montserrat`
  - Tamanho: `text-xl`
  - Peso: `font-semibold`
  - Cor: `text-white`
  - Destaque: "Comece grátis." em `text-primary` (verde)
  - Layout: `max-w-3xl mx-auto` (centralizado, largura máxima)

#### Informações Adicionais
- **Texto**: "Cancele a qualquer momento • Sem taxas ocultas"
- **Estilização**:
  - Fonte: `font-montserrat`
  - Tamanho: `text-base`
  - Peso: `font-normal`
  - Cor: `text-white`
  - Layout: `text-center` (centralizado)
  - Posição: Abaixo dos cards de planos

### 2. Seção de Cards de Planos
**Layout**: Grid de 3 colunas (`md:grid-cols-3 gap-8`)

#### Card do Plano Gratuito
**Subtítulo**: "Sempre grátis"  
**Preço**: "R$0"  
**Recursos**:
- Importações de trades: "100 / mês"
- Diário manual
- Importação CSV (Ebinex)
- Métricas básicas (Taxa de acerto, P&L líquido, Resultado)
- Mapa de calor de performance
- Insights de IA: Semanal
- Calendário econômico: Eventos de alto impacto
- Exportação de dados: CSV
- Suporte prioritário: Comunidade

**Botão CTA**:
- **Pré-login**: "Começar agora" (botão padrão)
- **Pós-login**: "Seu plano atual" com ícone de checkmark
  - Fundo: `bg-gray-600`
  - Texto: `text-primary` (verde)
  - Ícone: SVG checkmark
  - Cursor: `cursor-default` (não clicável)

#### Card do Plano Premium
**Subtítulo**: "Mais popular"  
**Preço**: "R$19"  
**Recursos**:
- Importações de trades: "Ilimitadas"
- Diário manual
- Importação CSV (Ebinex)
- Métricas básicas (Taxa de acerto, P&L líquido, Resultado)
- Análises avançadas (Curva de patrimônio, R:R, Drawdown)
- Métricas de estratégia (por modelo / horário do dia)
- Mapa de calor de performance
- Insights de IA: Diário
- Relatório Edge PDF
- Calendário econômico: Todos os eventos + filtros
- Dashboards personalizados: 2
- Exportação de dados: CSV · Excel · JSON
- Suporte prioritário: Em até 24h
- Teste grátis: 14 dias

**Botão CTA**: "Começar agora" (botão padrão)

#### Card do Plano Enterprise
**Subtítulo**: "Personalizado"  
**Preço**: "Entre em contato"  
**Recursos**:
- Importações de trades: "Ilimitadas + sincronização automática"
- Diário manual
- Importação CSV (Ebinex)
- Integrações API: Todos os corretores + personalizado
- Métricas básicas (Taxa de acerto, P&L líquido, Resultado)
- Análises avançadas (Curva de patrimônio, R:R, Drawdown)
- Métricas de estratégia (por modelo / horário do dia)
- Mapa de calor de performance
- Insights de IA: Tempo real
- Relatório Edge PDF (white-label)
- Calendário econômico: Todos + alertas da equipe
- Dashboards personalizados: Ilimitados
- Gerenciamento de equipe (10+ assentos)
- Exportação de dados: API & Webhooks
- Suporte prioritário: CSM dedicado
- Marca: Logo e cores personalizadas
- Teste grátis: Projeto piloto

**Botão CTA**: "Entre em contato" (botão padrão)

## Integração de Navegação

### Links da Navbar
- **Usuários pré-login**: Link de planos aponta para `/pt`
- **Usuários pós-login**: Link de planos aponta para `/dashboard/pt`

### Detalhes de Implementação
- **Arquivo**: `app/components/layout/Navbar.tsx`
- **Lógica**: Arrays de navegação diferentes para landing vs dashboard
- **Itens de nav do dashboard**: `{ href: '/dashboard/pt', label: 'Planos' }`

## Especificações de Estilização

### Esquema de Cores
- **Fundo**: Tema escuro (`#505050`)
- **Acento primário**: Verde (`#00E28A`)
- **Texto**: Branco (`text-white`)
- **Cards**: Fundo ligeiramente mais claro (`#3A3A3A`)

### Tipografia
- **Fonte do logo**: Etna
- **Títulos**: Montaga (Poly)
- **Corpo/UI**: Montserrat Light

### Design Responsivo
- **Mobile**: Layout de coluna única
- **Tablet**: Grid de 3 colunas com espaçamentos
- **Desktop**: Layout completo de 3 colunas

## Estrutura de Arquivos

### Arquivos Principais
- `app/app/pt/page.tsx` - Página de planos pré-login
- `app/app/dashboard/pt/page.tsx` - Página de planos pós-login
- `app/components/layout/Navbar.tsx` - Navegação com links de planos

### Componentes Principais
- Seção hero com título e descrição
- Cards de planos com listas de recursos
- Botões CTA com estilização condicional
- Layout de grid responsivo

## Atualizações Recentes

### Mudança de Título
- **De**: "Escolha o plano que se adapta à sua jornada de trading"
- **Para**: "Escolha o plano que impulsiona sua jornada de trading"
- **Aplicado a**: Ambas as páginas pré-login e pós-login

### Estilização do Botão Pós-login
- **Botão do plano gratuito**: Mostra "Seu plano atual" com checkmark
- **Fundo**: Cinza (`bg-gray-600`)
- **Texto**: Verde (`text-primary`)
- **Ícone**: SVG checkmark
- **Comportamento**: Não clicável (`cursor-default`)

## Implementação Técnica

### Renderização Condicional
- Texto e estilização diferentes de botões baseados no status de autenticação
- Links de navegação diferentes baseados no estado do usuário

### Design Responsivo
- Abordagem mobile-first
- Mudanças de layout baseadas em breakpoints
- Escalabilidade flexível de tipografia

### Acessibilidade
- Estrutura HTML semântica
- Hierarquia adequada de títulos
- Conformidade com contraste de cores
- Amigável para leitores de tela

## Considerações Futuras

### Possíveis Melhorias
- Modal de comparação de planos
- Tooltips de recursos
- Calculadora interativa de preços
- Fluxo de upgrade/downgrade de planos
- Integração de pagamento
- Exibição de analytics de uso

### Notas de Manutenção
- Manter recursos de planos sincronizados entre versões pré-login e pós-login
- Atualizar preços e recursos em ambos os arquivos
- Manter estilização consistente entre ambas as páginas
- Testar comportamento responsivo em todos os breakpoints

## Tradução e Localização

### Adaptações para o Português Brasileiro
- Uso de "trading" como termo técnico mantido
- Adaptação de expressões para soar natural em português
- Manutenção da consistência terminológica
- Consideração de variações regionais

### Termos Técnicos
- **Trading**: Mantido como termo técnico
- **KPIs**: Traduzido para "Métricas"
- **Analytics**: Traduzido para "Análises"
- **Dashboard**: Mantido como termo técnico
- **API**: Mantido como termo técnico

## Estrutura de Componentes

### Seções Reutilizáveis
- HeroSectionPT
- PlansComparisonSectionPT
- Componentes de layout específicos para PT

### Lógica de Condicionais
- Verificação de idioma selecionado
- Redirecionamento baseado em preferência de idioma
- Manutenção de estado de idioma

## Testes e Qualidade

### Cenários de Teste
- Navegação entre idiomas
- Comportamento responsivo
- Estados de autenticação
- Links e redirecionamentos
- Acessibilidade

### Validação de Conteúdo
- Revisão de traduções
- Consistência terminológica
- Adaptação cultural
- Clareza de comunicação
