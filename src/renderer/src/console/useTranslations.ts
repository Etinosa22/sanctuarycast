import { useCallback, useEffect, useState } from 'react'
import type { TranslationInfo, TranslationSettings } from '../../../shared/types'

export interface Translations {
  list: TranslationInfo[]
  main: string
  /** Codes ticked for quick switching, main included. */
  enabled: string[]
  update: (settings: TranslationSettings) => Promise<void>
  refresh: () => void
}

export function useTranslations(): Translations {
  const [view, setView] = useState<{ translations: TranslationInfo[]; main: string }>({ translations: [], main: 'KJV' })
  const refresh = useCallback(() => void window.sc.bible.translations().then(setView), [])
  useEffect(refresh, [refresh])
  const update = useCallback(async (settings: TranslationSettings) => setView(await window.sc.bible.setTranslations(settings)), [])
  return {
    list: view.translations,
    main: view.main,
    enabled: view.translations.filter((t) => t.enabled).map((t) => t.code),
    update,
    refresh
  }
}
