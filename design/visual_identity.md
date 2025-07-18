Binary Hub – Guia de Estilo
Versão 1.0 • julho 2025

Este guia estabelece regras mínimas para que a marca Binary Hub mantenha consistência e legibilidade em qualquer ponto de contato (produto, marketing, comunidade).

# 1. Elementos de marca
## 1.1 Logotipo primário
* “binary” em Verde Neon
* “hub” em Pílula Verde com texto Cinza-Escuro
* Destinado a fundos escuros ou neutros (≥ 50 % luminância).

## 1.2 Logotipo reverso
* “binary” em Cinza-Escuro
* “hub” em Pílula Cinza com texto Branco
* Usado sobre o Verde Neon sólido ou fundos muito claros.

## 1.3 Símbolo / app-icon
* Círculo Verde Neon com contorno Branco de 2 px
* Texto “binary” + pílula “hub” dentro

| Tamanho mínimo |     Uso sugerido       | 
|----------------|------------------------|
|  32 × 32 px    | Favicon, avatar        |
|  48 × 48 px    | App-icon, bot Telegram |
|  72 × 72 px  	 | Atalhos mobile         |

### 1.3.1 Zona de proteção
Mantenha espaço livre ≥ ½ da altura da pílula ao redor de qualquer versão do logo.

# 2. Cores oficiais
Nome	Hex	Função principal	Contraste AA*
Verde Neon	#00E28A	Marca, botões primários	6.63 : 1 (sobre #3A3A3A)
Cinza-Escuro	#3A3A3A	Texto sobre Verde Neon, pílula escura	6.63 : 1 (sobre #00E28A)
Branco	#FFFFFF	Texto sobre Cinza‐Escuro	11.37 : 1
Cinza-Claro	#B3B3B3	Texto secundário, bordas sutis	≥ 4.5 : 1 (sobre cinza escuro)

* Verificado pelo WCAG 2.1 nível AA em tamanho de texto normal.

# 3. Tipografia
|    Uso          |  Família        | Peso(s) recomendados | Observações                                  |
|-----------------|-----------------|----------------------|----------------------------------------------|
| Headings & Logo |	Etna Sans Serif	| Bold / SemiBold      |  Arquivo OTF/Webfont no repositório de marca |
| Body text	      | Montserrat      | Regular / Medium     |  Ajuste line-height 1.5                      |

```css
/* Web import (exemplo) */
@font-face {
  font-family: 'EtnaSans';
  src: url('/fonts/EtnaSans-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
```

# 4. Uso correto
## ✔︎ Faça	
    Usar apenas as cores da paleta	
    Manter proporções originais	
    Verificar contraste AA ao escolher combinações
## ✖︎ Evite
    Girar, inclinar ou distorcer o logo
    Aplicar efeitos de glow, sombras pesadas ou gradientes sem aprovação
    Alterar a tipografia da marca

# 5. Tamanhos mínimos
| Elemento	           | Impresso | Digital        |
|----------------------|----------|----------------|
| Logotipo horizontal  | 30 mm	  | 100 px largura |
| Símbolo circular     | 12 mm    |	32 px          | 

# 6. Exemplos de aplicação
| Contexto                         |	Versão recomendada                        |
|----------------------------------|----------------------------------------------|
| Dashboard dark-mode              |	Logotipo primário                         |
| Landing page hero (fundo verde)  |	Logotipo reverso                          |
| Favicon / App-Icon               |	Símbolo circular                          | 
| Material impresso (papel branco) |	Logotipo reverso (tamanho mínimo ≥ 30 mm) | 

# 7. Acessibilidade & boas-práticas
* Sempre teste combinações de texto vs. fundo com ferramentas WCAG (ex.: Stark, Adobe Contrast Checker).
* Para componentes UI, mantenha contraste mínimo 4.5 : 1 em texto normal e 3 : 1 em ícones grandes.
* Prefira espaçamentos múltiplos de 4 px para ritmo visual consistente.

