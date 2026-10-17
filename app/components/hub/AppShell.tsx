import HubHeader from './HubHeader'

/** Header and page area shared by every hub screen. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hub-container">
      <a href="#conteudo" className="sr-only focus:not-sr-only hub-skip">
        Pular para o conteúdo
      </a>
      <HubHeader />
      <main id="conteudo">{children}</main>
    </div>
  )
}
