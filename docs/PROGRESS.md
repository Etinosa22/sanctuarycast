# SanctuaryCast — Progress Log

## Status
Phase 1, Steps 1–8 done. Still open in Phase 1:
- song import from OpenLyrics/EasyWorship/ProPresenter (Step 6)
- per-kind default themes/backgrounds
- packaging with electron-builder

The Phase 1 demo is ready to show the church.

## 2026-11-12 — Audio inputs plugged in and out (e.g. a Behringer interface)
Requested: when an audio interface such as a Behringer is connected, the app should notice it and let the operator choose it.

Built (logic in `src/shared/audioInputs.ts`, pure and tested; UI in `useListening.ts` / `AiPanel.tsx`):
- **New input banner:** when Windows reports a new input, the panel shows "New input connected: Line (UMC202HD 192k) — **Use it**".
- **Unplugged while in use:** listening falls back to the default input with a notice. When the chosen input comes back, it switches back to it automatically ("… is connected again and in use"). A stream that ends (cable pulled) triggers the same check.
- **Remembered by name as well as id:** if Windows gives the interface a new id (another USB port), the saved choice still finds it. Saved as `{ deviceId, label, channel }`; the older id-only setting is read once for compatibility.
- **↻ button** re-scans inputs by hand.
- The list hides Windows' duplicate "Default -" / "Communications -" entries and shows friendly names.
- **Input channel choice** (Inputs 1+2 / Input 1 only / Input 2 only), shown only when the device really delivers two channels (as most audio interfaces do). With the mic or mixer on one input, picking it avoids halving the level by mixing in the empty one.
- The level meter now measures the channel actually being listened to.

