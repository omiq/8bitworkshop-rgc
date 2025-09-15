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

## Risks
- Full parity with owlet-editor Monaco mode in CodeMirror may be staged
- Accurate token stream vs ROM tables requires validation on device

## Milestones
M1: Minimal pipeline (tokenize -> run via iframe postMessage)
M2: CodeMirror highlighting + presets
M3: SSD packaging and download
M4: Inline asm support/validation

## TODO
- [ ] Add worker tool: bbcbasic (src/worker/tools/bbcbasic.ts)
- [ ] Register tool in workertools.ts (TOOLS["bbcbasic"])
- [ ] Map tool->mode in src/ide/ui.ts
- [ ] Add CodeMirror mode (src/codemirror/bbcbasic.js)
- [ ] BBC platform: .bas -> bbcbasic, presets, load path
- [ ] Basic presets under presets/bbc/*.bas
- [ ] Optional SSD writer (reuse Acorn DFS logic or minimal writer)
- [ ] Tests for tokenization (sample lines: PRINT, DATA, PROC/FN, asm [])
- [ ] README add dev flow for BBC BASIC
