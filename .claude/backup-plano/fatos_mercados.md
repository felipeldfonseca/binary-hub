# Fatos de mercado para contas em mais mercados (Forex, Cripto, Ações EUA, B3, Opções EUA)

Pesquisa de 2026-10-18 (todas as fontes vistas nesse dia, salvo indicação). Só fatos e nomes; nada copiado em trecho longo.
Marcas usadas: **(oficial)** = página da bolsa, regulador ou da própria empresa; **(secundária)** = imprensa, blog, revisor ou importador de diário; **(não verificado)** = não achei fonte firme, não usar como regra sem conferir.
Fusos e datas de horário de verão foram calculados com a base IANA (Python 3.14 `zoneinfo`) nesta máquina, não tirados de site.

---

## 0. Resumo para quem vai desenhar o formulário

| Mercado (`trading_accounts.market`) | Virada do dia usual | Moeda do resultado | Onde a pessoa opera (lista curta) | Mesas proprietárias |
|---|---|---|---|---|
| `forex` | 17:00 America/New_York (rollover) | moeda da conta (quase sempre USD; pode ser EUR, GBP…) | MetaTrader 5, MetaTrader 4, cTrader, DXtrade, Match-Trader, TradeLocker, TradingView | FTMO, The5ers, FundedNext, FundingPips, E8 Markets, Alpha Capital… (§1.5) |
| `crypto` | 00:00 UTC (velas, funding, mesas cripto) | USDT/USDC (contratos USDⓈ-M), a moeda (COIN-M) ou BRL (corretora brasileira à vista) | Binance, Bybit, OKX, Coinbase, Bitget, Kraken, Mercado Bitcoin | Breakout (Kraken), Crypto Fund Trader, BrightFunded, E8 Perpetuals… (§2.5) |
| `stocks` (EUA) | data do pregão em Nova York; com a sessão noturna da Nasdaq, 21:00 ET já é o dia seguinte | USD | Interactive Brokers, Schwab/thinkorswim, Webull, Tradier, Avenue, Nomad, Inter | Trade The Pool (só ações/ETF) |
| `options` (EUA) | idem ações; SPX/XSP/VIX têm sessão noturna (GTH) | USD (multiplicador 100) | thinkorswim, IBKR, tastytrade, Webull, Tradier | praticamente nenhuma (§4.4) |
| `b3` | 00:00 America/Sao_Paulo (pregões entre 09:00 e 18:30) | BRL | Profit (Nelogica), Tryd, MetaTrader 5 via corretora (XP, Clear, Rico, Genial, BTG, Modal) | Axia Investing e outras sem regulação (§5.5) |

Pontos que mais mexem no app (leitura minha, não fato de fonte):
1. **Moeda por conta.** B3 é em R$, cripto em USDT, forex pode vir em EUR. O limite diário tem de ser na moeda da conta; somar contas só dentro da mesma moeda.
2. **A virada do dia da mesa nem sempre é a do mercado.** FTMO zera à meia-noite de Praga (18:00 ET quase o ano todo, 19:00 ET em duas janelas de horário de verão desencontrado); FundedNext/The5ers à meia-noite do servidor MT (GMT+2/+3, ou seja 17:00 ET); mesas cripto em UTC (00:00, 00:05 ou 00:30 conforme a mesa). O formulário precisa de "a mesa zera o limite às …" por conta, com o padrão do mercado.
3. **Horário do arquivo.** MT4/MT5 gravam no horário do servidor da corretora (muito comum: GMT+2 no inverno de NY, GMT+3 no verão de NY, para a meia-noite cair às 17:00 ET). Não existe zona IANA "Area/Location" que siga essa regra; `localToUtc` hoje só aceita `UTC` ou Area/Location. Precisa de uma opção "Horário do servidor MT (NY + 7 h)" ou de pedir o deslocamento.
4. **Janelas.** Hoje as janelas só aceitam America/New_York ou America/Sao_Paulo. Forex e cripto pensam em Ásia/Londres/Nova York e em UTC; vale aceitar ao menos `UTC`, `Europe/London` e `Asia/Tokyo` como relógio da janela.
5. **Limite das mesas é sobre patrimônio (inclui posição aberta), em % do saldo inicial.** O diário só vê operações fechadas (CSV), então o "limite do app" continua sendo a regra do trader, não uma réplica da regra da mesa. Para mesa, oferecer o limite em % do tamanho da conta além de valor fixo.

---

## 1. Forex

