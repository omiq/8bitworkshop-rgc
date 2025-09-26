# BBC BASIC for BBC Micro - Integration Plan

## Goals
- Add native BBC BASIC support to the BBC Micro platform (.bas).
- Reuse owlet-editor tokenizer and language support.
- Follow C64 BASIC pattern for worker/build and editor integration.

## Scope
- Tokenize and build BBC BASIC into a loadable format for BBC Micro (SSD or memory load).
- Editor syntax highlighting and abbreviations.
- Platform wiring: tool mapping, presets, run/load flow.

## Architecture
1) Worker tool: bbcbasic
   - Implement compile step similar to src/worker/tools/c64basic.ts
   - Use owlet-editor tokens.js for keyword table and rules
   - Output options:
     a) Tokenized BASIC file suitable for BBC Micro memory load
     b) Optional SSD image with program and !BOOT

2) Editor integration
   - Add CodeMirror mode for BBC BASIC (port from owlet Monaco or approximate minimal mode)
   - Map tool -> mode in src/ide/ui.ts ("bbcbasic" -> "bbcbasic")

3) Platform changes (src/platform/bbc.ts)
   - getToolForFilename(): return "bbcbasic" for .bas
   - getPresets(): add BASIC samples
   - loadROM(): support loading BASIC output (PRG/memory or SSD via iframe message)

4) Iframe loading path
   - Prefer postMessage of compiled program to bbc-iframe
   - Support auto-exec (RUN) or !BOOT for SSD

## Detailed Spec
- Tokenizer:
  * Abbreviations (e.g., P. -> PRINT), REM, DATA, FN/PROC, inline 6502 in [ ]
  * Case handling and immediate commands
- Output format:
  * Tokenized lines with line links and terminators
  * Program end markers
  * For SSD: DFS catalog entries with load/exec addresses
- Editor:
  * Syntax categories: keywords, operators, data/directives, asm block, strings, numbers, variables
- Platform UX:
  * New presets: hello.bas, graphics.bas
  * Default extension .bas for BBC Micro
  * Download: .ssd when available

## Features Implemented

### Model Parameter Support
- The `model=` parameter from the main index.html URL is now passed through to the jsbeeb emulator
- This allows users to specify different BBC Micro models (e.g., `?model=master` for BBC Master)
- Works for both BBC BASIC and C programs
- Example: `https://ide.retrogamecoders.com/?platform=bbc&model=master`

### Auto Line Numbering
- BBC BASIC programs automatically get line numbers added if missing
- Starts at line 10 and increments by 10
- Preserves existing line numbers and adjusts the counter accordingly

### Case-Insensitive File Extensions
- `.bas` and `.BAS` files are both recognized as BBC BASIC programs
- Applied across all platforms (BBC, C64, VCS, Atari 8-bit)

### SSD Generation
- Uses the exact `AcornDFSdisc` class for compatibility
- Generates proper SSD disc images with correct catalog structure
- Includes `!BOOT` file for automatic `CHAIN"PROGRAM"`
- Implementation details:
  - Tokenized BASIC is read from the emulator memory, not re-tokenized
  - Start (PAGE) is obtained from `&18/&19` but aligned to page boundary (`addr & 0xFF00`), with fallback swap; default `0x1900`
  - End (VARTOP) is read from `&12/&13`
  - The memory slice `[PAGE..VARTOP)` is saved as `PROGRAM` with load/exec = `PAGE`
  - Volume title updated (e.g., `RETRO`), catalog count and sectors set by `AcornDFSdisc`
  - If memory extract is unavailable, SSD export is blocked to avoid creating invalid images

### Example Presets
- Added BASIC examples under `presets/bbc/` and registered in the BBC platform presets menu:
  - `bbc_hello.bas` – minimal hello world
  - `bbc_labels.bas` – ON...GOTO sections, loops, PROC subroutine
  - `bbc_input.bas` – keyboard input via GET$ and simple movement
  - `bbc_textformat.bas` – MODE 7 colours, TAB alignment, ASCII box rendering
  - `bbc_skeleton.bas` / `skeleton.bbcbasic` – starter template

## Risks
- Full parity with owlet-editor Monaco mode in CodeMirror may be staged
- Accurate token stream vs ROM tables requires validation on device

## Milestones
M1: Minimal pipeline (tokenize -> run via iframe postMessage) ✅
M2: CodeMirror highlighting + presets ✅
M3: SSD packaging and download ✅
M4: Model parameter support ✅
M5: Inline asm support/validation

## TODO
- [x] Add worker tool: bbcbasic (src/worker/tools/bbcbasic.ts)
- [x] Register tool in workertools.ts (TOOLS["bbcbasic"])
- [x] Map tool->mode in src/ide/ui.ts
- [x] Add CodeMirror mode (src/codemirror/basic.js - updated with BBC BASIC keywords)
- [x] BBC platform: .bas -> bbcbasic, presets, load path
- [x] Basic presets under presets/bbc/*.bas
- [x] SSD writer (using AcornDFSdisc class from owlet-editor)
- [x] Auto line numbering for BBC BASIC programs
- [x] Case-insensitive .bas file extension handling
- [x] BBC BASIC skeleton files
- [x] Model parameter support (passing model= from main URL to jsbeeb)
- [x] Persistent storage warning suppression
- [ ] Tests for tokenization (sample lines: PRINT, DATA, PROC/FN, asm [])
- [ ] README add dev flow for BBC BASIC