### Tests and checks
- 290 unit tests passing (10 new: plug/unplug diffs, Windows default changes ignored, finding the saved input by id or name, channel picking).
- Simulated in the running app (a fake "Line (UMC202HD 192k)" added and removed through Windows' devicechange):
  - Plugging in showed the banner; **Use it** selected and saved it.
  - Unplugging fell back to the default with a notice.
  - Replugging switched back automatically.
- With a mono test input, the channel choice stayed hidden and the meter moved (peak 52%).
- **Not tested with a real Behringer** (none on this PC). Check that the two-input choice appears and the level moves on the input the mic is plugged into.

## 2026-10-29 — Speech accuracy: measured and improved
Reported: "the AI voice recognition isn't picking the word right".

Measured with a test set:
- 12 sermon sentences with harder book names, said by both Windows voices (Zira, David).
- Each in clean form and in a "Bluetooth headset + room noise" form (phone band, about 12 dB SNR): 48 clips.
- Every clip went through the real whisper engine and the real detector.

| Setting | Clean | Headset + noise | Time per clip |
| --- | --- | --- | --- |
| Before (base.en, `-ac 384`) | 19/24 | 15/24 | 2.5 s |
| + Bible-vocabulary `--prompt` | 18/24 | 16/24 | 3.3 s (and it invented wrong books) |
| Parser fixes below, no prompt | **21/24** | **19/24** | 2.5 s |

Changes:
- **Parser understands how whisper writes references:**
  - "Lamentations 3.22" and "First Peter 5.7" (a dot between chapter and verse).
  - Near-miss book spellings: "Hebrew", "Zeppaniah", "Zeffaniah", "Blamentations", "Philippian". The word must be within 1 edit (2 for long names) of exactly one book and be followed by chapter and verse; such matches are medium confidence, so never Auto Live. Ordinary words ("I was generous 3 times") are still ignored.
- **The vocabulary prompt was tried and rejected** (see table); a comment in `whisperSidecar.ts` records why.
- **Cleaner audio:** the capture graph runs at 16 kHz, so Chromium's own resampler converts the microphone audio (falls back to the device rate if refused).
- **Panel:**
  - A warning when a Bluetooth headset is the chosen input: Windows switches headset mics to phone quality.
  - **What it heard** shows the last 12 transcripts with times, so misheard words are visible.
- Noted from the session log: one transcription failed when the engine connection reset (`ECONNRESET`); the engine restarts itself.

Still misheard by the base.en model (the parser can't safely fix these):
- "have a cut" / "have the coach" for **Habakkuk**
- "due to Rn" for Deuteronomy
- "2nds" for Second Thessalonians
- "acclade the Aztees" for Ecclesiastes

**Model comparison** (asked and answered: download base.en full precision, 148 MB, checksum verified; kept in scratch, not bundled):

| Model | Clean | Headset + noise | Median / slowest per clip | Size |
| --- | --- | --- | --- | --- |
| base.en compressed q5_1 (current) | 21/24 | 19/24 | 2.3 s / 7.8 s | 60 MB |
| base.en full precision | 21/24 | 20/24 | 2.0 s / **18.1 s** (a repetition loop) | 148 MB |

- Decision: keep the compressed model. One clip of difference is noise at this sample size, and the full model is 2.5× bigger and had an 18 s stall.
- Parser improved from these transcripts: near-miss spellings may follow "1st/2nd/first/second" and allow 3 edits for 11+ letter names ("2nd Cesalonians" → 2 Thessalonians 3:3).
- small.en (190 MB) was offered and not chosen. It is the remaining lever for names the base model mishears ("have a cut" for Habakkuk) but is about 3× slower. These voices are US English text-to-speech; the church's own speakers and accents need testing with real recordings (the Phase 2 gate).

## 2026-10-28 — Recited verses, Auto Preview and Auto Live
Requested:
- Detect a verse when the preacher recites it without the reference.
- Search for it and show it in Preview for review.
- An option to show found passages on Preview and Live automatically.

Decision (CLAUDE.md updated): three modes.
- **Suggest:** cards only.
- **Auto Preview** (default): passages go to Preview.
- **Auto Live** (off unless turned on, with a confirmation).

Built:
- **Recited-verse matcher** (`src/ai/quotes.ts`, pure):
  - Content words from the transcript feed a full-text search across every ticked translation.
  - Candidates are scored by the longest run of words said in the verse's own order. Light stemming ("believes" = "believeth") and old forms ("you" = "ye/thee", "to" = "unto") are handled.
  - A run of at least 6 words with at least 3 content words is needed, so ordinary speech ("in the name of Jesus we pray amen") doesn't match.
  - High confidence: 8+ words, or 60%+ of the verse.
  - It runs only when no reference was said in that chunk, and sets the chapter context, so a later "verse 17" works.
- **Auto rules** (`src/ai/auto.ts`, pure):
  - Auto Preview never replaces something the operator staged and hasn't sent; in that case you get a card only.
  - Auto Live acts only on a clearly said reference or a high-confidence quote; context-only ("verse six") and medium matches go to Preview.
  - The rules are applied in the main process through the presentation engine, so Live still changes only by Preview → Go Live.
- **Panel:**
  - Suggest / Auto Preview / Auto Live switch, saved in the library; Auto Live is red and asks for confirmation.
  - Cards show "recited", "Put in Preview automatically" and "Sent to Preview and Live automatically".
  - When the detector shows a passage by itself, the slide strip opens it.

### Tests and checks
- 263 unit tests passing, including:
  - 18 quote tests against the real KJV and ASV (8 famous verses, modernised wording, 6 ordinary sentences correctly ignored)
  - 10 auto-rule tests through the real engine
- Checked in the running app with typed sermon text:
  - A recited John 3:16 went to Preview automatically.
  - An operator-staged song was not replaced.
  - Suggest mode gave a card only.
  - Auto Live asked for confirmation: Cancel kept the mode, OK saved it.
  - "Ephesians chapter two verse eight" and a recited Proverbs 3:5 went to Preview and Live.
  - "verse six" went to Preview only.
- Not yet tried with live speech (same code path as typed text, after whisper).

### Open issues
- A quote spanning two verses (e.g. Numbers 6:24–25) picks the verse with the longer match; showing the range would be better.
- Very short verses ("Jesus wept") can't be recognised from words alone; under 6 words is indistinguishable from ordinary speech.
- Paraphrases (e.g. a modern translation that isn't installed) won't match.

## 2026-10-28 — Phase 2: scripture detection from the PC's microphone
Requested: the AI voice detector had never been tested; add a section to choose and check the audio input. Audio comes from this PC's own microphones/inputs (asked and answered).

Decisions (asked and answered):
- Download whisper.cpp b5454 (`whisper-bin-x64.zip`, 8.9 MB) and `ggml-base.en-q5_1.bin` (59.7 MB) and bundle them.
  - Kept out of git (`resources/ai/` in `.gitignore`); `node scripts/fetch-whisper.mjs` downloads them again with SHA-256 checks. The model hash matches Hugging Face's published one.
- Audio source: this PC's microphones and inputs (not system playback, not Windows speech recognition).

Built:
- **Spoken-reference parser** (`src/parser/spoken.ts`, pure):
  - Whisper output: "John 3:16", "Philippians 4-13", "Romans 8, 28", "Romans 828", "1 Corinthians 13 verses 4 to 7".
  - Spoken words: "John three sixteen", "first Corinthians thirteen four", "psalm one hundred and nineteen verse one hundred and five".
  - Context: "verse eight", "go down to verse twelve", and "chapter five verse three" without a book, using the current chapter or the passage on Live.
  - Guards: everyday-word books (Mark, Job, Acts, Numbers…) need "chapter"/"verse" or a colon; a "13 verses 4 to 7" whose book was cut off is ignored.
- **Detector** (`src/ai/detector.ts`, pure):
  - De-duplicates across the overlapping chunks.
  - Holds a reference heard at the very end of a chunk until the next chunk confirms it, so a cut "twenty-eight" can't become 8:20.
  - Collapses whisper's repetition loops.
  - A verse card replaces its chapter card.
- **Speech engine** (`src/ai/whisperSidecar.ts`):
  - `whisper-server` runs as its own process on 127.0.0.1 only (random port), with the model loaded once, so it can't stall slides.
  - Restarts if it crashes; starts only when you press Listen.
  - Settings `-t 4 -ac 384 -mc 0 -sns`, chosen by measurement (see below).
- **Main** (`src/main/ai.ts`):
  - Console-only IPC with validation.
  - One transcription at a time, keeping only the newest audio, so a slow laptop drops old audio instead of falling behind.
  - "Current chapter" follows the scripture on Live.
  - Microphone permission is granted only to the console window, audio only; every other permission request is refused.
- **Console → Scripture suggestions:**
  - Input picker listing the PC's real inputs (remembered), **Test mic** with a level meter, **Listen / Stop**, status pill, and the last thing heard with its transcription time.
  - Cards with "Show in Preview" (never Live) and dismiss.
  - **Test with typed words…** runs the detector on typed sermon text.
- **Capture** (`useListening.ts`): 16 kHz mono, a circular buffer, the last 5 s sent every 2 s, silent chunks skipped, level meter at about 15 fps.
- The installer now ships the engine: `dist\SanctuaryCast-Setup-0.1.0.exe` is 177 MB.

### Measurements (dev PC, 4 threads; re-measure on the target i7 5th gen)
- 15 s of test speech in one go: 14.8 s with the default 30 s window. Far too slow, hence 5 s chunks and a kept-loaded server.
- 5 s chunk on the kept-loaded server: `-ac 384` 2.2–2.5 s; `-ac 256` 1.3–2.0 s but made whisper loop for up to 37 s on repeated phrases, so 384 it is.
- Expected time from a reference being spoken to its card: about 3–5 s on the dev PC (up to 2 s waiting for the next chunk, plus about 2.2 s transcription, plus up to 2 s more if the reference is held for confirmation). **Above the 2–3 s target**, and the target laptop will be slower. To measure in Phase 2 testing: shorter step (1.5 s), the smaller `tiny.en` model, or confirming on punctuation instead of the next chunk.

### Tests and checks
- 235 unit tests passing:
  - spoken parser (whisper formats, number words, context, run-together numbers, false alarms)
  - detector (repeats, edge-of-chunk holding, loops, chapter→verse replacement)
  - WAV encoder
  - **real end to end:** the bundled whisper engine transcribes a recorded "Philippians four thirteen" and the detector suggests Philippians 4:13
- **Fake microphone (the test sermon played in as the mic):**
  - Cards for John 3:16, John 3:18 ("go down to verse 18", from context), Romans 8:28 and 1 Corinthians 13:4–7.
  - "Show in Preview" put John 3:16 in Preview; Live was unchanged.
- **Real microphone on this PC:**
  - Inputs listed: Microphone Array (Realtek), Bluetooth headset (oraimo BoomPop Lite).
  - The level meter moved, and room speech was transcribed at 2–5 s per chunk.
  - The test sermon went to the headset, so the mic never heard a reference. **Still to do: speak references into the real mic and check the cards.**
- Packaged app: the engine starts ("Listening engine ready") and detection works.

### Open issues
- Latency is above target (see above). The Phase 2 gate (90% of references on recorded sermons, measured on the target laptop) is not run yet.
- Detection log (DetectionLog in the spec) and auto mode (admin, off by default) are not built.
- One early test run stopped listening by itself and it did not happen again in three later runs. Watch for it.
- On 1366×768 the right column scrolls slightly to reach Theme/Background.
- Whisper binaries are Windows-only; macOS needs its own build.

## 2026-10-28 — Windows installer
Requested: an executable that can be installed on other computers.

- **Build:** `npm run dist` produces `dist\SanctuaryCast-Setup-0.1.0.exe` (120.8 MB, 64-bit Windows 10/11).
  - The installer wizard lets you choose the install folder, and adds desktop and Start-menu shortcuts.
  - Per-user install, no admin rights needed.
- **Config:** `electron-builder.yml`.
  - Only `out/` (compiled app) and `package.json` go into `app.asar`.
  - `resources/bibles/*.sqlite` (KJV, ASV) ship as `resources\bibles` next to it.
  - React moved to devDependencies (Vite already bundles it), so the app archive went from 8.8 MB to 0.7 MB.
- **Icon:** `build/icon.png` (512×512), rendered from the logo with `npm run icon` (`scripts/make-icon.cjs`).
- **Data:** each computer keeps its own songs, backgrounds, themes and settings in `%APPDATA%\SanctuaryCast`. Uninstalling keeps that data (`deleteAppDataOnUninstall: false`).
- **Not code-signed** (no certificate). Windows SmartScreen will warn on first run: click **More info → Run anyway**. A code-signing certificate would remove the warning.
- **macOS** needs to be built on a Mac (`electron-builder --mac`); not done.
- **Checked in the packaged app:**
  - All windows load from `app.asar`.
  - Both Bibles load from `resources\bibles`; songs and backgrounds load.
  - John 3:16 sent from Preview reached the projector.
  - On a second display at 300% scaling, the projector window was full screen (1280×720 CSS px) with the slide scaled to fit.
- **Not checked:** running the installer itself on this PC (it would install a second copy here). Test it on another PC or a spare Windows account.

## 2026-10-28 — Midnight redesign and background persistence fix
Requested: a more beautiful, modern UI; uploaded images must stay after the app closes.

### Bug: imported backgrounds disappeared
- What happened:
  - After a restart, the library database (`library.sqlite`) had no background rows. Songs saved earlier and the saved themes were also gone, and the starter hymns were re-seeded at 15:59.
  - The image files were still in `%APPDATA%\sanctuarycast\backgrounds`.
  - The library was effectively reset between two app runs.
- Cause: not proven. No database errors in any log. The most likely explanation is that data held in SQLite's write-ahead log was discarded between runs, during a session with many forced app restarts and test scripts also opening the file.
- Fix:
  - Library DB now uses `journal_mode=DELETE` and `synchronous=FULL`: every change is written into the file itself and waits for the disk. Old WAL-mode files are converted on open.
  - **Recovery on every start:** any imported image/video in the backgrounds folder without a library record is re-added ("Recovered image N"). That brought back the two missing uploads; an upload can no longer silently vanish.
  - Deleting a background removes the file first, then the record. If Windows holds the file, the record is kept and the operator is told.
- Tests: journal mode; a child process inserts a background and is hard-killed, and the row survives; orphan recovery (once only, ignores non-media files).
- My two test files from earlier ("Recovered image 3" gradient and "Recovered video 4") were recovered too. Deleting them was blocked, so remove them with × in the Background bar.

### Midnight look (chosen from Midnight / Graphite / Light)
- The neutral palette is re-tinted to navy, and an indigo-violet `accent` is used for selection and actions. **Amber remains reserved for Preview and rose/red for Live.**
- Backdrop: two soft radial glows, no blur filters (cheap on the target laptop's integrated graphics).
- Top bar: logo mark, gradient wordmark, search with icon, restyled results list.
- Left panel: pill tabs with icons; service items with numbered badges, kind tags and a left accent bar on the selected item; pulsing Live dot.
- Preview/Live: cards with PREVIEW/LIVE badges (the Live dot pulses while something is up), glow rings, rounded slides.
- Slide strip: card, rounded thumbnails that lift on hover, LIVE/PREVIEW chips, gradient "Add to service".
- Right panel: section icons, Go Live emerald gradient, active mask buttons glow rose, icon buttons, rounded background swatches with an offset ring.
- Dialogs (song, theme): rounded cards, deep shadow, segmented controls, gradient primary buttons. Status bar has status dots and keycaps.
- Icons are hand-drawn inline SVG (`console/icons.tsx`), so no icon library dependency.
- Custom CSS components live in Tailwind's `components` layer so utility classes can override them (this fixed the search icon overlapping the placeholder).
- Checked at 1920×1080 and 1366×705: console, search dropdown and theme dialog.

## 2026-10-28 — More translations and a translation picker
Requested: other Bible translations, and a section at the bottom of the Word tab to choose translations.

Decisions (asked and answered):
- Bundle **ASV (1901)**, public domain, from scrollmapper/bible_databases `formats/csv/ASV.csv` (4.7 MB download, 7.3 MB built, 31,086 verses). CLAUDE.md updated: public-domain translations may be bundled.
- Picker behaviour: **main + quick switch**. Tick the translations you want; one is main and used for search; each opened passage gets one-click buttons for the ticked ones.

Built:
- `src/main/bible/importBible.ts`: one importer for bundled builds and church imports.
  - Accepts CSV `Book,Chapter,Verse,Text`, with or without a header, or a SanctuaryCast SQLite file.
  - Book names are matched by name ("I Samuel", "Revelation of John") or, for 66 unknown names, by file order.
  - The file is built under a temporary name and only replaces the old one when complete.
- `scripts/build-bible.ts` replaces `build-kjv.mjs`. Run with `node --experimental-strip-types scripts/build-bible.ts <csv> <CODE> "<name>" "<source>"`.
- `BibleLibrary` holds the bundled translations (`resources/bibles`) plus imports in `%APPDATA%\sanctuarycast\bibles`.
  - A bundled code can't be overwritten or removed.
  - Settings `{ main, enabled }` are kept consistent (main always ticked and installed) and saved in `library.sqlite`.
- **Word tab → Translations** (bottom):
  - Tick/untick each translation; **Make main**; **MAIN** badge; × removes an imported translation.
  - The tab heading shows the main translation, and searches use it.
- **+ Import licensed**: code, full name, and a required tick for "The church holds a licence from the publisher to project this translation", then a file picker. The main process enforces the tick too. This is the route for NIV, NLT, NKJV, AMP and TPT.
- **Quick switch** on scripture: KJV | ASV buttons above the slides. The Preview slide is restaged in the new translation at the same position; Live is untouched.
- Scripture items now carry `{ ref, translation }`.
- Right panel fix: the suggestion box shrinks and scrolls on 1366×768 instead of running into Live control.

### Tests and checks
- 171 unit tests passing (14 new), covering:
  - only KJV and ASV bundled; per-translation text
  - ASV complete for every chapter
  - settings normalisation and code validation
  - CSV import (old-style book names, no header, quoted commas), replace and remove, survives restart
  - refusing bundled overwrite and non-Bible files
- Checked in the running app:
  - The panel listed ASV and KJV (main).
  - The John 3:16 ASV button switched Preview to "believeth on him … eternal life (ASV)" with Live unchanged.
  - Make main moved searches to ASV.
  - Unticking hid the switcher.
  - Import was refused without the licence tick or with a bad code.
  - The projector window cannot change translation settings.
- Not automated: the native file picker for imports (the import code behind it is unit-tested).

## 2026-10-28 — Step 8. Keyboard shortcuts
Decision (asked and answered): Space is **send and queue**.

| Key | Does | Touches Live? |
| --- | --- | --- |
| Space | Sends Preview to Live and loads the following slide into Preview. If Preview is empty or already live, only loads the next slide. | Only by sending what Preview already shows |
| Enter (Ctrl+Enter while typing) | Sends Preview to Live | Yes, Preview only |
| B | Blank to black, on/off | Mask only |
| C | Next chorus after the current position (wrapping) into Preview | No |
| 1–9 | Opens that service item and puts its first slide in Preview | No |
| ← → (↑ ↓) | Step Preview back/forward through the open item | No |
| Ctrl+F | Focus the Bible/song search | No |

- Logic is pure (`src/shared/navigation.ts`) and tested through the real engine reducer.
- Keys are ignored while typing in a field or while the song/theme dialog is open.
- Held-down keys don't repeat, except the arrows.
- Space and Enter never also "click" a focused button.
- Reminder strip in the status bar.

### Tests and checks
- 157 unit tests passing (15 new), including:
  - a full V1, C, V2, C, B, C walk with Preview always one slide ahead
  - a check that Live only ever changes to the exact slide Preview held
- Pressed real keys in the running app:
  - 3 opened Amazing Grace in Preview; Space walked V1→V2→V3 and stopped at the end.
  - 6 then C put the chorus in Preview, and Space sent it while queuing V2.
  - The arrows stepped Preview only.
  - Held Space/B, and 9 with 6 items, did nothing.
  - Space typed a space in the search box; shortcuts were off with the theme dialog open.
  - Key press to projector state took **3 ms** on the dev machine.

## 2026-10-28 — Step 7. Theme editor
- **Theme → Preview** row in the right panel: dropdown of starter and saved themes, **Edit…**, and × for a saved theme.
  - The dropdown shows "Custom (unsaved)" when the current look matches no saved theme.
- **Theme editor** dialog, with a large live preview of the Preview slide or a song/scripture sample:
  - font (12 fonts that ship with Windows 10 and/or macOS, so it works offline), size 24–160 px on a 1080p canvas, text colour
  - shadow, outline
  - alignment (left/centre/right), position (top/middle/bottom), safe margin 0–300 px, shown as a dashed guide on the preview
  - **Save for reuse** under a name; saving the same name again replaces that theme
  - **Undo changes**, **Cancel** (restores the starting theme), **Done**
- Every change goes through the engine's `setTheme`, which updates Preview and the default for newly staged slides. **Live is never touched**: send the slide live to show the new look.
- Starter themes (`src/main/themes.ts`): Default, Bold lyrics, Scripture serif, Lower third. They can't be deleted or overwritten.
- Saved themes live in the `themes` table of `library.sqlite`. Validated on save (all fields, ranges) and on load (rows that no longer validate are skipped).

### Tests and checks
- 142 unit tests passing (4 new: theme save/replace/delete, starter themes valid, range checks).
- Checked in the running app:
  - Editing font, size, position and outline changed Preview (110 px, bottom, Georgia, outline) while Live and the projector stayed at 72 px Segoe UI.
  - Save worked; saving as "Default" was refused.
  - Cancel restored the original theme.
  - Picking "Lower third" from the dropdown changed Preview only; Go Live then showed it on the projector.
  - The dialog fits a 1366×768 screen.

## 2026-10-28 — Songs and Word separated, unified search, custom backgrounds
Requested: separate Word and songs; one search bar for Bible references ("John 5:10") and saved song titles; custom backgrounds.

Decisions (asked and answered):
- Left panel has three tabs: **Service** (running order), **Songs** (library), **Word** (Bible).
- KJV text downloaded once from scrollmapper/bible_databases `formats/csv/KJV.csv` (4.7 MB, MIT repo, public-domain text) and built into `resources/bibles/kjv.sqlite` (7.4 MB, 31,102 verses, FTS5). Rebuild with `node scripts/build-kjv.mjs <KJV.csv>`.
- Database is Electron's built-in SQLite (`node:sqlite`), not better-sqlite3. CLAUDE.md updated.

Built:
- **Reference parser** (`src/parser/`, pure TS): 66 books with abbreviations.
  - Formats: "John 5:10", "jn 3 16", "1cor13:4-7", "Psalm 23", "I John 1:9", "First Corinthians 13", "John 3:16-4:2", "Romans 8:28 to 30", "Jude 5".
  - Rejects ambiguous books ("ma") and impossible chapters.
- **Bible** (`src/main/bible/`):
  - Lookup by reference, keyword search (every word required, best match first).
  - Long passages split across slides at verse boundaries, with a slide size worked out from the theme's font size and margins.
  - Superscript verse numbers when a slide holds several verses; each slide carries its own label (e.g. "1 Corinthians 13:4–7 (KJV)").
- **Top search bar** (Ctrl+F) searches both:
  - A reference gives the passage; text matches saved song titles; plain words also search verse text.
  - Arrow keys and Enter pick a result; it opens in the slide strip and its first slide goes to Preview.
- **Songs tab**:
  - Title search, + New song, Edit.
  - **Song editor**: paste lyrics and they auto-split. Headers like "Verse 2", "[Chorus]" or "Bridge:" are recognised, and a stanza pasted twice becomes the chorus.
  - Editable arrangement (V1, C, V2, C…), so the chorus is stored once and shown each time it is sung.
  - Author and CCLI number fields.
- **Word tab**: reference or keyword search, plus "Opened this service" history.
- **Add to service** copies a song or passage into the running order.
- **Library DB** `%APPDATA%\sanctuarycast\library.sqlite` (WAL): songs, sections, arrangements, backgrounds. Seeded once with the two public-domain hymns.
- **Custom backgrounds**:
  - + Image/Video imports JPG, PNG, WebP, MP4 or WebM (400 MB cap), copied into `%APPDATA%\sanctuarycast\backgrounds` under random names.
  - + Colour adds a colour from a picker.
  - × removes a background, but not one that is in Preview or Live.
  - Served only through `sc-media://bg/<uuid>.<ext>`; anything else is refused (path tricks are blocked).
  - Video plays and loops on the projector only; console thumbnails show a still frame to save CPU.
- Library IPC is console-only and validated (song input, colours with no `url()`, media names).

### Tests and checks
- 138 unit tests passing:
  - parser: 27 references accepted, 11 rejected, every alias checked
  - Bible DB against the real KJV file: every chapter present, ranges, clamping, keyword search, operator injection
  - lyrics splitting and round-trip
  - song library and title search
  - background import and protocol safety
- Checked in the running app:
  - Searching "John 5:10" put it in Preview only, with the projector unchanged.
  - Reference, keyword and song-title searches returned the right results.
  - Creating "Blessed Assurance" in the editor detected V1, C, V2 and arrangement V1,C,V2,C; saving, title filtering and Add to service worked.
  - An image background reached Preview, then the projector.
  - A video background played and looped on the projector.
  - A background in use was refused for deletion.
  - The projector window cannot call the library.
- Not automated: the native file picker for + Image/Video and the colour picker (both call the tested import/add paths). Try them by hand.

## 2026-10-28 — Step 4. Operator console layout
- Layout as specified:
  - Top: Bible quick-search box (Ctrl+F). It says search connects in Step 5.
  - Left: service order.
  - Centre: Preview and Live side by side, with the selected item's slides as thumbnails below.
  - Right: scripture suggestion feed (Phase 2 empty state), live controls, background bar.
  - Bottom: status bar with display and output state, "Reopen outputs" and "Open stage display".
- Service order lives in main (`src/main/service/serviceOrder.ts`), like the engine. It is pure, auto-saved to `%APPDATA%\sanctuarycast\service.json`, and validated on IPC and on load. Only the console can see or change it.
  - Items: add, remove, move (drag and drop), rename service.
  - "+ Notice" adds an announcement; a blank line starts a new slide.
  - Items are numbered 1–9 ready for Step 8's jump keys.
  - Red dot marks the item on Live, amber dot the item in Preview.
- First run loads a demo service of public-domain content (`src/main/service/demoService.ts`): Welcome, Holy Holy Holy, Amazing Grace, Psalm 23, John 3:16–17 (KJV).
- After a restart the console opens on the service item that holds the Live slide.
- Slides gained an operator-only `section` tag (V1, C, 3:16) shown on thumbnails, never projected.
- Console window opens maximised on the operator display.
- Persistence is now a generic `JsonStore<T>` used for both engine state and service.

### Tests and checks
- 55 unit tests passing (11 new for the service order and its validation).
- Checked in the running app:
  - Selecting Amazing Grace shows V1–V3 thumbnails.
  - Clicking V2 puts it in Preview only; Enter sends it to the projector.
  - The live dot and LIVE/PREVIEW tags follow.
  - Reorder works.
  - "+ Notice" added a two-slide item.
  - Closing the projector window and pressing "Reopen outputs" brought it back still showing Live.
  - Layout fits a 1366×768 laptop screen.
- Drag-and-drop itself was not automated (it sends the same move action that was tested); try it by hand.

## 2026-10-28 — Steps 1–3

### Step 1. Scaffold
- Electron 45 + electron-vite 6 (Vite 8) + React 19 + TypeScript 7 (strict) + Tailwind 4 + Vitest 5.
- `npm run dev` launches the app. Also: `npm test`, `npm run typecheck`, `npm run build`.
- Windows are sandboxed (`sandbox`, `contextIsolation`, no Node in renderers); renderers talk to main only through `window.sc` (src/preload/index.ts).
- Not installed yet: better-sqlite3 (Step 5), electron-builder (packaging).

### Step 2. Displays and output windows
- `src/main/displays.ts` picks placement; `src/main/windows.ts` creates the windows.
- 1 display: Main Output and Stage Display open as normal windows for testing.
- 2 displays: Main Output full screen on the second display (left-to-right order); stage opens from the console's "Open stage display" button as a window.
- 3+ displays: stage display full screen on the third.
- Plugging or unplugging a projector rebuilds the outputs on the new layout.
- Output windows show without stealing keyboard focus and hide the cursor.

### Step 3. Presentation engine
- `src/main/engine/presentationEngine.ts`: pure reducer, state `{ rev, preview, live, blanked, clearText, logo, background, theme, liveSince }`.
- Preview and Live each hold a Frame (slide + background + theme), so background and theme changes land in Preview and reach Live only on Go Live.
- Main is the only writer. Main works out each window's role from the IPC sender:
  - Main Output receives Live and masks only, never Preview.
  - Stage Display receives Live, the next (Preview) slide and the timer.
  - Only the console may dispatch; actions are validated (`src/main/engine/validate.ts`).
- Auto-save: every change is written to `%APPDATA%\sanctuarycast\session-state.json` (temp file + rename, coalesced per event-loop turn). On launch the app reopens at the last Live slide.
- Temporary demo console (`src/renderer/src/views/ConsoleView.tsx`) with public-domain test slides.

### Tests and checks
- 44 unit tests passing: every engine transition, output/stage views, action validation, crash-recovery hydration, display placement, persistence.
- Checked in the running app:
  - Clicking a slide puts it in Preview only; the projector stays empty.
  - Enter sends it Live; key press to projector state took 19 ms on the dev machine.
  - B blanks and unblanks.
  - Preview edits don't change Live.
  - The output window cannot dispatch.
  - After a force-kill, the app relaunched with the same slide Live.

## Decisions to confirm
- Go Live lifts "Clear text" (new text should be visible) but keeps Blank and Logo on until the operator lifts them.
- Blank and Logo replace each other; Clear text is independent of both.
- Logo screen is a placeholder wordmark until the church supplies a logo.
- After a crash the restored Live slide shows immediately, including any blank or logo that was on.

## Next
- Demo Phase 1 to the church, then measure slide switch and memory on the target i7-5th-gen laptop.
- Spec items not yet built: separate default theme and background for songs, scripture and announcements, and per-item overrides; song import from other programs; installer (electron-builder, shipping `resources/bibles`).
- Phase 2 (AI detection) starts after the Phase 1 demo, per CLAUDE.md.
- Windows installer done (`npm run dist`); macOS build and code signing still to do.

## Open issues
- **KJV source text quality.** The scrollmapper KJV.csv:
  - puts psalm titles inside verse 1 in 115 psalms (Psalm 23:1 reads "A Psalm of David. The Lord is my shepherd…"), and Psalm 119's Hebrew letter headings sit inside its verses;
  - prints "LORD" (small capitals in the printed KJV) as "Lord" almost everywhere (6 LORD vs 6,563 Lord).
  - Automatic stripping is unsafe: Psalm 18's title runs into the verse with no full stop. Fix by importing a better public-domain edition; needs a new download, so ask first.
  - 2026-10-28: church chose to keep the current KJV text for now. Operators can fix a psalm title in Preview before it goes Live.
- ASV has the same source issues as the KJV (psalm titles inside verse 1) and renders God's name as "Jehovah".
- Importing a large licensed file runs in the main process and pauses the app for about a second; do it before the service, not during. A worker thread would remove the pause.
- Parallel view (two translations on one slide) is not built.
- Keyword search uses English stemming, so "amazing" also finds "amazed".
- A Bible passage is split into slides using the text size at the moment it is opened. Making the text much bigger afterwards does not re-split it, so a full slide can overflow. Reopen the passage after changing size.
- One theme applies to everything staged next; per-kind defaults (songs vs scripture) are not built yet.
- Slide strip thumbnails use the default theme, not the slide's own.
- Space stops at the last slide of an item; it does not move on to the next service item (press its number instead).
- The Logo and Clear text masks have buttons but no keys; C is taken by chorus.
- Song sections are one slide each; a very long verse is not split yet.
- Video resolution is not checked on import (spec: 1080p max on the target laptop); only a 400 MB size cap.
- No bundled royalty-free image starter pack yet, only colours and gradients.
- Fade/cut transitions not built yet (spec: set per service).
- Latency measured on the dev machine only; re-measure slide switch on the target i7-5th-gen laptop.
- Editing text in Preview changes only what is staged; it is not saved back to the service item or song. Decide in Step 6 whether edits should offer "save to song".
- Removing a service item has no undo and no confirm; what is on Live stays on screen.
- Double-click on a thumbnail only stages it; going live is double-click on Preview, Enter, or Go Live. Confirm this is wanted.
- Target OS (Windows 10) still to confirm with the church.
- This folder sits inside the Desktop git repository and is untracked there; it has no repository of its own yet.
