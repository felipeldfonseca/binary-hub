/**
 * The «Entendi» of the «Dados econômicos» notices (contract §3.8): one key per account, shared by
 * Q18 («Posso») and Q41 (Personalizar); blocked storage is never an error.
 */
import { entendiKey, entendiLido, marcarEntendi } from '@/lib/hub/avisoDados';

describe('avisoDados', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  it('one key per account: bh.dadosEco.entendi.<accountId>', () => {
    expect(entendiKey('acc-1')).toBe('bh.dadosEco.entendi.acc-1');
    expect(entendiLido('acc-1')).toBe(false);
    marcarEntendi('acc-1');
    expect(entendiLido('acc-1')).toBe(true);
    expect(window.localStorage.getItem('bh.dadosEco.entendi.acc-1')).toBe('1');
    expect(entendiLido('acc-2')).toBe(false);
  });

  it('storage that throws: not read (the notice shows), and no crash on write', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => marcarEntendi('acc-1')).not.toThrow();
    expect(entendiLido('acc-1')).toBe(false);
  });
});
