/**
 * The instruments «Registrar operação» offers in «Buscar ativo / par / moeda» (Phase 3 · 3-4): the
 * approved catalogs of Personalizar (board 2b, `TAB`, revised on CATALOGO_REVISTO), codes only, in
 * the board's order. Searching is lib/hub/registrarAtivos'; what a code computes is the descriptors'
 * (caps.ts, = the database's instrument_specs()).
 *
 * The catalog is revised quarterly. A B3 stock entering or leaving it changes what is computed (a
 * B3 code outside ACOES_B3 takes a typed result), so it needs a migration too: instrument_specs()'s
 * b3 rows are built from the same list, and the parity test compares them.
 *
 * Pure: depends on nothing at run time.
 */

/** When the 2b catalog was approved */
export const CATALOGO_REVISTO = '2026-10-18';

/**
 * Futures (EUA): the board's «Buscar ativo» list (RegistrarOperacao `D.cat.fut`) plus UB of the 2b
 * catalog; each micro next to its full contract. Only the rows of INSTRUMENT_SPEC.futures (MES, ES,
 * MNQ, NQ, MGC, GC, MCL, CL) are computed; the others take a typed result with price stops.
 */
export const FUTUROS_CATALOGO = [
  'MES', 'ES', 'MNQ', 'NQ', 'MGC', 'GC', 'MCL', 'CL', 'SR3', 'ZN', 'ZF', 'ZT', 'TN', 'ZB', 'ZQ', 'NG', 'ZC', 'UB',
] as const;

/** Forex: the 16 pairs (2b order, = RegistrarOperacao `D.cat.fx`) */
export const FOREX_CATALOGO = [
  'EUR/USD', 'USD/JPY', 'USD/CNH', 'GBP/USD', 'AUD/USD', 'USD/CAD', 'USD/CHF', 'USD/HKD', 'USD/SGD', 'USD/MXN', 'USD/INR',
  'EUR/GBP', 'NZD/USD', 'USD/KRW', 'EUR/JPY', 'EUR/CHF',
] as const;

