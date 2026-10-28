# SanctuaryCast — Church Projection Software

Desktop app for a church media team: project song lyrics, Bible verses (multiple translations) and backgrounds, with an AI assistant that listens to the preacher and suggests any scripture they mention.

Full product spec: `docs/SPEC.md`. Read it before starting any phase. If the spec and this file disagree, this file wins (it reflects decisions made after the spec).

## Target machine (design for this, not a fast dev laptop)
- Intel Core i7 5th gen, 8 GB RAM, Windows 10 (OS still to confirm; also build for macOS).
- Must run fully offline. Keep memory low: no local LLM; images as default backgrounds; 1080p video max.
- Speech-to-text: whisper.cpp with the `base.en` model (quantised). Target 2–3 s from spoken reference to suggestion.

## Non-negotiable behaviour
- **Preview and Live.** Nothing reaches the projector until the operator sends it from Preview to Live (Go Live button, Enter, or double-click). Live is read-only; edits happen in Preview.
- **AI never writes to Live.** Detected references land in the suggestion feed, then Preview on approval. Auto mode exists only as an admin setting, off by default.
- **Presentation engine is the single source of truth** for what each output window shows. Output windows only render state they receive.
- Slide switch under 100 ms. Auto-save every change; after a crash, reopen the service at the last Live slide.
- Blank (B), clear text and logo screen work at any moment, even mid-transition.

## Stack
- Electron + TypeScript (strict), React + Tailwind for UI, Vite for the renderer.
- SQLite via Electron's built-in `node:sqlite` (decided 2026-10-28 instead of better-sqlite3: no native module to build), FTS5 for verse and song search.
- AI runs as a separate sidecar process (whisper.cpp) talking to the main process over IPC, so transcription can never freeze slides.
- Reference parser in pure TypeScript with exhaustive unit tests (Vitest).
- electron-builder for Windows (NSIS) and macOS installers.

## Bible translations
- Bundle public-domain translations only: KJV and ASV (1901), built with `scripts/build-bible.ts` (decided 2026-10-28; previously KJV only). Ask before downloading any other.
- Church wants NLT, NIV, TPT, NKJV, AMP too: these are copyrighted. They come in only through the in-app licensed import (Word tab → Translations → Import licensed), which stores them in the church's data folder. Never bundle, download or scrape their text. Use KJV/ASV for all development and tests.

## Project layout (create as you go)
```
src/main/        Electron main process: windows, IPC, presentation engine, DB
src/renderer/    React UI: console, output, stage display, editors
src/ai/          sidecar: audio capture, whisper.cpp wrapper
src/parser/      scripture reference parser (pure TS, no Electron imports)
src/shared/      types shared across processes
resources/bibles/kjv.sqlite
resources/backgrounds/   royalty-free starter images only
tests/
```

## Working rules
- Work phase by phase (see below). Finish, test and demo each step before the next.
- Write tests for the parser and the presentation engine state machine before UI polish.
- Keep a `docs/PROGRESS.md` log: what was built, what's next, open issues.
- Ask before adding any dependency over ~5 MB or any network call.

## Phase 1 — Core presenter (start here)
1. Scaffold Electron + Vite + React + TS + Tailwind; one command `npm run dev`.
2. Detect displays; open a full-screen Main Output window on the second display and a Stage Display window (optional third).
3. Presentation engine: state = { preview, live, blanked, background, theme }; IPC events to all windows.
4. Operator console layout: service order (left), Preview and Live side by side (centre), suggestion feed + background bar (right), Bible search (top).
5. KJV import into SQLite with FTS5; search by reference ("jn 3 16", "1cor13:4-7") and keyword; long passages auto-split at verse boundaries.
6. Song library: paste-in lyrics auto-split into V/C/B sections, arrangement order, song editor.
7. Backgrounds (image, colour, looping MP4) and a theme editor (font, size, colour, shadow, position).
8. Keyboard shortcuts: Space next, Enter go live, B blank, C chorus, 1–9 jump to item.

## Phase 2 — AI detection (after Phase 1 demo)
Parser first (book names, abbreviations, spoken numbers, "verse eight" using current chapter context), then whisper.cpp sidecar, then suggestion cards. Gate: 90% of references caught on recorded sermon audio, measured on the target laptop.
