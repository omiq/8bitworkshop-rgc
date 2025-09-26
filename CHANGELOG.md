# Changelog

## 2025-09-25

- BBC BASIC: Fix Download Program (.ssd) export
  - Source tokenized BASIC from emulator memory slice `PAGE..VARTOP`
  - Read PAGE from `&18/&19`, page-align (`addr & 0xFF00`), try swapped order, fallback to `0x1900`
  - Read VARTOP from `&12/&13`
  - Package via `AcornDFSdisc` with `PROGRAM` (load/exec = PAGE) and `!BOOT` (`CHAIN"PROGRAM"`)
  - Block export if memory extract unavailable to avoid invalid images
- DFS volume title updated (branding) in `AcornDFSdisc`


