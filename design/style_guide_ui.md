# Binary Hub – **UI Style Guide**

*Versão 3.1 • julho 2025*

> Este guia traduz a identidade visual do Binary Hub em **tokens de design** utilizáveis em Figma, Tailwind e CSS‑in‑JS. Todos os valores aqui definidos foram validados para contraste **WCAG 2.1 AA** com base no documento‐mãe [`visual_identity.md`](visual_identity.md).

---

## 1 • Princípios de Design

1. **Clareza & Dados‑Primeiro** – Dashboards e KPIs devem ficar em primeiro plano; ornamentação mínima.
2. **Velocidade Percebida** – UI deve parecer rápida, com transições suaves e feedbacks imediatos.
3. **Consistência de Layout** – Grade fluida, espaçamento previsível, tipografia modular.
4. **Acessibilidade embutida** – Contraste AA+, tamanho de toque mínimo, foco visível.

---

## 2 • Paleta Oficial + Tokens Semânticos

| Nome         | Hex       | Função Principal                       | Contraste AA\*           |
| ------------ | --------- | -------------------------------------- | ------------------------ |
| Verde Neon   | `#00E28A` | Marca, botões primários                | 6.63 : 1 (sobre #3A3A3A) |
| Cinza-Escuro | `#3A3A3A` | Texto sobre Verde Neon, fundos escuros | 6.63 : 1 (sobre #00E28A) |
| Branco       | `#FFFFFF` | Texto sobre Cinza-Escuro               | 11.37 : 1                |
| Cinza-Claro  | `#B3B3B3` | Texto secundário, bordas sutis         | ≥ 4.5 : 1 (sobre escuro) |

**Tokens semânticos (modo claro):**

```json
{
  "primary": "#00E28A",
  "text": "#3A3A3A",
  "background": "#FFFFFF",
  "border": "#B3B3B3"
}
```

**Tokens semânticos (modo escuro):**

```json
{
  "primary": "#00E28A",
  "text": "#FFFFFF",
  "background": "#1A1A1A",
  "border": "#444"
}
```

---

## 3 • Tipografia

| Uso             | Família         | Peso(s)          | Observações                     |
| --------------- | --------------- | ---------------- | ------------------------------- |
| Headings & Logo | Etna Sans Serif | Bold / SemiBold  | Webfont no repositório de marca |
| Texto Corrido   | Montserrat      | Regular / Medium | `line-height: 1.5`              |

**Escala Modular:**

```text
12 / 14 / 16 / 20 / 24 / 32 / 40 / 48 px
```

---

## 4 • Espaçamento & Grid

* Base: **4px**
* Gaps comuns: `4, 8, 12, 16, 24, 32, 48px`
* Grade Figma: 8 colunas / 12 colunas / 16 colunas responsiva
* Max-width para conteúdo central: `1280px`

---

## 5 • Bordas & Sombras

* **Border-radius:** `0px`, `4px`, `8px`, `16px`
* **Sombra padrão (elevation 1):**

```css
box-shadow: 0px 2px 6px rgba(0,0,0,0.08);
```

* **Sombra elevada (hover/click):**

```css
box-shadow: 0px 4px 12px rgba(0,0,0,0.12);
```

---

## 6 • Componentes Base (Tailwind snippets)

**Botão Primário**

```html
<button class="bg-primary text-text px-4 py-2 rounded-md hover:opacity-90 transition">
  Confirmar
</button>
```

**Pílula de status (verde escuro)**

```html
<span class="bg-[#3A3A3A] text-primary px-2 py-1 rounded-full text-sm">
  Win
</span>
```

**Card com borda clara**

```html
<div class="bg-background border border-border p-4 rounded-lg shadow">
  ...
</div>
```

**Input básico**

```html
<input type="text" class="border border-border p-2 rounded w-full focus:outline-primary" />
```

**Badge KPI**

```html
<span class="text-2xl font-bold text-primary">
  +27%
</span>
```

---

## 7 • Acessibilidade

* **Contraste mínimo AA**: 4.5:1 (todos os pares validados)
* **Foco visível:** outline em `#00E28A` com `2px`
* **Tamanho mínimo de toque:** `44x44px`
* **Suporte a dark mode:** tokens já definidos para modo escuro

---

## 8 • Design Tokens JSON

```json
{
  "font": {
    "base": "Montserrat, sans-serif",
    "heading": "Etna Sans, sans-serif"
  },
  "color": {
    "primary": "#00E28A",
    "text": "#3A3A3A",
    "background": "#FFFFFF",
    "border": "#B3B3B3"
  },
  "radius": {
    "sm": "4px",
    "md": "8px",
    "lg": "16px"
  },
  "shadow": {
    "default": "0px 2px 6px rgba(0,0,0,0.08)",
    "elevated": "0px 4px 12px rgba(0,0,0,0.12)"
  }
}
```

---

## 9 • Tailwind Snippet Base (`tailwind.config.js`)

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#00E28A',
        text: '#3A3A3A',
        background: '#FFFFFF',
        border: '#B3B3B3'
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        heading: ['Etna Sans', 'sans-serif']
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '16px'
      },
      boxShadow: {
        default: '0px 2px 6px rgba(0,0,0,0.08)',
        elevated: '0px 4px 12px rgba(0,0,0,0.12)'
      }
    }
  },
  plugins: []
}
```

---

## 10 • Figma & Storybook

* [📐 Design Tokens no Figma (Versão oficial)](https://figma.com/file/...)
* [📦 Componentes interativos no Storybook](https://storybook.binaryhub.dev)

---

> Última atualização: **11/07/2025** • Responsável: Design Lead @ Binary Hub
