import { NextResponse } from 'next/server';
import { denyHubAccess, requireUser } from '@/lib/apiAuth';

/** Tells the hub screens whether the signed-in account may use them (HUB_USERS). */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const denied = denyHubAccess(auth.user);
  if (denied) return denied;

  return NextResponse.json({ access: true }, { headers: { 'Cache-Control': 'no-store' } });
}
