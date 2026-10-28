// Starter themes that ship with the app. Churches save their own alongside.

import type { SavedTheme, Theme } from '../shared/types'
import { DEFAULT_THEME } from './engine/presentationEngine'

const starter = (id: string, name: string, theme: Partial<Theme>): SavedTheme => ({
  id: `builtin-${id}`,
  name,
  theme: { ...DEFAULT_THEME, ...theme },
  builtIn: true
})

export const STARTER_THEMES: SavedTheme[] = [
  starter('default', 'Default', {}),
  starter('bold-lyrics', 'Bold lyrics', { fontSize: 88, outline: true, shadow: true }),
  starter('scripture-serif', 'Scripture serif', { fontFamily: 'Georgia, Cambria, "Times New Roman", serif', fontSize: 64, align: 'left' }),
  // Leaves the top of the screen clear, e.g. for a camera feed or the preacher.
  starter('lower-third', 'Lower third', { fontSize: 54, position: 'bottom', margin: 64, outline: true })
]
