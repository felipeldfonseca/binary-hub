/**
 * The server's clock on the device (registrar.md §16.5, D15): everything «Registrar operação»
 * shows or prefills (the hour fields, «Vence às …», «Desfazer entrada» «Até 10:22», the switch to
 * «Opção vencida») uses the server's time, never the phone's. Every Registrar answer and rules_now
 * carry "server_now"; the offset is that instant minus the device time the answer arrived, and the
 * server's "now" is then the device clock plus the offset.
 *
 * The answer's own trip is not corrected for (it errs by the request's latency, under a second on
 * any network the owner uses): what the screens need is the minute. Pure: no React.
 */

/** A known offset: server_now − the device time its answer arrived, in ms */
export interface ServerClock {
  offsetMs: number;
  /** Device time (Date.now()) the answer arrived */
  receivedAt: number;
}

/** The offset an answer gives */
export function serverClockOf(serverNow: Date, receivedAt: number = Date.now()): ServerClock {
  return { offsetMs: serverNow.getTime() - receivedAt, receivedAt };
}

/** The later of two offsets (the newest answer wins); either may be missing */
export function newestClock(a: ServerClock | null | undefined, b: ServerClock | null | undefined): ServerClock | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return b.receivedAt > a.receivedAt ? b : a;
}

/** The server's now, from the device clock and an offset (no offset: the device clock) */
export function serverNowFrom(clock: ServerClock | null | undefined, deviceNow: number = Date.now()): Date {
  return new Date(deviceNow + (clock?.offsetMs ?? 0));
}

/**
 * How long until `instant` on the server's clock (≤ 0 when it passed): the wait before the
 * binary's «Opção vencida» or the end of «Desfazer entrada», as a device timer.
 */
export function msUntil(instant: Date, clock: ServerClock | null | undefined, deviceNow: number = Date.now()): number {
  return instant.getTime() - serverNowFrom(clock, deviceNow).getTime();
}
