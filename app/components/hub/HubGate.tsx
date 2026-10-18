'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

type AccessStatus = 'checking' | 'allowed' | 'denied' | 'expired' | 'error'

interface Answer {
  userId: string
  attempt: number
  status: Exclude<AccessStatus, 'checking'>
}

function Bare({ children }: { children: React.ReactNode }) {
  return (
    <div className="hub-container">
      <header className="hub-header">
        <span className="hub-logo" aria-label="Binary Hub">
          <span className="hub-logo__binary">binary</span>
          <span className="hub-logo__hub">hub</span>
        </span>
      </header>
      <main id="conteudo">{children}</main>
    </div>
  )
}

/** Shown while the session or the access check is still loading. */
export function HubLoading() {
  return (
    <Bare>
      <p role="status" className="hub-placeholder">
        Carregando…
      </p>
    </Bare>
  )
}

/**
 * Shows the hub only to accounts listed in HUB_USERS, as the server decides. This hides
 * the screens; every hub endpoint still has to check the list itself.
 */
export default function HubGate({ children }: { children: React.ReactNode }) {
  const { user, session, signOut } = useAuth()
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [attempt, setAttempt] = useState(0)
  // The token is refreshed about every hour; that must not re-run the check and unmount the page
  const tokenRef = useRef(session?.access_token)
  tokenRef.current = session?.access_token
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    const token = tokenRef.current
    if (!token) {
      setAnswer({ userId, attempt, status: 'expired' })
      return
    }

    let cancelled = false
    const settle = (status: Answer['status']) => {
      if (!cancelled) setAnswer({ userId, attempt, status })
    }
    fetch('/api/hub/acesso', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then((response) => {
        if (response.ok) settle('allowed')
        else if (response.status === 403) settle('denied')
        else if (response.status === 401) settle('expired')
        else settle('error')
      })
      .catch(() => settle('error'))
    return () => {
      cancelled = true
    }
  }, [userId, attempt])

  // An answer only counts for the account and the attempt it was given for, so switching
  // accounts never shows the page to the new one, not even for a render
  const status: AccessStatus =
    answer && answer.userId === userId && answer.attempt === attempt ? answer.status : 'checking'

  if (status === 'allowed') return <>{children}</>
  if (status === 'checking') return <HubLoading />

  return (
    <Bare>
      <section className="hub-placeholder" aria-labelledby="acesso-titulo">
        {status === 'denied' && (
          <>
            <h1 id="acesso-titulo">Acesso ainda não liberado</h1>
            <p>As telas novas estão em construção e, por enquanto, abertas só para as contas de teste.</p>
            <Link href="/dashboard" className="hub-button">
              Voltar ao início
            </Link>
          </>
        )}
        {status === 'expired' && (
          <>
            <h1 id="acesso-titulo">Sua sessão expirou</h1>
            <p>Entre de novo para continuar.</p>
            {/* The login page sends a signed-in browser back to the dashboard, so drop the stale session first */}
            <button type="button" className="hub-button" onClick={() => void signOut()}>
              Entrar
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 id="acesso-titulo">Não foi possível verificar seu acesso</h1>
            <p>Confira sua conexão e tente de novo.</p>
            <button type="button" className="hub-button" onClick={() => setAttempt((n) => n + 1)}>
              Tentar de novo
            </button>
          </>
        )}
      </section>
    </Bare>
  )
}
