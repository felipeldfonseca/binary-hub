'use client';

import { useEffect, useState } from 'react';

/**
 * The device clock for previews of unsaved rules («Como fica hoje», «Ao salvar: … desde {d}»,
 * window captions, «Regras valem desde hoje, {d}»), redrawn at each turn of `everyMs` (aligned to
 * it, so a minute tick lands on :00) and when the tab becomes visible again (a sleeping device
 * catches up). Phase 2 accepts the device clock for these previews (gate.md §9); what the server
 * says now comes from rules_now.
 *
 * The first value is the clock at mount: render it only in what loads on the client (the rules
 * screens wait for rules_config), so the server's HTML never disagrees with it.
 */
export function useAgora(everyMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const tick = () => setNow(new Date());
    const first = setTimeout(() => {
      tick();
      interval = setInterval(tick, everyMs);
    }, everyMs - (Date.now() % everyMs));
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [everyMs]);

  return now;
}