/** Ações (EUA): the 670 stocks and ETFs of the 2b catalog, in its order (SPY first) */
export const ACOES_EUA = [
  'SPY', 'MU', 'NVDA', 'QQQ', 'SNDK', 'AAPL', 'TSLA', 'MSFT', 'SPCX', 'META', 'AMD', 'INTC', 'AMZN', 'GOOGL',
  'SOXL', 'AVGO', 'GOOG', 'IWM', 'PLTR', 'SMH', 'MRVL', 'VOO', 'TSM', 'IVV', 'ORCL', 'SOXX', 'NBIS', 'SKHY',
  'TQQQ', 'LITE', 'AMAT', 'STX', 'BE', 'DELL', 'GLD', 'WDC', 'EWY', 'LQD', 'LRCX', 'HYG', 'LLY', 'DRAM',
  'CRM', 'NFLX', 'SOXS', 'TLT', 'JPM', 'ASML', 'WMT', 'MSTR', 'V', 'CRWV', 'MRNA', 'GEV', 'CAT', 'HOOD',
  'PANW', 'CSCO', 'XOM', 'NOW', 'QCOM', 'BRK.B', 'KLAC', 'APP', 'CRWD', 'SGOV', 'GS', 'BAC', 'COST', 'UNH',
  'SQQQ', 'GDX', 'IBIT', 'IBM', 'XLF', 'COHR', 'TXN', 'JNJ', 'XLE', 'DIA', 'IREN', 'GLW', 'CVX', 'MA',
  'SMCI', 'RSP', 'COIN', 'SNOW', 'ARM', 'XLV', 'BITO', 'VRT', 'XLK', 'CRDO', 'C', 'ADI', 'RKLB', 'ALAB',
  'KO', 'MRK', 'GE', 'EEM', 'XBI', 'CBRS', 'HD', 'BA', 'ADBE', 'UBER', 'MCD', 'BABA', 'SHOP', 'ABBV',
  'SNXX', 'T', 'PG', 'INTU', 'BKNG', 'AAL', 'ANET', 'TMO', 'WFC', 'XLI', 'IGV', 'EFA', 'NU', 'VTI',
  'PEP', 'ISRG', 'MUU', 'TER', 'VZ', 'CRCL', 'HPE', 'AAOI', 'NKE', 'AMGN', 'MS', 'ACN', 'SPYM', 'DDOG',
  'SOFI', 'VLO', 'MPWR', 'APH', 'LIN', 'NET', 'ABT', 'TJX', 'PFE', 'DIS', 'KRE', 'RDDT', 'AXP', 'PATH',
  'DHR', 'IEMG', 'XLU', 'NEE', 'FCX', 'BSX', 'NXPI', 'RTX', 'BIL', 'MELI', 'SLV', 'MPC', 'PM', 'XLP',
  'GILD', 'ETN', 'AGG', 'NOK', 'SCHW', 'QQQM', 'SPOT', 'TMUS', 'CIEN', 'IONQ', 'NEM', 'SPGI', 'DASH', 'IEFA',
  'COP', 'CLS', 'BMNR', 'AZO', 'SYK', 'MCK', 'USO', 'ON', 'EWZ', 'PYPL', 'XLY', 'VCIT', 'ASTS', 'DE',
  'MUB', 'UNP', 'MDT', 'ABNB', 'COF', 'CDNS', 'MDB', 'FTNT', 'CEG', 'TSLL', 'SCHD', 'SNPS', 'MCHP', 'CVS',
  'HON', 'HONA', 'CMCSA', 'IEF', 'SBUX', 'WDAY', 'VEA', 'FIX', 'BLK', 'HWM', 'BMY', 'VTEB', 'WELL', 'PSX',
  'F', 'PWR', 'RCL', 'SLB', 'FXI', 'HL', 'AXTI', 'VST', 'LOW', 'ONDS', 'XLC', 'CDE', 'VRTX', 'LMT',
  'TRV', 'SHW', 'ETHA', 'BND', 'CB', 'HCA', 'VTV', 'EMB', 'HLT', 'ADP', 'TGT', 'PH', 'CVNA', 'CIFR',
  'TEAM', 'CMI', 'KORU', 'ORLY', 'PGR', 'MO', 'CME', 'WULF', 'EQIX', 'XLB', 'ILMN', 'SHEL', 'OKTA', 'REGN',
  'PLD', 'CMG', 'XOP', 'CSX', 'MAR', 'BX', 'NVO', 'GM', 'AZN', 'FERG', 'PDD', 'VUG', 'ICE', 'MARA',
  'ROST', 'STM', 'IYR', 'TTWO', 'PCG', 'MMM', 'DVN', 'TWLO', 'BNY', 'CCL', 'DAL', 'SNDQ', 'EXPE', 'RBLX',
  'GDXJ', 'AXON', 'EWT', 'MDLZ', 'WMB', 'TT', 'UPS', 'SO', 'MTUM', 'LNG', 'AEP', 'DUK', 'SAP', 'AON',
  'MNST', 'JCI', 'FDX', 'ELV', 'LULU', 'URI', 'BKR', 'ZS', 'OXY', 'IWF', 'APLD', 'ADSK', 'AEM', 'SE',
  'FSLR', 'VGT', 'AKAM', 'HUM', 'KWEB', 'EBAY', 'NTAP', 'IJH', 'CI', 'DLR', 'TDG', 'ALL', 'USB', 'AMT',
  'RIVN', 'CAH', 'TEL', 'FIG', 'FANG', 'FLEX', 'MRSH', 'SPXL', 'UAL', 'ALNY', 'WM', 'HPQ', 'NTRA', 'APO',
  'SWKS', 'VXUS', 'DKS', 'NVDL', 'NOC', 'CRH', 'USHY', 'P', 'HBAN', 'IJR', 'HUT', 'EOG', 'FICO', 'CTSH',
  'COR', 'CTAS', 'IAU', 'SMTC', 'TSEM', 'VWO', 'LHX', 'PNC', 'KR', 'KKR', 'CL', 'IWD', 'KHC', 'VEEV',
  'MSI', 'PCAR', 'ZTS', 'KMB', 'KVUE', 'KEYS', 'GD', 'TEM', 'MTZ', 'MKSI', 'XEL', 'RKT', 'OKLO', 'MDY',
  'MTSI', 'CHTR', 'U', 'CARR', 'B', 'ARKK', 'FN', 'HUBS', 'TPR', 'RIOT', 'HIMS', 'EWJ', 'VT', 'IBKR',
  'EMR', 'RVMD', 'BP', 'DXCM', 'O', 'HAL', 'DOCN', 'ACWI', 'GLDM', 'FISV', 'YUM', 'MCO', 'STRL', 'VALE',
  'NSC', 'EQT', 'VCSH', 'ROKU', 'FAST', 'JEPQ', 'BOXX', 'JBL', 'MLM', 'TFC', 'AJG', 'KDP', 'XYZ', 'GIS',
  'ECHO', 'CRS', 'STT', 'QLD', 'MSCI', 'ITW', 'EXC', 'PBR', 'DHI', 'IQV', 'ECL', 'QID', 'MBB', 'ENTG',
  'CASY', 'TTD', 'GH', 'LYV', 'GWW', 'PAYX', 'FPS', 'ODFL', 'NVT', 'KMI', 'EW', 'BURL', 'NUE', 'NVD',
  'VCLT', 'JPST', 'A', 'TRGP', 'IR', 'ROK', 'APD', 'NRG', 'SHV', 'OKE', 'XRT', 'TSCO', 'ATI', 'CPRT',
  'DLTR', 'SHY', 'FITB', 'CNQ', 'JAAA', 'SUNB', 'FOXA', 'VNQ', 'MET', 'AFRM', 'TTMI', 'ASX', 'RSG', 'QBTS',
  'VTR', 'BBY', 'IBB', 'IDXX', 'NDAQ', 'SPDN', 'BDX', 'DT', 'EME', 'SRE', 'ROP', 'VIK', 'CF', 'AME',
  'CBOE', 'VMRK', 'ULTA', 'RMD', 'UTHR', 'RGTI', 'EXE', 'WAT', 'SN', 'RWM', 'SPMO', 'PSA', 'TOST', 'RBRK',
  'ONTO', 'DG', 'ADM', 'ZM', 'SPG', 'JNK', 'CCJ', 'SMR', 'CNC', 'AMP', 'SYY', 'FTAI', 'MP', 'AIG',
  'NVS', 'D', 'SPXS', 'DKNG', 'INSM', 'EIX', 'VMC', 'QXO', 'ETR', 'USFR', 'AWK', 'UMC', 'W', 'UPRO',
  'DPZ', 'ALB', 'VGSH', 'FLUT', 'CHRW', 'ARES', 'TYL', 'VRSK', 'DOW', 'MAGS', 'CFG', 'SU', 'CPNG', 'SITM',
  'MOD', 'OTIS', 'EL', 'TD', 'GEHC', 'CELH', 'JBHT', 'STLD', 'AVAV', 'NCLH', 'CCI', 'CLX', 'MDLN', 'TZA',
  'HSY', 'SPXU', 'WPM', 'CLSK', 'IUSB', 'STZ', 'VGIT', 'SPYG', 'EFX', 'ARGX', 'LEN', 'RF', 'AMKR', 'RY',
  'TNA', 'PINS', 'BIDU', 'QQQI', 'PPL', 'TLN', 'BTI', 'DINO', 'SCHX', 'ACGL', 'ITOT', 'ACWX', 'DRI', 'CNP',
  'AEHR', 'ROIV', 'SYF', 'LYB', 'KEY', 'WEC', 'MTD', 'JOBY', 'WAB', 'PSQ', 'AGNC', 'ONON', 'AU', 'KNX',
  'SCHG', 'MTB', 'FIVE', 'ENB', 'VICI', 'JEPI', 'CDW', 'EAT', 'TECH', 'CMS', 'GRMN', 'RMBS', 'EFV', 'GNRC',
  'HUBB', 'GPN', 'INDA', 'CBRE', 'FIS', 'FDS', 'SH', 'AFL', 'JHX', 'DOV', 'THC', 'DECK', 'UL', 'CRL',
  'SIMO', 'SPCH', 'WSM', 'GOVT', 'XYL', 'OMC', 'FFIV', 'MXL', 'COPX', 'FTI', 'AA', 'ETSY', 'WWD', 'FBTC',
  'USFD', 'LPLA', 'PODD', 'CORZ', 'DGX', 'NXT', 'ED', 'NI', 'VIG', 'LUV', 'IOT', 'TWST',
] as const;

