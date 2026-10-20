'use client';

import { useEffect, useState } from 'react';

/**
 * A clock for what the screens show, redrawn at each turn of `everyMs` (aligned to it, so a minute
 * tick lands on :00 of that clock) and when the tab becomes visible again (a sleeping device
 * catches up).
 *
 * `offsetMs` = 0 (the default) is the device clock, for previews of unsaved rules («Como fica hoje»,
 * «Ao salvar: … desde {d}», window captions, «Regras valem desde hoje, {d}»): Phase 2 accepts the
 * device clock there (gate.md §9). Phase 3's Registrar passes the server's offset (lib/hub/relogio:
 * the last answer's server_now minus the device time it arrived), so its prefilled hours, the
 * binary expiry and «Desfazer entrada» follow the server's clock, never the phone's
 * (registrar.md §16.5, D15). hooks/useRegistrar's useServerNow does that.
 *
 * The first value is the clock at mount: render it only in what loads on the client (the rules
 * screens wait for rules_config, the Registrar for its reads), so the server's HTML never disagrees
 * with it.
 */
export function useAgora(everyMs = 60_000, offsetMs = 0): Date {
  const [now, setNow] = useState(() => new Date(Date.now() + offsetMs));

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      const t = Date.now() + offsetMs;
      setNow((prev) => (prev.getTime() === t ? prev : new Date(t)));
    };
    // A new offset moves the clock at once (at mount it is the same instant: nothing redraws)
    tick();
    const shifted = Date.now() + offsetMs;
    const first = setTimeout(() => {
      tick();
      interval = setInterval(tick, everyMs);
    }, everyMs - (((shifted % everyMs) + everyMs) % everyMs));
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [everyMs, offsetMs]);

  return now;
}