### 1.1 Horário e virada do dia
- Semana: de domingo 17:00 a sexta 17:00, hora de Nova York (Forex.com, página de horários **(oficial do broker)** https://www.forex.com/en-us/help-and-support/market-trading-hours/ ; OANDA, PDF "Hours of Operation" **(oficial do broker)** https://www.oanda.com/assets/documents/252/Hours_of_Operation.pdf — ambos vistos via resultado de busca em 2026-10-18). OANDA avisa que o spread abre na sexta por volta de 16:00 e que o preço pode dar "gap" na reabertura de domingo.
- Rollover diário às 17:00 ET; swap triplo costuma cair na quarta (liquidação T+2 do fim de semana); feriado bancário de uma das moedas pode zerar o swap de um dia e dobrá-lo no seguinte (FXCM help, FxPro glossário **(secundária/broker)** https://www.fxcm.com/markets/help/rollover-are-trades-held-over-the-weekend-affected-by-trade-rollover/ , https://www.fxpro.com/help-section/traders-glossary/rollover). Alguns instrumentos cobram o triplo na sexta.
- Convenção do "dia do forex" = 17:00 ET. Corretoras de MetaTrader costumam pôr o relógio do servidor em GMT+2 (inverno de NY) / GMT+3 (verão de NY), acompanhando o horário de verão dos EUA, para que a meia-noite do servidor caia às 17:00 ET e a semana tenha 5 velas diárias; não é universal (há servidores em UTC ou em outros fusos, e demo e real da mesma empresa podem diferir) (MQL5 blog, 28 ago 2026 **(secundária)** https://www.mql5.com/en/blogs/post/774934 e https://www.mql5.com/en/blogs/post/773934).
- Em Brasília, 17:00 ET = 19:00 (EST, nov–mar) ou 18:00 (EDT, mar–nov). Calculado.
- Feriados: o mercado interbancário não fecha em feriado dos EUA; Forex.com diz operar "including most U.S. holidays" (fonte acima). Liquidez cai no Natal/Ano-novo (não verificado em fonte oficial).

### 1.2 Sessões (como o trader pensa) — o dono usa "Ásia"
Definição comum em hora local de cada praça (Dukascopy, tabela em GMT **(secundária/broker)** https://www.dukascopy.com/swiss/english/fx-market-tools/forex-market-hours/): Sydney 22:00–07:00 GMT, Tóquio 00:00–09:00 GMT, Londres 08:00–17:00 GMT, Nova York 13:00–22:00 GMT; sobreposição Londres–NY 13:00–17:00 GMT. As fontes divergem em 1 h no fim de Tóquio (03:00 ou 04:00 ET) — Babypips/Benzinga (busca, **secundária**).

Tradução pelo relógio (calculado com IANA; sessão = 09–18 Tóquio, 08–17 Londres, 08–17 NY, 07–16 Sydney, cada uma no seu relógio local):

| Data exemplo | Ásia (Tóquio) | Londres | Nova York |
|---|---|---|---|
| 15 jan 2026 (EUA e Europa sem horário de verão) | 19:00–04:00 ET · 21:00–06:00 BRT | 03:00–12:00 ET · 05:00–14:00 BRT | 08:00–17:00 ET · 10:00–19:00 BRT |
| 15 jul 2026 (ambos com horário de verão) | 20:00–05:00 ET · 21:00–06:00 BRT | 03:00–12:00 ET · 04:00–13:00 BRT | 08:00–17:00 ET · 09:00–18:00 BRT |
| 18 mar e 28 out 2026 (EUA em verão, Europa não) | 20:00–05:00 ET · 21:00–06:00 BRT | **04:00–13:00 ET** · 05:00–14:00 BRT | 08:00–17:00 ET · 09:00–18:00 BRT |

- Japão e Brasil não têm horário de verão (Brasil: Decreto 9.772/2019 continua em vigor; reportagem do JB de 5 out 2026 diz que o governo não prevê retomar **(secundária)** https://www.jb.com.br/editorias/2026/10/05/horario-de-verao-2026.html). Logo a sessão da Ásia é fixa em Brasília (21:00–06:00) e a de NY anda 1 h duas vezes por ano.
- Trocas de horário (IANA): EUA 8 mar 2026 e 1 nov 2026 (2027: 14 mar e 7 nov); Reino Unido/UE 29 mar 2026 e 25 out 2026 (2027: 28 mar e 31 out); Sydney 5 abr 2026 e 4 out 2026. Semanas "desencontradas" em 2026: 9–28 mar e 26 out–1 nov (Londres abre 04:00 ET em vez de 03:00).
- A sessão da Ásia começa na noite anterior em ET/BRT. Com o dia do forex virando às 17:00 ET, a Ásia cai inteira no dia seguinte (consistente com a regra do app "janela que atravessa a noite conta no dia em que abriu", desde que o dia do mercado vire às 17:00 ET). Se o dia fosse meia-noite de Brasília, a Ásia (21:00–06:00 BRT) ficaria partida em dois dias.
- "Killzones" (Ásia 20:00–00:00, Londres 02:00–05:00, NY 07:00–10:00 em hora de NY) são convenção da comunidade ICT **(não verificado)**; servem de sugestão de janela, não de regra.

### 1.3 Plataformas e exportação
| Plataforma | Exporta histórico? | Formato e colunas | Fonte |
|---|---|---|---|
| MetaTrader 5 | Sim: aba Histórico → Relatório | HTML e PDF (ajuda oficial); seções Orders, Deals, Summary; a coluna "Fee" entrou na exportação numa versão recente. Um guia cita "Open XML (Excel 2007)" — não confirmado na ajuda atual. Horas no horário do servidor da corretora. | https://www.metatrader5.com/en/terminal/help/trading/report , https://www.metatrader5.com/en/terminal/help/trading_advanced/history_report **(oficial)**; https://tradiso.helpscoutdocs.com/article/45-how-to-download-your-trading-history-or-statement-from-metatrader-5-mt5-desktop-version **(secundária)** |
| MetaTrader 4 | Sim (relatório/extrato HTML) | HTML | TradesViz lista MT4 com importação manual e sincronização automática https://www.tradesviz.com/brokers-list/ **(secundária)** |
| cTrader | Sim: aba History | Excel/CSV segundo TradesViz; HTML segundo TradeZella (arquivo precisa estar em inglês). Campos usados: abertura/fechamento, preços, símbolo, ID, quantidade, comissão, swap, P&L bruto e líquido na moeda da conta | https://www.tradesviz.com/brokers/RSG , https://www.tradezella.com/integrations/ctrader **(secundária)** |
| Match-Trader | Sim: "Closed Positions" → CSV | CSV | https://www.tradesviz.com/brokers/MatchTrader **(secundária)** |
| DXtrade | Sim: Trading Journal → Order History | (formato não confirmado) | https://www.tradesviz.com/brokers/DXtrade **(secundária)** |
| TradeLocker | listado no TradesViz | método não informado | https://www.tradesviz.com/brokers-list/ |
| TradingView | listado no TradesViz | método não informado; é tela gráfica ligada a broker/mesa | idem |

### 1.4 Regulação para brasileiros
- CVM entende forex/CFD como valor mobiliário e já mandou suspender ofertas de empresas estrangeiras não autorizadas (OANDA 2022, LiteForex, Binomo) (InfoMoney, Suno, BP Money **(secundária)** https://www.infomoney.com.br/?p=423491 , https://www.suno.com.br/noticias/?p=71336 , https://bpmoney.com.br/?p=416279). Operar em corretora no exterior não é proibido ao residente; captar cliente no Brasil sem registro é. Na prática, forex de varejo de brasileiro é offshore ou via mesa proprietária. (Isso não muda o formulário, só explica por que a mesa é o caso comum.)

### 1.5 Mesas proprietárias de forex/CFD
Lista da Prop Firm Match, aba Forex (https://propfirmmatch.com/ , vista em 2026-10-18 no navegador; ordem padrão "Popularity" do site, que também exibe cupons de afiliado — não é ranking só por nota). Nota = média das avaliações de usuários no site.

| # | Mesa | Nota (avaliações) | País | Plataformas |
|---|---|---|---|---|
| 1 | FundedNext | 4,3 (901) | Dubai | cTrader, MT4, MT5, Match-Trader |
| 2 | The5ers | 4,7 (1.371) | Reino Unido | cTrader, MT5, TradingView |
| 3 | Alpha Capital | 4,4 (1.145) | Reino Unido | TradeLocker, cTrader, DXtrade, MT5 |
| 4 | BrightFunded | 4,4 (133) | Dubai | cTrader, MT5, BrightFunded (DXtrade) |
| 5 | E8 Markets | 4,8 (495) | EUA | TradeLocker, cTrader, MT5, Match-Trader |
| 6 | FundingPips | 4,2 (1.231) | Dubai | cTrader, MT5, Match-Trader |
| 7 | Blue Guardian | 4,2 (244) | Dubai | TradeLocker, MT5, Match-Trader |
| 8 | AquaFunded | 4,4 (318) | Dubai | TradeLocker, cTrader, MT5, Match-Trader |
| 9 | Crypto Fund Trader | 4,2 (111) | Suíça | Bybit, MT5 |
| 10 | Top One Trader | 4,4 (220) | EUA | TradeLocker, MT5, Match-Trader |
| 11 | Moneta Funded | 4,8 (105) | Dubai | MT5, Match-Trader |
| 12 | Hola Prime | 4,3 (177) | Hong Kong | TradeLocker, cTrader, MT5, Match-Trader |
| 13 | Atmos Funded | 4,7 (48) | Chipre | MT5 |
| 14 | FundedElite | 4,4 (200) | Itália | MT5, Match-Trader |
| 15 | Goat Funded Trader | 4,0 (1.247) | Hong Kong | TradeLocker, cTrader, MT5, Match-Trader |
| — | FTMO (aba "All", fora do top 15) | 4,5 (216) | — | cTrader, MT4, MT5, TradingView |
| — | For Traders, Lark Funding, Funded Trading Plus, City Traders Imperium (aba "All") | 4,3–4,5 | — | MT5/cTrader/Match-Trader/DXtrade |

"Top One Trader" (forex) tem o mesmo nome da mesa de futuros do dono ("Top One Futures"); relação entre as duas **(não verificado)**.

Como as contas funcionam (só o que importa ao formulário e ao limite diário):
- **Fases:** desafio (fase 1) → verificação (fase 2) → conta financiada; há também "1-Step" (uma fase) e contas "instant". FTMO 2-Step: alvo 10% na fase 1 e 5% na verificação (https://ftmo.com/en/2-step-challenge/ via busca **(oficial)**). Os valores de fase do app (`avaliacao`, `financiada`, `pessoal`, `demo`) cobrem isso; "verificação" seria uma segunda avaliação.
- **FTMO** (https://ftmo.com/en/drawdowns/ **(oficial)**): perda diária máx. 5% (2-Step) ou 3% (1-Step) do saldo inicial; conta o resultado fechado do dia + o flutuante, com comissão e swap; recalculada à meia-noite CE(S)T (Praga). Perda máx. 10% do saldo inicial; no 1-Step é "trailing" pelo maior saldo de fim de dia. FTMO avisa que a troca de horário pode deslocar o reset em 1 h (trading updates, via busca).
  - Meia-noite de Praga em Nova York (calculado): 18:00 ET em 337 dias de 2026; **19:00 ET** de 9 a 28 mar e de 26 out a 1 nov.
- **FundedNext (CFD):** limite diário zera à meia-noite do servidor: GMT+3 com horário de verão, GMT+2 sem (https://help.fundednext.com/en/articles/8394309-when-does-the-daily-loss-limit-reset-with-fundednext-cfd **(oficial)**). Qual horário de verão (EUA ou UE) o servidor segue não está dito.
- **The5ers:** 5% diário no High Stakes; 3% "pausa diária" no Hyper Growth; reset à meia-noite do servidor MT5 (GMT+2/+3); base = maior entre saldo e patrimônio à meia-noite segundo uma fonte, menor segundo outra (revisores **(secundária, divergente)** https://tradetanto.com/learn/the-5-ers-rules-explained-a-complete-guide , https://proptradingvibes.com/blog/the5ers-daily-loss-limit).
- Regra geral das mesas: limite diário 2–5% e total 6–10% do saldo inicial; perda diária por patrimônio (inclui aberto) ou por saldo do fim do dia anterior (propfirmmap, guia 2026 **(secundária)** https://propfirmmap.com/blog/understanding-prop-firm-drawdown-rules-complete-guide-2026).

### 1.6 Moeda
- O resultado vem na moeda de depósito da conta (USD na grande maioria das mesas; corretoras de varejo aceitam EUR, GBP etc.) — **(não verificado em fonte única; é como MT5/cTrader funcionam)**. Comissão por lote e swap aparecem em colunas separadas (cTrader/TradesViz acima). Limite em US$ só vale direto se a conta for em USD.

---

## 2. Cripto

### 2.1 Horário e virada do dia
- 24/7, sem feriado nem fim de semana.
- Velas diárias da Binance em UTC: o parâmetro `timeZone` das klines tem padrão 0 (UTC) (https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints **(oficial)**).
- Funding dos perpétuos da Binance a cada 8 h, às 00:00, 08:00 e 16:00 UTC; a Binance pode passar um contrato para 1 h (e depois 4 h) em volatilidade extrema; só paga/recebe quem está posicionado no instante (https://www.binance.com/en/support/faq/introduction-to-binance-futures-funding-rates-360033525031 **(oficial)**).
- Nem toda corretora usa meia-noite UTC: na Coinbase (derivativos internacionais) o P&L "da sessão" zera às 08:00 UTC (help.coinbase.com, via busca; a página recusou acesso direto **(oficial, lido por resumo de busca)** https://help.coinbase.com/en/coinbase/derivatives/global-derivatives-settlement).
- Mesas cripto zeram o limite diário em UTC: Crypto Fund Trader 00:05 UTC (revisor), Breakout 00:30 UTC (revisores) **(secundária, não verificado na fonte oficial)** https://thegodfunded.com/en/firms/cryptofundtradercrypto/ , https://lunefi.com/blog/breakout-complete-guide-to-rules-and-payouts .
- 00:00 UTC = 21:00 em Brasília (dia anterior) o ano todo; = 19:00 ET (inverno) / 20:00 ET (verão). Para um brasileiro que opera à noite, a virada UTC cai no meio da sessão. Leitura minha: padrão 00:00 UTC (convenção das bolsas e mesas), com opção "meia-noite de Brasília" por conta.

### 2.2 Sessões
- As mesmas três (Ásia, Londres, Nova York) são usadas por traders de cripto por causa da liquidez; não há abertura oficial. Sem fonte oficial — **(não verificado)**.

### 2.3 Corretoras e exportação
| Corretora | Exportação | Observações | Fonte |
|---|---|---|---|
| Binance | Sim. Futuros: exportar o histórico do USDⓈ-M ou do COIN-M; funding num extrato separado. À vista: a página "Trade History" e sua exportação saíram em fev/2022; sobrou "Order History" (colunas: hora, ativo base/cotação, tipo, preço, quantidade, total, taxa, moeda da taxa, ID) | datas em UTC | https://traderssecondbrain.com/guides/how-to-export-binance-trade-history , https://hackage.haskell.org/package/binance-exports **(secundária)** |
| Bybit | Sim: autoexportação de Account Statement (PDF), Transaction Log e Order History (direção, quantidade, taxas, preço de entrada/execução, P&L) | formato antigo tinha "Trade Time(UTC+0)", "Closed P&L"; descontinuado em 11 jul 2024; derivativos limitados a 3 meses por exportação (importador) | https://www.bybit.com/en/help-center/article/How-to-export-my-account-data-Order-History-Trade-History-Assets-History-Closed-P-L **(oficial)**; https://help.coinledger.io/en/articles/6601040-bybit-file-import-guide **(secundária)** |
| OKX, Coinbase, Bitget, Kraken | listados no TradesViz (método não informado) | Kraken: exportação de trades em CSV/PDF por período | https://www.tradesviz.com/brokers-list/ ; https://support.kraken.com/br/articles/14320306955668-How-to-export-your-account-history **(oficial)** |
| Mercado Bitcoin | **não confirmado** se exporta CSV; não está no TradesViz | corretora brasileira, resultado em BRL | — |

Brasil, regulação (afeta quais corretoras ficam na lista):
- Resoluções BCB 519/520/521 (cripto) em vigor desde fevereiro de 2026; adaptação até novembro de 2026; exigem sede no Brasil e capital mínimo de R$ 10 mi (Finsiders, Startups, ConJur **(secundária)** https://finsidersbrasil.com.br/regulamentacao/bc-antecipa-o-que-estara-na-regulacao-de-criptoativos , https://startups.com.br/negocios/cripto/cripto-saiba-o-que-muda-com-as-novas-regras-do-bc-para-ativos-digitais/).
- Um texto (Substack, 3 ago 2026) diz que corretoras estrangeiras têm até **30 out 2026** para migrar clientes brasileiros a entidade licenciada ou parar, e que a Bybit cortou futuros/derivativos para contas brasileiras em maio de 2026 mantendo o à vista **(fonte única, não verificado)** https://techcripto.substack.com/p/two-crypto-exchanges-left-brazil . Fato antigo e firme: em set/2022 a Bybit suspendeu futuros e opções no Brasil após ordem da CVM (CoinDesk **(secundária)** https://coindesk-coindesk-prod.cdn.arcpublishing.com/business/2022/09/14/crypto-exchange-bybit-halts-derivatives-trading-in-brazil-after-exchange-commission-ban/ (link como veio na busca; InfoMoney também cobriu: https://www.infomoney.com.br/mercados/cvm-ordena-suspensao-de-servicos-da-exchange-cripto-bybit-no-brasil/)).
- Leitura minha: a lista de corretoras cripto deve ser editável sem migração, porque pode mudar depois de 30 out 2026.

### 2.4 Moeda
- Perpétuos USDⓈ-M: resultado em USDT/USDC; COIN-M: resultado na própria moeda (BTC, ETH…); à vista em corretora brasileira: BRL (Binance, docs acima, para os nomes USDⓈ-M/COIN-M). USDT não é US$ exato: tratar como moeda própria ou aceitar 1:1 por escolha do trader (leitura minha).

### 2.5 Mesas proprietárias de cripto
Prop Firm Match, aba Crypto (https://propfirmmatch.com/crypto , vista em 2026-10-18; mesma ressalva de ordem):

| # | Mesa | Nota (avaliações) | País | Plataforma | Corretora/execução |
|---|---|---|---|---|---|
| 1 | BrightFunded | 4,4 (133) | Dubai | cTrader, MT5, BrightFunded (DXtrade) | Coinbase +3 |
| 2 | E8 Perpetuals | menos de 10 | EUA | E8 | (Hy…) |
| 3 | Crypto Fund Trader | 4,2 (111) | Suíça | Bybit, MT5 | Bybit |
| 4 | Breakout | 4,6 (45) | Ilhas Virgens Brit. | Breakout Terminal | — |
| 5 | For Traders Crypto | menos de 10 | Dubai | TradeLocker, MT5 | Kraken |
| 6 | WenCrypto | menos de 10 | Santa Lúcia | Match-Trader | Bybit +3 |
| 7 | Tradeify | menos de 10 | EUA | DXtrade, MT5 | Bybit +2 |
| 8 | BEM Funding | 5,0 (34) | Dubai | cTrader, MT5 | Co… +2 |

- Breakout foi comprada pela Kraken (anúncio 4 set 2025; até US$ 200 mil de capital nocional; até 90% do lucro; será integrada ao Kraken Pro) (Business Wire/Payward **(oficial)** https://www.businesswire.com/news/home/20250904012956/en/Kraken-Completes-Major-Acquisition-of-Breakout-to-Offer-Prop-Trading-to-Clients-Globally). Desde 29 jul 2026 só planos 1-Step (Classic, Pro, Turbo), 3% de perda diária, máx. 3–5% estático conforme plano **(secundária)** https://proptradingvibes.com/prop-firms/breakout.
- Crypto Fund Trader: 1 fase 4% diário / 6% total (trailing); 2 fases 5% / 10% (fixo) **(secundária, divergente)** https://thegodfunded.com/en/firms/cryptofundtradercrypto/ .
- HyroTrader (citada no pedido) **não aparece** na lista da Prop Firm Match vista.

---

## 3. Ações dos EUA (e ETFs)

### 3.1 Horário, feriados, virada do dia
- Pregão regular 09:30–16:00 ET (NYSE, NYSE Arca, NYSE American). Sessões estendidas: NYSE Arca 04:00–09:30 e 16:00–20:00; NYSE American 07:00–09:30 e 16:00–20:00; NYSE (Tapes B/C) 07:00–09:30 (https://www.nyse.com/markets/hours-calendars **(oficial)**).
- Feriados 2026: 1 jan, 19 jan, 16 fev, 3 abr, 25 mai, 19 jun, 3 jul, 7 set, 26 nov, 25 dez. 2027: 1 jan, 18 jan, 15 fev, 26 mar, 31 mai, 18 jun, 5 jul, 6 set, 25 nov, 24 dez. Fechamento às 13:00 (opções elegíveis 13:15): 27 nov 2026, 24 dez 2026, 26 nov 2027 (mesma página **(oficial)**).
- Sessão noturna: a SEC aprovou em 10 abr 2026 o "23/5" da Nasdaq — sessão diurna 04:00–20:00 ET, pausa 20:00–21:00, noturna 21:00–04:00, semana começando domingo 21:00 (Simpson Thacher, 29 abr 2026 **(secundária, escritório de advocacia)** https://www.stblaw.com/about-us/publications/view/2026/04/29/looking-ahead-to-extended-trading-sec-approves-nasdaq-s-23-5-trading-proposal). A NYSE Arca teve 22 h aprovadas em fev 2025 (mesma fonte).
- **Data do negócio na sessão noturna:** das 21:00 à meia-noite o negócio leva a data do dia seguinte; o envio para compensação 24 h começa em **6 dez 2026** (Nasdaq FAQ "post-trade 23/5" **(oficial, lido por resumo de busca)** https://www.nasdaq.com/docs/post-trade-23/5-faq). Leitura minha: para ações e opções dos EUA, virar o dia às 20:00 ET (na pausa) cobre o regime atual e o novo.
- Em Brasília, 09:30–16:00 ET = 11:30–18:00 (EST) ou 10:30–17:00 (EDT) (calculado).
- Regra do "pattern day trader" (US$ 25 mil) foi substituída por padrões de margem intradiária: SEC aprovou em 14 abr 2026; vigência 4 jun 2026; corretoras podem implantar até 20 out 2027 (FINRA Regulatory Notice 26-10 **(oficial, via busca)** https://www.finra.org/rules-guidance/notices/26-10). Não precisa de campo no formulário.

### 3.2 Sessões
- O trader de ações pensa em pré-mercado (04:00–09:30), abertura (09:30), meio do dia, último hora e after (16:00–20:00), todas em ET. Ásia/Londres pouco importam (leitura minha).

### 3.3 Corretoras e exportação
| Corretora | Exportação | Fonte |
|---|---|---|
| Interactive Brokers | Flex Query em CSV (ou XML). Colunas usadas por importadores: Symbol, AssetClass, CurrencyPrimary, TradeDate, DateTime, Quantity (com sinal), TradePrice, IBCommission (negativa), FifoPnlRealized, Buy/Sell, TradeID. Até 365 dias por consulta. Fuso do DateTime não documentado nas fontes vistas. | https://tapeboard.com/manual/import-ibkr-flex-csv , https://help.navexa.com/en/articles/16061811-import-interactive-brokers-ibkr-trades-using-csv , https://www.tradesviz.com/blog/auto-import-trades/ **(secundária)** |
| Schwab / thinkorswim | Monitor → Account Statement → exportar CSV; seção "Account Trade History" com Exec Time, Spread, Side, Qty, Symbol, Exp, Strike, Type, Price, Order ID (Pos Effect só garantido em Order History) | https://webhelp.tradingdiarypro.com/tos_import.htm , https://www.tradezella.com/integrations/thinkorswim **(secundária)** |
| Webull, Tradier | listados no TradesViz (método não informado) | https://www.tradesviz.com/brokers-list/ |
| Avenue | Notas de corretagem em PDF (geradas no dia útil seguinte; Relatórios → Notas de Corretagem); exportação CSV **não confirmada** | https://avenue.us/duvidas/como-consultar-o-relatorio-de-notas-de-corretagem/ **(oficial)** |
| Nomad, Inter (conta global), XP Internacional | citadas como opções para brasileiros; exportação **não verificada**; não estão no TradesViz | — |
- Quais corretoras dos EUA aceitam residente no Brasil hoje: **não verificado** nesta pesquisa (Robinhood não atende o Brasil, segundo ranking de 2026 **(secundária)**).

### 3.4 Mesas
- Trade The Pool (Israel; só ações/ETF; nota "menos de 10 avaliações" na aba Futures da Prop Firm Match em 2026-10-18). Regras por revisores: day trade 2% diário / 4% máx. estático; swing 3% / 7%; sem opções **(secundária, divergente)** https://lunefi.com/blog/trade-the-pool-complete-guide-to-rules-and-payouts .

### 3.5 Moeda
- USD. Limite em US$ vale direto.

---

## 4. Opções listadas dos EUA

### 4.1 Horário e virada do dia
- Opções de ações: 09:30–16:00 ET. Algumas opções de ETF/índice vão até 16:15 ET: SPY, QQQ, IWM, DIA, SPX (Firstrade, SpotGamma, Bankrate **(secundária)** https://help.en-US.firstrade.com/article/831-options-that-trade-until-4-15-pm-eastern-standard-time , https://support.spotgamma.com/hc/en-us/articles/15213310679187-AH-After-Hours-Premarket-Postmarket). No último dia, as séries que vencem (SPXW, XSP, NDXP, RUTW…) param às 16:00 (Firstrade).
- Cboe: sessão "Curb" 16:15–17:00 ET para SPX, VIX e XSP; "Global Trading Hours" 20:15 (dia anterior) – 09:25 ET, seg–sex (registro SEC 2024 e filing 2026 **(oficial)** https://www.sec.gov/files/rules/sro/cboe/2024/34-100524.pdf , https://www.sec.gov/files/rules/sro/cboe/2026/34-106620.pdf). Se a GTH conta para o pregão seguinte: **não verificado** (provável, como no futuro).
- Fechamento antecipado: opções elegíveis às 13:15 nos dias de meio pregão (NYSE, acima).

### 4.2 Plataformas
- thinkorswim (export acima, inclui Exp/Strike/Type), IBKR (Flex, AssetClass=OPT), Webull, Tradier, tastytrade (TradesViz lista "TastyWorks") — https://www.tradesviz.com/brokers-list/ **(secundária)**. Um diário precisa tratar pernas, exercício e atribuição (leitura minha).

### 4.3 Moeda
- USD; contrato padrão de 100 ações (conhecimento geral, **não verificado** nesta pesquisa).

### 4.4 Mesas
- Não achei mesa proprietária de varejo que permita opções listadas dos EUA; Trade The Pool proíbe opções (revisor acima). **(não verificado que não exista nenhuma)**.

---

## 5. B3 (mini-índice, mini-dólar e ações)

### 5.1 Horário (Brasília) — grade em vigor desde 9 mar 2026
- Ofício Circular 005/2026-PRE: a partir de 9 mar 2026, ações 10:00–17:00 com after-market, termo até 17:25, derivativos 09:00–18:30, acompanhando o horário de verão dos EUA (B3 notícia, 6 mar 2026 **(oficial)** https://www.b3.com.br/pt_br/noticias/operacoes-8AA8D0CD9C709633019CC38376552862.htm ; Bora Investir/B3 https://borainvestir.b3.com.br/noticias/mercado/b3-a-bolsa-do-brasil-muda-horarios-de-negociacao-a-partir-de-9-de-marco-confira/).
- Ações, mercado à vista (página de horários da B3 **(oficial)** https://www.b3.com.br/pt_br/solucoes/plataformas/puma-trading-system/para-participantes-e-traders/horario-de-negociacao/acoes/): cancelamento 09:30–09:45, pré-abertura 09:45–10:00, negociação 10:00–16:55, call de fechamento 16:55–17:00, after-market 17:30–18:00 (cancelamento 17:25–17:30 e 18:25–18:45). Datas de vencimento de opções mudam o after.
- Mini e cheio de Ibovespa (WIN/IND): pré-abertura 08:55, negociação 09:00–18:25, call 18:25; sem negociação estendida nem after-hours; no vencimento do IND o contrato vincendo fecha às 17:00; ajuste apurado 17:00–17:15 (https://www.b3.com.br/pt_br/solucoes/plataformas/puma-trading-system/para-participantes-e-traders/horario-de-negociacao/derivativos/indices/ **(oficial)**).
- Dólar e mini-dólar (DOL/WDO): pré-abertura 08:55, negociação 09:00–18:30; ajuste 15:50–16:00 (https://www.b3.com.br/pt_br/solucoes/plataformas/puma-trading-system/para-participantes-e-traders/horario-de-negociacao/derivativos/cambio-e-dolar-pronto/ **(oficial)**).
- **Fim do horário de verão dos EUA (1 nov 2026):** em 2024 (4 nov) e 2025 (3 nov) a B3 passou o à vista para 10:00–17:55 + call 17:55–18:00 **sem after-market** (exceto vencimento de opções); câmbio futuro 09:00–18:30 (Ofício 040/043-2025-VNC via Acionista/BP Money/Money Times **(secundária citando oficial)** https://acionista.com.br/b3-b3sa3-novos-horarios-de-negociacao/ , https://bpmoney.com.br/mercado/b3-estende-horario-de-negociacao-a-partir-desta-segunda-4). Para 2026 o comunicado **não foi achado**; imprensa aponta 3 nov 2026 (2 nov é Finados) **(não verificado)**.
- Virada do dia: tudo acontece entre 08:55 e 18:45 do mesmo dia civil de Brasília, então meia-noite America/Sao_Paulo serve. O Brasil não tem horário de verão (Decreto 9.772/2019), mas a **grade da B3 muda duas vezes por ano** com o horário de verão dos EUA; uma janela "10:00–11:00 BRT" continua certa, já a abertura do à vista em relação a NY muda.

### 5.2 Feriados 2026
- Sem pregão no Carnaval (16 e 17 fev); Quarta de Cinzas (18 fev) abre às 13:00 (pré 12:45); sem pregão em 24 e 31 dez (B3 notícia e Ofício 054/2025-VNC + errata 041/2026 **(oficial)** https://www.b3.com.br/pt_br/noticias/calendario-de-negociacao-da-b3-confira-o-funcionamento-da-bolsa-em-2026.htm). Lista completa no ofício (não transcrita aqui).

### 5.3 Contratos (para o formulário e o limite)
- WIN: 20% do IND; R$ 0,20 por ponto (IND R$ 1,00). WDO: US$ 10.000; R$ 10,00 por ponto; tick 0,5 ponto = R$ 5,00 (Rico, InvestNews, Awake Trader **(secundária)** https://riconnect.rico.com.vc/blog/mini-indice/ , https://www.awaketrader.com/activos/wdo-mini-dolar). Conferir na especificação da B3 antes de codificar.
- Custos: nota de corretagem (SINACOR) traz corretagem, emolumentos, taxa de registro e ISS; IRRF de 1% sobre lucro de day trade é retenção de imposto, não custo de operação (Toro, iDinheiro **(secundária)** https://blog.toroinvestimentos.com.br/bolsa/emolumentos/ , https://www.idinheiro.com.br/investimentos/nota-de-corretagem/). Valores por contrato **não verificados**. Leitura minha: "resultado líquido" na B3 = bruto − corretagem − emolumentos/registro (− ISS), sem imposto.

### 5.4 Plataformas e exportação
| Plataforma | Exportação | Fonte |
|---|---|---|
| Profit (Nelogica; ProfitPro) | Menu Trading → "List of Orders" → "Executed" → período → botão direito "Export order list CSV". Futuros e ações. Colunas não listadas na fonte. TradesViz importa ("Nelogica") | https://www.tradesviz.com/brokers/Nelogica **(secundária)** |
| Tryd | **não verificado** | — |
| MetaTrader 5 via corretora | Rico lançou MT5 para B3 em 2015; ModalMais em 2017; Clear tem MT5 (demo citada em fórum); XP/Genial **não confirmados**. Exportação como no §1.3 (HTML/PDF) | https://www.metatrader4.com/es/company/218 , https://www.metatrader5.com/pt/news/1447 **(oficial MetaQuotes)** |
| Corretoras (XP, Clear, Rico, Genial, BTG, Modal, Inter, NuInvest) | nota de corretagem em PDF (padrão do mercado); CSV de operações por corretora **não verificado** | — |
| TradesViz | não lista Tryd, XP, Clear, Genial, BTG, Rico, Inter | https://www.tradesviz.com/brokers-list/ |

### 5.5 Mesas proprietárias na B3
- Não há norma da CVM específica para mesa proprietária de varejo; sem registro nem supervisão de CVM/BC (Awake Trader, 2026 **(secundária)** https://www.awaketrader.com/pt/educacao/mesa-proprietaria-regulamentada-brasil-cvm-2026).
- Axia Investing: pioneira (2017), comprou a TC Star Desk (Monitor Mercantil **(secundária)** https://monitormercantil.com.br/axia-investing-compra-tc-star-desk/). Avaliação de 45 ou 75 dias corridos em conta simulada; limites de perda diária e total (valores não publicados na fonte); repasse até 85–90% do lucro mensal líquido (iDinheiro, atualizado 30 dez 2025 **(secundária)** https://www.idinheiro.com.br/investimentos/axia-investing/). Reclamações citam limite "global/mensal" e custo de plataforma entrando no limite (Reclame Aqui, via busca).
- Não achei ranking confiável de mesas brasileiras; a Prop Firm Match não cobre B3. Leitura minha: na B3 a "mesa" fica como texto livre, com Axia como sugestão.

### 5.6 Moeda
- BRL. Limite diário em R$; não somar com contas em US$ sem câmbio (PTAX do dia, se um dia for preciso — leitura minha).

---

## 6. Moeda do resultado e o limite diário (juntando tudo)

| Mercado | Moeda do P&L | O limite "US$ 400" de hoje… |
|---|---|---|
| Futuros CME (Top One) | USD | vale como está |
| Opções binárias (Ebinex) | USD (conta da Ebinex) | vale |
| Forex | moeda da conta (USD na maioria das mesas; EUR/GBP possíveis) | vale só se a conta for USD |
| Cripto | USDT/USDC, ou a moeda (COIN-M), ou BRL | USDT ≈ USD, não igual; COIN-M e BRL não |
| Ações/Opções EUA | USD | vale |
| B3 | BRL | não vale; precisa de limite em R$ |

Consequências (leitura minha):
- `trading_accounts` precisa de `currency` (ISO 4217 + `USDT`/`USDC`), com padrão por mercado; o limite diário e o "Somando as contas de Futuros" só somam contas da mesma moeda.
- Mesas definem limite em % do saldo inicial e, várias vezes, sobre patrimônio com posição aberta; o app mede o pior ponto do resultado fechado (decisão da Fase 2). Mostrar o limite da mesa como referência ("sua mesa: 5% = US$ 5.000, zera 18:00 ET") e deixar claro que o app não vê o flutuante.
- Padrões sugeridos para `MARKET_DAY` (formato do código atual `day_tz`/`day_start_min`): forex `America/New_York` 1020 (17:00); crypto `UTC` 0; stocks e options `America/New_York` 1200 (20:00, na pausa da sessão noturna); b3 `America/Sao_Paulo` 0. Com override por conta para o reset da mesa (FTMO = Europe/Prague 0; mesas MT com GMT+2/+3 = America/New_York 1020; mesas cripto = UTC 0/5/30).

---

## Anexo A — lista de mesas de **futuros** da Prop Firm Match (vista de passagem, mesmo dia)
Útil para o pedido (1) do dono. Página https://propfirmmatch.com/futures em 2026-10-18, ordem padrão "Popularity" (não é ordem de nota; o site mostra cupons de afiliado ao lado):

| # | Mesa | Nota (avaliações) | País | Anos |
|---|---|---|---|---|
| 1 | Lucid Trading | 4,5 (173) | EUA | 1 |
| 2 | Tradeify | 4,6 (214) | EUA | 2 |
| 3 | FundedNext Futures | 4,4 (100) | Dubai | 1 |
| 4 | My Funded Futures | 4,6 (263) | EUA | 2 |
| 5 | Top One Futures | 4,7 (99) | EUA | 1 |
| 6 | Traders Launch | 4,7 (68) | EUA | 3 |
| 7 | Topstep | 4,5 (140) | EUA | 10+ |
| 8 | Apex Trader Funding | 3,7 (130) | EUA | 5 |
| 9 | Funded Futures Family | 3,5 (79) | EUA | 2 |
| 10 | Blue Guardian Futures | 4,2 (88) | Dubai | 1 |
| 11 | FuturesElite | 3,9 (27) | Itália | 1 |
| 12 | TradeDay | 4,4 (16) | EUA | 6 |
| 13 | Take Profit Trader | 3,3 (22) | EUA | 5 |
| 14 | Earn2Trade | 4,3 (33) | EUA | 10+ |
| 15 | Trade The Pool (ações) | menos de 10 | Israel | 4 |
O site diz listar 60+ mesas verificadas; plataformas de futuros citadas no FAQ: Project X, TradingView, NinjaTrader, Tradovate, Rithmic.

## Anexo B — o que ficou sem verificação firme
- Grade da B3 a partir de novembro de 2026 (data e horários).
- Prazo de 30 out 2026 da Resolução BCB 520 e o corte de derivativos da Bybit para brasileiros em 2026 (fonte única).
- Horário exato de reset de Crypto Fund Trader (00:05 UTC) e Breakout (00:30 UTC); regras numéricas de The5ers, CFT, Trade The Pool, Axia.
- Exportação CSV de Avenue, Nomad, Inter, XP Internacional, Mercado Bitcoin, Tryd, corretoras B3; formato Open XML do MT5.
- Se a GTH da Cboe conta para o pregão seguinte; quais corretoras dos EUA aceitam residente no Brasil.
- Valores de emolumentos/registro por contrato na B3.