/** Index options only (RegistrarOperacao `D.cat.indices`): searched with the 670 when «Opção» is chosen */
export const INDICES_OPCOES = ['SPX', 'XSP', 'NDX', 'RUT', 'VIX'] as const;

/** Cripto: the 27 coins of the 2b catalog, in its order */
export const CRIPTO_CATALOGO = [
  'BTC', 'ETH', 'XRP', 'SOL', 'ZEC', 'NEAR', 'DOGE', 'BNB', 'SUI', 'HYPE', 'ENA', 'UNI', 'ADA', 'LINK', 'WLD', 'PUMP',
  'TRUMP', 'ONDO', 'PENGU', 'AVAX', 'LTC', 'PEPE', 'TAO', 'AAVE', 'TRX', 'XLM', 'ARB',
] as const;

/** B3 futures, in the board's order (RegistrarOperacao `D.cat.b3`): WIN, WDO, IND, DOL computed; DI1 typed */
export const B3_FUTUROS = ['WIN', 'WDO', 'IND', 'DOL', 'DI1'] as const;

/**
 * The 56 B3 stocks and ETFs of the 2b catalog (53 «Ações · B3» + 3 «ETF · B3»; «56 códigos somam 80% do
 * volume financeiro de 2025»), in its order: computed 1:1 in R$ with up to 4 decimals. Any other B3
 * code takes a typed result.
 */
