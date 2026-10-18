import type { Metadata } from 'next'
import '@/styles/hub.css'
// Phase 2: one file per lane, so the screens never edit the same stylesheet
import '@/styles/hub-personalizar.css'
import '@/styles/hub-posso.css'
import '@/styles/hub-regras-conta.css'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppShell from '@/components/hub/AppShell'
import HubGate, { HubLoading } from '@/components/hub/HubGate'
import HubRoot from '@/components/hub/HubRoot'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * The new screens: signed in, on the HUB_USERS list, in the boards' frame and theme.
 *
 * The session lives in the browser, so the server cannot tell who is asking for a page: what a
 * page renders on the server reaches every visitor, and the gates below only hide it. Private
 * data must come from hub API routes that check the session and HUB_USERS themselves.
 */
export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <HubRoot>
      <ProtectedRoute fallback={<HubLoading />}>
        <HubGate>
          <AppShell>{children}</AppShell>
        </HubGate>
      </ProtectedRoute>
    </HubRoot>
  )
}
