'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/contexts/LanguageContext'

/** Imports moved to the hub (Phase 1): the old pages send the owner there instead of importing. */
export const IMPORT_HREF = '/diario?importar=1'

export const IMPORT_LABEL = {
  pt: 'Importar no Diário',
  en: 'Import in the Diário',
}

const NOTE = {
  pt: 'A importação agora fica no Diário: escolha a conta, confira a prévia e desfaça se precisar.',
  en: 'Imports now happen in the Diário: pick the account, check the preview and undo if needed.',
}

/** Replaces the Trades page's old CSV upload. */
export default function DiarioImportLink() {
  const { isPortuguese } = useLanguage()
  return (
    <section className="py-10">
      <div className="max-w-2xl mx-auto card text-center">
        <p className="text-gray-300 font-comfortaa mb-6">{isPortuguese ? NOTE.pt : NOTE.en}</p>
        <Link href={IMPORT_HREF} className="btn-primary inline-block">
          {isPortuguese ? IMPORT_LABEL.pt : IMPORT_LABEL.en}
        </Link>
      </div>
    </section>
  )
}