export const ACOES_B3 = [
  'VALE3', 'PETR4', 'ITUB4', 'BBAS3', 'BBDC4', 'B3SA3', 'EMBJ3', 'ABEV3', 'AXIA3', 'WEGE3', 'PETR3', 'PRIO3', 'SBSP3',
  'BPAC11', 'RENT3', 'MBRF3', 'SUZB3', 'ITSA4', 'EQTL3', 'LREN3', 'RAIL3', 'MGLU3', 'VBBR3', 'RADL3', 'CPLE3', 'BBSE3',
  'HAPV3', 'JBSS32', 'RDOR3', 'GGBR4', 'CSAN3', 'BRAV3', 'VIVT3', 'ENEV3', 'ASAI3', 'CYRE3', 'TIMS3', 'TOTS3', 'CMIG4',
  'ENGI11', 'MOTV3', 'UGPA3', 'NATU3', 'SMFT3', 'BBDC3', 'MULT3', 'PSSA3', 'KLBN11', 'COGN3', 'ALOS3', 'POMO4', 'CSNA3',
  'VIVA3', 'BOVA11', 'SMAL11', 'BOVV11',
] as const;

/**
 * Former B3 codes a search still finds (the 2b catalog's `termos`): the search shows the current
 * code. NEW (on no board as a list; the 2b search already finds them by these words).
 */
export const ALIASES_B3: Readonly<Record<string, (typeof ACOES_B3)[number]>> = Object.freeze({
  ELET3: 'AXIA3',
  EMBR3: 'EMBJ3',
  CCRO3: 'MOTV3',
  JBSS3: 'JBSS32',
  BRFS3: 'MBRF3',
  MRFG3: 'MBRF3',
  NTCO3: 'NATU3',
  CPLE6: 'CPLE3',
});

/** Every market's search list (stocks: the 670; options add INDICES_OPCOES in the search) */
export const CATALOGO = Object.freeze({
  futures: FUTUROS_CATALOGO,
  forex: FOREX_CATALOGO,
  acoes: ACOES_EUA,
  crypto: CRIPTO_CATALOGO,
  b3: Object.freeze([...B3_FUTUROS, ...ACOES_B3]) as readonly string[],
});
