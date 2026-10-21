import type { Metadata } from 'next'
import '@/styles/hub.css'
// Phase 2: one file per lane, so the screens never edit the same stylesheet
import '@/styles/hub-personalizar.css'
import '@/styles/hub-posso.css'
import '@/styles/hub-regras-conta.css'
// Phase 3: lane A (the Registrar sheet) and lane B (/diario, entry points, Preferências)
import '@/styles/hub-registrar.css'
import '@/styles/hub-operacoes-dia.css'
// Phase 3 · 3-4: lane B's option block («O que você operou?», Tipo/Strike/Vencimento, «Venceu sem valor»)
import '@/styles/hub-registrar-opcao.css'
// Phase 3c: lane C1's partials and stop moves in the Registrar sheet
import '@/styles/hub-registrar-parciais.css'
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
