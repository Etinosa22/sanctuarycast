// One place that turns a reference into a scripture service item, for the
// search box and the AI detector alike.

import { formatReference, type ScriptureRef } from '../../parser/reference'
import type { ServiceItem, Theme, TranslationSettings } from '../../shared/types'
import type { Library } from '../db/library'
import type { BibleLibrary } from './bibleLibrary'
import { passageToItem } from './passage'

export function translationSettings(bibles: BibleLibrary, library: Library): TranslationSettings {
  return bibles.normalise(library.getSetting<TranslationSettings>('bible.translations'))
}

/** null if the translation is missing or the verses don't exist (e.g. John 3:99). */
export function passageItem(bibles: BibleLibrary, code: string, ref: ScriptureRef, theme: Theme): ServiceItem | null {
  const bible = bibles.get(code)
  if (!bible) return null
  const id = `bible-${code}-${formatReference(ref).replace(/\W+/g, '-')}`
  return passageToItem(bible.passage(ref), theme, code, id)
}
