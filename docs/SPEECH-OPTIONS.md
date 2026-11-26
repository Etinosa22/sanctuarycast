# Speech recognition options for SanctuaryCast (researched 2026-11-12)

The question: what is the best offline voice detection for SanctuaryCast, compared with what Pewbeam advertises (direct reference detection plus "semantic search" for quoted or paraphrased verses)?

The constraints decide it:
- fully offline
- Intel i7 5th gen, 8 GB RAM, Windows
- 2–3 s from a spoken reference to the card
- **Nigerian-accented English** with Bible names

## What the research says

### 1. Accent matters more than the model choice
On African-accented English, general-purpose models lose most of their accuracy:

| Test | Whisper large-v3 | Parakeet TDT 0.6B v2 |
| --- | --- | --- |
| LibriSpeech (standard US/UK reading) | about 2% WER | under 4% WER |
| AfriSpeech general African speech | 30–45% | 30–45% |
| Name-heavy speech | over 70% | over 70% |
| AfriSpeech call-centre audio | 24.7% | 20.96% |

- In the call-centre data, a regionally tuned system scored 13.45% ([AfriSpeech-MultiBench](https://arxiv.org/html/2511.14255)).
- A community project fine-tuned Whisper on 13 h of Nigerian-accented speech and cut its errors from 29.4% to 16.4% ([whisper-nigerian-english](https://github.com/TechByChibuzo/whisper-nigerian-english); a single unreviewed project).

**Implication:** whichever engine we pick, the big wins are:
- clean audio (mixer feed, not a room or Bluetooth mic);
- a forgiving reference parser (already built);
- eventually, adapting the model with recordings of this church's own preachers.

### 2. Speech engines that fit an older CPU

| Engine | Size | Accuracy (published) | Speed on CPU | Licence | Fit |
| --- | --- | --- | --- | --- | --- |
| **Whisper base.en** (current) | 60 MB | Weakest of these | ~2.3 s per 5 s chunk on the dev PC | MIT | Works; mishears names (Habakkuk → "have a cut") |
| **Moonshine v2 Small Streaming** | 123M params | 7.84% WER vs 8.59% for Whisper Small (vendor figures) | ~165 ms response on x86 vs ~3.4 s for Whisper Small (vendor figures) | MIT (English models) | Built for live speech: cost grows with audio length instead of padding to 30 s. Native Windows C++ library on ONNX Runtime. |
| **NVIDIA Parakeet TDT 0.6B v2** (int8, via sherpa-onnx) | about 600 MB | ~6% avg WER on the Open ASR leaderboard; slightly better than Whisper large-v3 on African call-centre audio | RTF about 0.05 on a modern i7 (≈1 s per 5 s chunk expected on the 5th-gen i7, unmeasured) | CC-BY-4.0 (commercial use with attribution to NVIDIA) | Best accuracy for its speed; about 1–1.5 GB RAM, tight but possible on 8 GB |
| Whisper small / large-v3-turbo | 190 MB – 1.6 GB | Better than base | Seconds per chunk on an old CPU | MIT | Too slow for live use on the target laptop |

Sources:
- [Moonshine benchmarks and comparison](https://moonshine-voice.readthedocs.io/en/latest/moonshine-vs-whisper/), [Moonshine v2 paper](https://arxiv.org/pdf/2602.12241), [Moonshine licence](https://moonshine-voice.readthedocs.io/en/latest/license/)
- [Parakeet TDT 0.6B v2 model card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2), [sherpa-onnx int8 export](https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8)
- [Parakeet vs Whisper on CPU](https://vidclean.net/blog/parakeet-vs-whisper-cpu-transcription), [ONNX Parakeet CPU timings](https://github.com/groxaxo/parakeet-tdt-0.6b-v3-fastapi-openai)
- [Open ASR Leaderboard](https://github.com/huggingface/open_asr_leaderboard)

Caveats:
- Moonshine's numbers come from its own vendor.
- No source measured any of these on a 5th-gen i7 or on Nigerian church audio.
- The whisper.cpp release we already bundle also ships `parakeet-cli.exe` / `parakeet.dll`; whether that runs Parakeet well on this CPU is unverified.

### 3. Pewbeam-style "semantic search" (paraphrased verses)
- Pewbeam matches meaning, not just words, against about 31,000 indexed verses.
- The offline equivalent is a small text-embedding model:
  - Verses are embedded once at build time.
  - Each transcript chunk is embedded and compared.
- Best fit: **bge-small-en-v1.5**.
  - 33M parameters, ~32 MB quantised, 384-dimension vectors, MIT licence, runs on CPU via ONNX ([bge-small in JavaScript](https://hermes-ai.net/news/xenova-s-bge-small-brings-private-semantic-search-directly-to-javascript/)).
  - Precomputed vectors for the whole KJV are about 12 MB (int8).
  - A search takes milliseconds.
- A scripture-tuned EmbeddingGemma exists but is about 1.2 GB ([embeddinggemma-scripture](https://huggingface.co/dpshade22/embeddinggemma-scripture-v1-onnx)): too heavy for this laptop.
- It would complement, not replace, the current word-order quote matcher: the matcher is exact and cheap, embeddings catch paraphrase ("God loved the world so much he gave his Son").

### 4. Other Pewbeam features worth matching
- **Voice translation switching** ("read that in NLT" changes the shown translation): a small parser addition. It only works for translations the church has imported.
- **Confidence percentages** on cards: easy, since the detector already rates high/medium.
- Pewbeam bundles NIV, NKJV, NLT, AMP, TPT and others. SanctuaryCast cannot (copyright); those come in through the licensed import.

## Recommendation

1. **Measure before switching.** Benchmark Moonshine v2 Small Streaming and Parakeet TDT 0.6B v2 (int8) against the current Whisper base.en:
   - **Audio:**
     - the existing 48-clip test set;
     - Nigerian-accented speech: ideally recordings of this church's preachers, or AfriSpeech test clips for internal testing only (non-commercial licence);
     - a mixer-feed recording if available.
   - **Measure:** references caught, wrong suggestions, seconds per chunk and RAM, **on the target laptop**.
   - **Pick:** Parakeet if the laptop keeps up (likely most accurate); Moonshine if speed wins (lowest latency, smallest).
2. **Add semantic search** with bge-small-en-v1.5 so paraphrased verses are found, with a minimum similarity like Pewbeam's (they filter below 35%).
3. **Add voice translation switching** and confidence percentages.
4. **Later: adapt to the church's voices.** A few hours of the church's own sermons, transcribed, can be used to fine-tune; that gave the largest accuracy gain in the research.

Each download (models, runtimes) needs approval before fetching:
- Moonshine small model plus ONNX Runtime;
- sherpa-onnx Windows binaries plus the Parakeet int8 model (about 650 MB);
- bge-small (about 32 MB) plus an ONNX runtime for Node.
