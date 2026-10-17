import HubHeader from './HubHeader'
import ImportSheetProvider from './importar/ImportSheetProvider'
import TemaDoPerfil from './personalizar/TemaDoPerfil'

/** Header and page area shared by every hub screen, and the import sheet any of them can open. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ImportSheetProvider>
      {/* The theme follows the profile (signed in: the shell sits inside the hub's gates) */}
      <TemaDoPerfil />
      <div className="hub-container">
        <a href="#conteudo" className="sr-only focus:not-sr-only hub-skip">
          Pular para o conteúdo
        </a>
        <HubHeader />
        <main id="conteudo">{children}</main>
      </div>
    </ImportSheetProvider>
  )
}
