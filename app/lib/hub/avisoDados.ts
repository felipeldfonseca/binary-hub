/**
 * The «Entendi» of the «Dados econômicos» notice, kept on this device (SPEC §3.6, contract §3.8):
 * ONE key per account for both notices, the first wait in «Posso operar hoje?» (Q18) and
 * Personalizar's old-account notice (Q41); dismissing either hides both (c3 §3.9). Not a rule, so
 * never written to the database: in the worst case the notice shows once per device.
 *
 * Storage may be blocked (a private window, cleared site data): a read then says «not dismissed»
 * and a write keeps nothing, never an error (as lib/hub/tema.ts).
 */

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
