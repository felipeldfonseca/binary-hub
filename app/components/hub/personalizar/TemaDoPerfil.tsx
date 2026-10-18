'use client'

import { useEffect, useRef } from 'react'
import { useHubTheme } from '@/components/hub/HubRoot'
import { usePreferences } from '@/hooks/useContas'
import { useMergePreferences } from '@/hooks/useRegras'

/**
 * The theme saved in the profile (contrato §4.11), mounted once by the hub frame inside the
 * sign-in gate:
 * - every change of the theme («Modo escuro», Personalizar › Tema) is merged into
 *   profiles.preferences (merge_preferences: only `theme`); a failure keeps the local choice;
 * - when the preferences first answer, a saved theme different from the current one wins once and
 *   is kept in this browser, unless the theme was already changed on this load (then the local
 *   choice and its merge stand). Later refetches never switch the theme.
 */
export default function TemaDoPerfil() {
  const { theme, adoptTheme, themeChangedThisLoad, registerThemeWriter } = useHubTheme()
  const preferences = usePreferences()
  const { mutate } = useMergePreferences()
  const synced = useRef(false)

  useEffect(() => {
    registerThemeWriter((next) => mutate({ theme: next }))
    return () => registerThemeWriter(null)
  }, [registerThemeWriter, mutate])

  const answered = preferences.isSuccess || preferences.isError
  const saved = preferences.data?.theme
  useEffect(() => {
    if (synced.current || !answered) return
    synced.current = true
    if ((saved === 'claro' || saved === 'escuro') && saved !== theme && !themeChangedThisLoad()) adoptTheme(saved)
  }, [answered, saved, theme, adoptTheme, themeChangedThisLoad])

  return null
}
