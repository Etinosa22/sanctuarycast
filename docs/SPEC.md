# Church Projection Software — Product & Technical Documentation

Oct 24, 2026 · @Etinosa

## Overview

The product is a desktop presentation app that lets a church media team project song lyrics, Bible passages in multiple translations, and custom backgrounds — with an AI assistant that listens to the preacher and queues any scripture they mention within about two seconds.

Today most projection teams type references by hand while the preacher keeps talking, so verses appear late or not at all. This app removes that lag: the operator sees a suggested slide the moment "John 3:16" or "the first chapter of Romans, verse eight" is spoken, and sends it to the screen with one tap.

Working name: **SanctuaryCast** (placeholder). It runs on one operator laptop driving a projector or TV, works fully offline once installed, and is built so one volunteer with no technical training can run a full service.

## Users and roles

Four roles cover a typical church; one person can hold several.

| Role | What they do in the app | Access |
| --- | --- | --- |
| Operator | Runs the live service: sends slides, approves AI scripture suggestions, blanks the screen | Live console |
| Planner | Builds the service order ahead of time: songs, readings, announcements | Service planner |
| Librarian | Adds and edits songs, imports Bible translations, manages backgrounds | Library |
| Admin | Manages users, licences, display setup and AI settings | Everything |

A single-user mode skips login entirely for small churches with one volunteer.

## Core features

Six feature areas make up version 1; the AI scripture detector is the differentiator, the rest match what established tools like EasyWorship and ProPresenter offer.

### 1. Lyrics

- Song library with title, author, CCLI number, key, tags and language (English, Yoruba, Igbo, Hausa, Pidgin and others).
- Paste-in import: paste raw lyrics and the app splits them into Verse, Chorus, Bridge slides automatically.
- Import from OpenLyrics, EasyWorship and ProPresenter exports so churches keep their existing library.
- Arrangement order (V1, C, V2, C, B, C) so a chorus is stored once but shown many times.
- Live controls: next/previous slide, jump to section by letter key (C for chorus), repeat chorus.
- Bilingual slides: show English and a local language on the same slide, one above the other.

### 2. Bible

- Multiple translations installed side by side; switch translation for the current verse with one click.
- Parallel view: two translations on screen together (for example KJV and Yoruba Bible).
- Fast search by reference ("jn 3 16", "1cor13:4-7") or by keyword ("love is patient").
- Long passages split across slides automatically at verse boundaries, sized to the font.
- Verse history for the current service so the operator can re-show an earlier verse instantly.

### 3. Backgrounds and themes

- Still images, looping videos and solid or gradient colours as backgrounds.
- Separate default backgrounds for songs, scripture and announcements.
- Per-song or per-item override, and a quick-swap background bar during the live service.
- Theme editor: font, size, colour, shadow, outline, text position and safe margins, with live preview.
- Bundled starter pack of royalty-free backgrounds; import any JPG, PNG or MP4.

### 4. AI scripture detection

- Listens to the preacher's microphone feed and spots Bible references as they are spoken.
- Shows each detected reference as a suggestion card; the operator approves it to go live, or turns on auto-display.
- Understands spoken forms: "John three sixteen", "the book of First Corinthians chapter thirteen", "verse eight" (continuing the current chapter), and Nigerian-accented English.
- Optional live captions of the sermon for the operator only.

### 5. Service planning and live control

- Service order: drag songs, readings, announcements and media into a running order before Sunday.
- Live console with Preview (staging) and Live (on screen) panes.
- Blank to black, blank to logo, and clear text while keeping the background.
- Stage display: a second output for the pulpit or band showing current and next slide plus a clock.
- Announcements and countdown timer before service starts.

### 6. Preview and Live

Nothing reaches the congregation's screen until the operator sends it from Preview to Live, so mistakes are caught before anyone sees them.

