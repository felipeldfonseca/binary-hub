import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { AGENDA_LISTS, fetchBea, newYorkDate, runLoad } from '@/lib/domain/agenda';
import { createServiceClient } from '@/lib/server/supabaseAdmin';

/**
 * The daily agenda load (contract §3.7), called by Vercel's cron once a day (09:00 UTC, `app/vercel.json`) with
 * `Authorization: Bearer <CRON_SECRET>`. The one route that does not call requireUser: it checks only the secret
 * (in constant time), reads no query parameter and no body, and writes the agenda tables with the service role.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '', 'utf8');
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: 'sem_chave' }, { status: 503, headers: NO_STORE });
  }

  const now = new Date();
  const bea = await fetchBea(fetch, newYorkDate(now));
  const client = createServiceClient();
  if (!client) return NextResponse.json({ ok: false, error: 'sem_chave' }, { status: 503, headers: NO_STORE });

  let result;
  try {
    result = await runLoad(client, now, { lists: AGENDA_LISTS, bea });
  } catch {
    // the database's text is never echoed
    return NextResponse.json({ ok: false, error: 'erro' }, { status: 500, headers: NO_STORE });
  }
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 503, headers: NO_STORE });
  }
  return NextResponse.json(
    { ok: true, events: result.events, coverage: result.coverage, missing: result.missing, sources: result.sources },
    { headers: NO_STORE },
  );
}
