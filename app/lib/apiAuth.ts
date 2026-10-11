import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase';

interface AuthenticatedRequest {
  user: User;
  accessToken: string;
}

function reject(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

/**
 * Resolve the signed-in user from the request's bearer token.
 * Returns the response to send back when there is no valid session.
 *
 *   const auth = await requireUser(request);
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireUser(request: Request): Promise<AuthenticatedRequest | NextResponse> {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return reject(401, 'Unauthorized', 'Sign in to use this endpoint.');
  }
  const accessToken = match[1];

  try {
    // Supabase checks the signature and expiry; the anon key or a forged token yields no user
    const { data, error } = await createServerClient().auth.getUser(accessToken);
    if (error) {
      // Only a 4xx from Supabase says the token is bad. A network failure (status 0),
      // rate limit or 5xx means the check could not be made, which is not the user's fault.
      const status = error.status ?? 0;
      const tokenRejected = status >= 400 && status < 500 && status !== 429;
      if (!tokenRejected) {
        console.error('Could not verify the session:', error);
        return unavailable();
      }
      return reject(401, 'Unauthorized', 'Your session is not valid. Sign in again.');
    }
    if (!data.user) {
      return reject(401, 'Unauthorized', 'Your session is not valid. Sign in again.');
    }
    return { user: data.user, accessToken };
  } catch (error) {
    console.error('Could not verify the session:', error);
    return unavailable();
  }
}

function unavailable() {
  return reject(503, 'Authentication unavailable', 'Could not verify your session. Try again.');
}

/**
 * Endpoints that spend the AI budget are limited to the accounts listed in
 * AI_ALLOWED_USERS (comma-separated emails or user ids). Sign-up is open, so a
 * valid session alone must not be enough; with the list unset nobody is allowed.
 */
export function canUsePaidAi(user: User): boolean {
  const allowed = allowedAiUsers();
  const email = user.email?.toLowerCase();
  return allowed.includes(user.id.toLowerCase()) || (!!email && allowed.includes(email));
}

/** The response to send when the account may not spend the AI budget, or null when it may. */
export function denyPaidAi(user: User): NextResponse | null {
  if (canUsePaidAi(user)) return null;

  if (allowedAiUsers().length === 0) {
    console.warn('AI_ALLOWED_USERS is not set: every request to a paid AI endpoint is refused.');
    return reject(403, 'Forbidden', 'AI access is not configured on this server.');
  }
  return reject(403, 'Forbidden', 'This account is not allowed to use AI features.');
}

function allowedAiUsers(): string[] {
  return (process.env.AI_ALLOWED_USERS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}