|  | Preview | Live |
| --- | --- | --- |
| What it is | The operator's private staging pane | Exactly what is on the projector right now |
| Who sees it | Operator only | Congregation, and the stage display |
| What lands here | A clicked song slide, a searched verse, a changed background, an approved AI suggestion | Only what the operator sends from Preview |
| Editing | Fix a typo, change translation, swap background without anyone seeing | Locked; changes go through Preview first |
| How to send | Go Live button, Enter key, or double-click | Blank (B), clear text, or logo screen at any time |

- AI scripture suggestions always land in Preview first, never straight on Live, unless the admin turns on auto mode.
- The operator can line up the next verse or song slide in Preview while the current one stays on Live.
- Transition when sending to Live: cut or fade, set per service.
- Live pane shows a small timer of how long the current slide has been up.

## How AI scripture detection works

The detector is a speech-to-text model plus a scripture parser, both running on the operator's laptop, so it works without internet and no sermon audio leaves the church.

&#91;embedded content: AI scripture detection · 4 steps, 1 decision\]

By default every detection waits for the operator's tap; auto mode is an admin setting for churches that trust it after testing.

- **Speech-to-text:** OpenAI's open-source Whisper model, run locally through whisper.cpp. It handles accented English well and can be fine-tuned on recorded sermons from the church.
- **Reference parser:** rules that recognise all 66 book names, abbreviations, spoken numbers ("first Corinthians thirteen four") and local-language book names. It remembers the current book and chapter, so "verse eight" or "go down to verse twelve" resolves correctly.
- **Language-model fallback:** when the rules are unsure ("the passage about the prodigal son"), a small local language model proposes a reference with a confidence score. Version 2 also matches quoted verse text to its reference.
- **Context bias:** references already in the service plan are ranked higher, which cuts false matches.

## System architecture and tech stack

The app is a single desktop program built with Electron, with the AI running as a separate background process so a slow transcription never freezes the slides.

&#91;embedded content: system architecture, 7 components on one laptop\]

The presentation engine is the only part that writes to the screens; the AI can suggest but never takes over the output directly.

| Layer | Technology | Why |
| --- | --- | --- |
| Desktop shell | Electron + TypeScript | One codebase for Windows and macOS; multi-monitor full-screen windows |
| User interface | React + Tailwind CSS | Fast, familiar, easy to restyle |
| Database | SQLite (better-sqlite3) with FTS5 full-text search | No server to install; instant verse and song search |
| Speech-to-text | whisper.cpp (Whisper small or medium model) | Runs offline on CPU; good accuracy on accented English |
| Reference parser | TypeScript rules engine | Predictable, testable, no internet |
| Fallback AI | Small local model via llama.cpp, or an online model where internet is reliable | Handles vague phrasing the rules miss |
| Video backgrounds | HTML5 video with FFmpeg for format conversion | Smooth looping MP4 backgrounds |
| Installer and updates | electron-builder with auto-update | One-click install; silent updates when online |
| Optional livestream output | NDI or a browser-source URL for OBS | Lower-third scripture and lyrics on the stream |

## Screens

The operator works in one live console; everything the congregation sees comes from separate full-screen output windows.

| Screen | Who sees it | Main contents |
| --- | --- | --- |
| Live console | Operator | Service order (left), Preview and Live panes side by side (centre), AI suggestion feed and background bar (right), Bible quick-search box (top) |
| Main output | Congregation (projector or TV) | Background plus current slide text, nothing else |
| Stage display | Preacher and band | Current slide, next slide, clock, service timer, optional message from operator |
| Song editor | Librarian | Lyrics text, auto-split slides, arrangement order, metadata |
| Bible manager | Librarian | Installed translations, import, default and parallel translation settings |
| Theme editor | Librarian | Font, colour, layout, background, live preview |
| Settings | Admin | Displays, audio input, AI mode (suggest or auto), users, licences |

Keyboard shortcuts drive the live console (space = next, B = blank, 1–9 = jump to item) so the operator rarely needs the mouse.

## Data model

