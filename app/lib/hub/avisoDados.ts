/**
 * The «Entendi» of the «Dados econômicos» notice, kept on this device (SPEC §3.6, contract §3.8):
 * ONE key per account for both notices, the first wait in «Posso operar hoje?» (Q18) and
 * Personalizar's old-account notice (Q41); dismissing either hides both (c3 §3.9). Not a rule, so
 * never written to the database: in the worst case the notice shows once per device.
 *
 * Storage may be blocked (a private window, cleared site data): a read then says «not dismissed»
 * and a write keeps nothing, never an error (as lib/hub/tema.ts).
 */

/**
 * The day «Dados econômicos» reaches the live database: the day the Phase 5 SQL is pasted. An account whose first
 * rules version took effect before it is «a conta antiga» (c3 §3.9): its rule was saved by the
 * old code, which never checked the data. Both notices read it, through `contaAntigaDesde`: Personalizar's
 * old-account notice (Q41, personalizar/regraDados.contaAntiga) and the first wait's notice in «Posso operar hoje?»
 * (Q18, lib/hub/posso.avisoPrimeiraEspera). Every account the hub creates gets a version on its creation day, so a
 * version count cannot tell an old account from a new one.
 */
export const ENTREGA_DADOS_ECONOMICOS = '2026-11-22';

/** «A conta antiga»: the trading day of its first rules version ('YYYY-MM-DD') falls before the delivery */
export function contaAntigaDesde(desdeDay: string | null | undefined, entrega: string = ENTREGA_DADOS_ECONOMICOS): boolean {
  return !!desdeDay && desdeDay < entrega;
}

/** localStorage key of one account's «Entendi» */
export const entendiKey = (accountId: string): string => `bh.dadosEco.entendi.${accountId}`;

/** Whether the notice of this account was dismissed on this device */
export function entendiLido(accountId: string): boolean {
  try {
    return window.localStorage.getItem(entendiKey(accountId)) === '1';
  } catch {
    return false;
  }
}

/** «Entendi»: hides both notices of this account on this device */
export function marcarEntendi(accountId: string): void {
  try {
    window.localStorage.setItem(entendiKey(accountId), '1');
  } catch {
    // Nothing to do: the screen hides the notice for this visit
  }
}

/**
 * Calls `cb` with the account's «Entendi» whenever another tab of this device changes it (the storage event; a
 * cleared storage too), so an open «Posso operar hoje?» or Personalizar follows without a reload. Returns the stop.
 */
export function ouvirEntendi(accountId: string, cb: (entendi: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const key = entendiKey(accountId);
  const ouvir = (e: StorageEvent) => {
    if (e.key === key || e.key === null) cb(entendiLido(accountId));
  };
  window.addEventListener('storage', ouvir);
  return () => window.removeEventListener('storage', ouvir);
}
