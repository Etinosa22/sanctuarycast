// Types shared by the main process, preload and renderer. No runtime imports.

export type Background =
  | { kind: 'colour'; colour: string }
  /** file is a name inside the app's backgrounds folder, served as sc-media://bg/<file>. */
  | { kind: 'image'; file: string }
  | { kind: 'video'; file: string }

export type TextPosition = 'top' | 'middle' | 'bottom'
export type TextAlign = 'left' | 'center' | 'right'

/** Sizes are in pixels on a 1920x1080 canvas; outputs scale to their real size. */
export interface Theme {
  fontFamily: string
  fontSize: number
  colour: string
  shadow: boolean
  outline: boolean
  align: TextAlign
  position: TextPosition
  margin: number
}

export type SlideKind = 'song' | 'scripture' | 'announcement'

export interface Slide {
  id: string
  kind: SlideKind
  text: string
  /** Projected under the text, e.g. "John 3:16 (KJV)". Songs usually have none. */
  label?: string
  /** Operator-only tag on thumbnails, e.g. "V1", "C", "3:16". Never projected. */
  section?: string
}

export interface SongSection {
  /** V1, V2, C, C2, B, PC, T */
  label: string
  text: string
}

export interface Song {
  id: string
  title: string
  author: string
  ccli: string
  sections: SongSection[]
  /** Labels in the order they are sung, e.g. V1,C,V2,C,B,C. */
  arrangement: string[]
  updatedAt: number
}

export type SongInput = Omit<Song, 'id' | 'updatedAt'> & { id?: string }

export interface SongSummary {
  id: string
  title: string
  author: string
}

export interface LibraryBackground {
  id: string
  name: string
  background: Background
  /** Starter backgrounds can't be deleted. */
  builtIn: boolean
}

export interface SavedTheme {
  id: string
  name: string
  theme: Theme
  /** Starter themes can't be deleted or overwritten. */
  builtIn: boolean
}

export interface TranslationInfo {
  code: string
  name: string
  /** 'public-domain' (bundled) or 'licensed' (imported by the church). */
  licence: string
  bundled: boolean
  /** Ticked in the Word tab: offered as a quick switch. */
  enabled: boolean
}

export interface TranslationSettings {
  /** Used for searches. Always one of enabled. */
  main: string
  enabled: string[]
}

export interface BibleSearchResult {
  /** Set when the query is a reference like "John 5:10". */
  passage: ServiceItem | null
  /** Keyword matches when the query is words. */
  hits: { ref: string; text: string }[]
  translation: string
}

/** One entry in the running order. */
export interface ServiceItem {
  id: string
  kind: SlideKind
  title: string
  slides: Slide[]
  /** Scripture items: the passage and translation, so it can be re-opened in another translation. */
  scripture?: { ref: string; translation: string }
}

export interface ServiceState {
  rev: number
  title: string
  items: ServiceItem[]
}

export type ServiceAction =
  | { type: 'addItem'; item: ServiceItem; index?: number }
  | { type: 'removeItem'; itemId: string }
  | { type: 'moveItem'; itemId: string; toIndex: number }
  | { type: 'renameService'; title: string }

/** A slide with the look it will be shown with. Preview and Live each hold one. */
export interface Frame {
  slide: Slide
  background: Background
  theme: Theme
}

export interface PresentationState {
  /** Increments on every change; lets windows ignore stale messages. */
  rev: number
  preview: Frame | null
  live: Frame | null
  /** Output shows black. */
  blanked: boolean
  /** Output shows the live background without text. */
  clearText: boolean
  /** Output shows the logo screen. */
  logo: boolean
  /** Default background applied to the next staged slide. */
  background: Background
  /** Default theme applied to the next staged slide. */
  theme: Theme
  /** Epoch ms when the current live slide went up. */
  liveSince: number | null
}

export type MaskName = 'blank' | 'clearText' | 'logo'

export type EngineAction =
  | { type: 'stage'; slide: Slide }
  | { type: 'editPreview'; text: string }
  | { type: 'clearPreview' }
  | { type: 'goLive' }
  | { type: 'clearLive' }
  | { type: 'setBackground'; background: Background }
  | { type: 'setTheme'; theme: Partial<Theme> }
  | { type: 'toggleMask'; mask: MaskName }
  | { type: 'unmask' }

/** What the Main Output window receives: Live only, never Preview. */
export interface OutputView {
  rev: number
  live: Frame | null
  blanked: boolean
  clearText: boolean
  logo: boolean
}

/** What the Stage Display receives: Live, what is lined up next, and timing. */
export interface StageView extends OutputView {
  next: Frame | null
  liveSince: number | null
}

export type WindowRole = 'console' | 'output' | 'stage'

export interface DisplaySummary {
  count: number
  mainOutput: string
  stageOutput: string
}

/** API the preload script exposes to renderers as window.sc. */
export interface ScApi {
  role: WindowRole
  getState(): Promise<PresentationState | OutputView | StageView>
  onState(cb: (state: PresentationState | OutputView | StageView) => void): () => void
  dispatch(action: EngineAction): Promise<void>
  /** Console only. */
  getService(): Promise<ServiceState | null>
  onService(cb: (service: ServiceState) => void): () => void
  dispatchService(action: ServiceAction): Promise<void>
  openStage(): Promise<void>
  reopenOutputs(): Promise<void>
  getDisplays(): Promise<DisplaySummary>
  /** Library calls, console only. */
  bible: {
    /** Searches the main translation, or `translation` if given and installed. */
    search(query: string, translation?: string): Promise<BibleSearchResult>
    translations(): Promise<{ translations: TranslationInfo[]; main: string }>
    setTranslations(settings: TranslationSettings): Promise<{ translations: TranslationInfo[]; main: string }>
    /** Asks for the licence confirmation in the UI first; opens a file picker. */
    importTranslation(input: { code: string; name: string; licenceConfirmed: boolean }): Promise<{ ok: boolean; message: string }>
    removeTranslation(code: string): Promise<void>
  }
  songs: {
    list(filter: string): Promise<SongSummary[]>
    get(id: string): Promise<Song | null>
    save(song: SongInput): Promise<Song>
    remove(id: string): Promise<void>
  }
  backgrounds: {
    list(): Promise<LibraryBackground[]>
    /** Opens a file picker; returns what was added. */
    importFiles(): Promise<LibraryBackground[]>
    addColour(colour: string): Promise<LibraryBackground>
    /** Fails if the background is in Preview or Live. */
    remove(id: string): Promise<{ ok: boolean; reason?: string }>
  }
  themes: {
    list(): Promise<SavedTheme[]>
    save(name: string, theme: Theme): Promise<SavedTheme>
    remove(id: string): Promise<void>
  }
}