All data lives in one local SQLite database, with Bible texts stored as separate read-only files per translation so they can be added or removed cleanly.

| Entity | Key fields | Notes |
| --- | --- | --- |
| Song | id, title, author, ccli\_number, language, tags, default\_theme\_id | One row per song |
| SongSection | song\_id, label (V1, C, B), text, order | Stored once, reused by arrangement |
| Arrangement | song\_id, name, sequence (e.g. V1,C,V2,C,B,C) | A song can have several |
| Translation | code (KJV, NIV, YOR), name, language, licence\_type, file\_path | Licence type drives display rules |
| Verse | translation\_code, book, chapter, verse, text | Indexed for full-text search |
| Background | id, type (image, video, colour), file\_path, thumbnail | Media files kept in app folder |
| Theme | id, font, size, colours, shadow, position, background\_id | Applied per item or by default |
| Service | id, date, title, items | One per service or event |
| ServiceItem | service\_id, type (song, scripture, media, announcement), ref\_id, order, theme\_override | The running order |
| DetectionLog | service\_id, timestamp, transcript\_snippet, reference, confidence, action (shown, dismissed) | Used to tune accuracy |
| User | id, name, role, pin | Optional; off in single-user mode |

## Bible translation and song licensing

Public-domain Bibles can ship with the app free; most modern translations and almost all worship songs need a licence the church already holds or must obtain.

| Content | Status | How the app handles it |
| --- | --- | --- |
| KJV, ASV, WEB, Darby, YLT | Public domain (approximate; confirm per edition) | Bundled with the app |
| NIV, NKJV, ESV, NLT, AMP, TPT, MSG | Copyrighted by their publishers | Not bundled; church imports a licensed copy, or app integrates a licensed Bible API |
| Yoruba, Igbo, Hausa and other Nigerian-language Bibles | Varies by edition; often held by the Bible Society of Nigeria | Confirm rights before bundling; import supported |
| Worship songs | Copyrighted; projection usually covered by a CCLI Church Copyright Licence | App stores CCLI song numbers and can produce a usage report for CCLI returns |
| Backgrounds | Starter pack must be royalty-free | Only ship media with a clear free-use licence |

The app enforces nothing on its own lyrics library: the church types or imports the songs it has the right to project. Licensing status above is from general knowledge, not a fresh check, and should be confirmed with each publisher before launch.

## Non-functional requirements

The app must keep working through power cuts, poor internet and modest laptops, because those are normal conditions for many churches.

| Requirement | Target |
| --- | --- |
| Offline operation | Every feature, including AI detection, works with no internet after install |
| Scripture detection latency | Reference spoken to suggestion card in under 2 seconds |
| Detection accuracy | At least 90% of spoken references caught; under 1 false suggestion per 10 minutes |
| Slide switch time | Under 100 ms from key press to screen |
| Minimum hardware | Windows 10/11 or macOS 12+, 8 GB RAM, Intel i5 (8th gen) or Apple M1, two display outputs |
| Recommended for AI | 16 GB RAM; a GPU is optional, not required |
| Crash safety | Auto-save every change; on restart, reopen the live service at the last slide |
| Display | 1080p and 4K output, 16:9 and 4:3, any number of outputs the laptop supports |
| Audio input | Any USB or line-in source, including a feed from the church mixer |
| Privacy | Sermon audio is processed on the laptop and never uploaded; transcripts deleted after the service unless saved |

## Delivery roadmap

The build runs in four phases, and the AI only goes live in church after it passes an accuracy test on recorded sermons.

&#91;embedded content: delivery roadmap, 4 phases and 2 gates\]

Durations are estimates for one developer working with an AI coding assistant; a clickable web prototype of the live console and verse detection can come first, within a few days, to show the church before full development.

## Risks and mitigations

The biggest risk is the AI putting the wrong verse on screen mid-sermon, so version 1 keeps a human approving every suggestion by default.

