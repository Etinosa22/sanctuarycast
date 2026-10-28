// Runtime checks for data crossing a trust boundary: actions arriving over IPC
// and state read back from disk after a crash. Pure, no Electron imports.

import type {
  Background,
  EngineAction,
  Frame,
  PresentationState,
  ServiceAction,
  ServiceItem,
  ServiceState,
  Slide,
  SongInput,
  SongSection,
  Theme
} from '../../shared/types'
import { DEFAULT_THEME, initialState } from './presentationEngine'

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Imported media are stored under random UUID names; nothing else is ever served. */
export const isMediaFileName = (v: unknown): v is string =>
  isStr(v) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|mp4|webm)$/.test(v)

/** Hex, rgb() or a linear-gradient of those; nothing that could load a URL. */
export const isSafeColour = (v: unknown): v is string =>
  isStr(v) && v.length <= 200 && /^[#a-z0-9(),.%\s-]+$/i.test(v) && !/url\s*\(/i.test(v)

export function isBackground(v: unknown): v is Background {
  if (!isObj(v)) return false
  if (v.kind === 'colour') return isSafeColour(v.colour)
  if (v.kind === 'image' || v.kind === 'video') return isMediaFileName(v.file)
  return false
}

export function isSongInput(v: unknown): v is SongInput {
  if (!isObj(v)) return false
  if (!isStr(v.title) || !v.title.trim() || v.title.length > 200) return false
  if (!isStr(v.author) || !isStr(v.ccli) || (v.id !== undefined && !isStr(v.id))) return false
  if (!Array.isArray(v.sections) || v.sections.length === 0) return false
  if (!v.sections.every((s) => isObj(s) && isStr(s.label) && /^[A-Z]{1,2}\d*(-\d+)?$/.test(s.label) && isStr(s.text))) return false
  const labels = new Set(v.sections.map((s) => (s as SongSection).label))
  if (labels.size !== v.sections.length) return false
  return Array.isArray(v.arrangement) && v.arrangement.every((a) => isStr(a) && labels.has(a))
}

export function isSlide(v: unknown): v is Slide {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.text) &&
    (v.kind === 'song' || v.kind === 'scripture' || v.kind === 'announcement') &&
    (v.label === undefined || isStr(v.label)) &&
    (v.section === undefined || isStr(v.section))
  )
}

export function isServiceItem(v: unknown): v is ServiceItem {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.title) &&
    (v.kind === 'song' || v.kind === 'scripture' || v.kind === 'announcement') &&
    Array.isArray(v.slides) &&
    v.slides.every(isSlide)
  )
}

export function isServiceAction(v: unknown): v is ServiceAction {
  if (!isObj(v)) return false
  switch (v.type) {
    case 'addItem':
      return isServiceItem(v.item) && (v.index === undefined || isNum(v.index))
    case 'removeItem':
      return isStr(v.itemId)
    case 'moveItem':
      return isStr(v.itemId) && isNum(v.toIndex)
    case 'renameService':
      return isStr(v.title)
    default:
      return false
  }
}

/** Rebuilds the saved running order, dropping any item that doesn't parse. */
export function hydrateService(raw: unknown): ServiceState | null {
  if (!isObj(raw) || !Array.isArray(raw.items)) return null
  return {
    rev: 0,
    title: isStr(raw.title) && raw.title.trim() ? raw.title : 'Sunday Service',
    items: raw.items.filter(isServiceItem)
  }
}

const themeChecks: { [K in keyof Theme]: (v: unknown) => boolean } = {
  fontFamily: isStr,
  fontSize: (v) => isNum(v) && v > 0 && v <= 400,
  colour: isStr,
  shadow: isBool,
  outline: isBool,
  align: (v) => v === 'left' || v === 'center' || v === 'right',
  position: (v) => v === 'top' || v === 'middle' || v === 'bottom',
  margin: (v) => isNum(v) && v >= 0 && v <= 500
}

export function isPartialTheme(v: unknown): v is Partial<Theme> {
  if (!isObj(v)) return false
  return Object.entries(v).every(([k, val]) => k in themeChecks && themeChecks[k as keyof Theme](val))
}

export function isTheme(v: unknown): v is Theme {
  return isPartialTheme(v) && Object.keys(themeChecks).every((k) => k in v)
}

export function isEngineAction(v: unknown): v is EngineAction {
  if (!isObj(v)) return false
  switch (v.type) {
    case 'stage':
      return isSlide(v.slide)
    case 'editPreview':
      return isStr(v.text)
    case 'setBackground':
      return isBackground(v.background)
    case 'setTheme':
      return isPartialTheme(v.theme)
    case 'toggleMask':
      return v.mask === 'blank' || v.mask === 'clearText' || v.mask === 'logo'
    case 'clearPreview':
    case 'goLive':
    case 'clearLive':
    case 'unmask':
      return true
    default:
      return false
  }
}

function toFrame(v: unknown): Frame | null {
  if (!isObj(v) || !isSlide(v.slide) || !isBackground(v.background)) return null
  // Fill any theme fields added since the file was written.
  const theme = isPartialTheme(v.theme) ? { ...DEFAULT_THEME, ...v.theme } : DEFAULT_THEME
  return { slide: v.slide, background: v.background, theme }
}

/**
 * Rebuilds engine state from a saved file. Anything malformed falls back to
 * defaults field by field, so a half-written file never stops the app opening.
 */
export function hydrateState(raw: unknown, now: number): PresentationState {
  const base = initialState()
  if (!isObj(raw)) return base
  const live = toFrame(raw.live)
  return {
    rev: 0,
    preview: toFrame(raw.preview),
    live,
    blanked: isBool(raw.blanked) ? raw.blanked : false,
    clearText: isBool(raw.clearText) ? raw.clearText : false,
    logo: isBool(raw.logo) ? raw.logo : false,
    background: isBackground(raw.background) ? raw.background : base.background,
    theme: isPartialTheme(raw.theme) ? { ...DEFAULT_THEME, ...raw.theme } : base.theme,
    liveSince: live ? now : null
  }
}