| Risk | Mitigation |
| --- | --- |
| Wrong verse shown | Suggest-only mode by default; auto-display only above a high confidence threshold and only if the admin turns it on |
| Poor audio (echo, music under preaching, generator noise) | Take the feed straight from the mixer, not a room mic; noise suppression before transcription |
| Accents and code-switching between English and local languages | Test with recorded sermons from the church; add local book-name spellings and pronunciations to the matcher |
| Preacher paraphrases without a reference ("as Jesus said, love your neighbour") | Version 2 adds quote matching against verse text; version 1 handles explicit references only |
| Laptop too slow for local AI | Smaller speech model option; optional cloud mode for churches with stable internet |
| Translation licensing | Ship public-domain texts only; licensed texts imported by the church (see licensing section) |
| Operator unfamiliar with software | One-screen console, large buttons, a 10-minute training video and a rehearsal mode |

## This church's setup

The church's laptop (Intel Core i7 5th generation, 8 GB RAM) will run the presenter smoothly, but it is below the recommended spec for local AI, so the detector uses a lighter design on this machine.

| Area | Impact on this laptop | Adjustment |
| --- | --- | --- |
| Speech-to-text speed | The 2015-era processor has no modern AI acceleration; the Whisper small model would lag several seconds behind the preacher | Use the lighter Whisper base.en model, compressed; target 2 to 3 seconds and measure on this exact laptop in phase 2 |
| Accuracy | Lighter models mishear more, especially with accents and music underneath | Clean mixer feed, stronger rules in the parser, and the operator approves every suggestion (no auto mode) |
| Local AI fallback | 8 GB RAM cannot hold a local language model alongside the app | No local model; rules only when offline, optional online fallback when internet is available |
| Online option | Cloud speech-to-text is more accurate than any model this laptop can run | Offer it as a setting for services with stable internet; costs mobile data |
| Operating system | 5th-generation chips are not supported by Windows 11, and Windows 10 support ended in October 2025 | Build supports Windows 10; keep the laptop for projection only |
| Memory pressure | App, AI and video backgrounds together are tight in 8 GB | Default to image backgrounds; 1080p video only; close other apps during service |
| Upgrade path | Full experience needs more power | An SSD and 16 GB RAM upgrade if the laptop allows, or a newer laptop (8th gen i5 or later, 16 GB) |

### Bible translations requested

The church wants six translations; only KJV can ship free, and the other five need permission from their publishers before the app can display them.

| Translation | Rights holder (approximate; confirm) | Status for the app |
| --- | --- | --- |
| KJV | Public domain (outside the UK) | Bundled, ready on day one |
| NIV | Biblica | Licence needed |
| NLT | Tyndale House | Licence needed |
| NKJV | Thomas Nelson (HarperCollins) | Licence needed |
| AMP | The Lockman Foundation | Licence needed |
| TPT | BroadStreet Publishing | Licence needed |

Verse texts cannot be copied out of another projection program's Bible modules, since those licences cover that software only. The practical routes are a church licence from each publisher, or a licensed Bible API that carries these versions (online only). Which route works for each translation should be confirmed in phase 1.

## Open questions for the church

These answers shape the build and should be settled before development starts.

- [ ] Which operating system does the projection laptop run, and what are its RAM and processor? Answer: Core i7 5th gen, 8 GB RAM; operating system still to confirm.
- [ ] Which Bible translations must be available on day one, including local languages? Answer: KJV, NLT, NIV, TPT, NKJV, AMP; local languages still to confirm.
- [ ] Does the church hold a CCLI licence or other song licence?
- [ ] Is there a mixer output we can use for the preacher's audio?
- [ ] Should the AI only suggest, or also auto-display verses?
- [ ] Is there an existing song library (EasyWorship, ProPresenter, Word files) to import?
- [ ] How many screens: main projector only, or also stage display and overflow rooms or a livestream overlay?
- [ ] Is this for one church, or a product to sell to many churches?
