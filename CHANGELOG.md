# Changelog

## 2025-01-15

- UI Improvements:
  - Auto-compile toggle redesigned as a proper switch control with visual feedback
  - Auto-compile OFF status text changed from red to light grey for better readability
  - Manual build button arrow changed to green color
  - Switch maintains fixed size to prevent visual jumping when toggled
- Platform Fixes:
  - Restored missing `res/freedos722.img` file for x86 FreeDOS platform
  - Fixed initial compilation issue when auto-compile is disabled
- SmallerC Compiler Enhancement:
  - Added standard C library headers (stdio.h, stdlib.h, string.h, ctype.h, etc.) to x86 platform
  - Headers automatically populated in `/usr/include` directory during compilation
  - Includes proper function declarations and constants for standard C library functions

## 2025-09-25

- BBC BASIC: Fix Download Program (.ssd) export
  - Source tokenized BASIC from emulator memory slice `PAGE..VARTOP`
  - Read PAGE from `&18/&19`, page-align (`addr & 0xFF00`), try swapped order, fallback to `0x1900`
  - Read VARTOP from `&12/&13`
  - Package via `AcornDFSdisc` with `PROGRAM` (load/exec = PAGE) and `!BOOT` (`CHAIN"PROGRAM"`)
  - Block export if memory extract unavailable to avoid invalid images
- DFS volume title updated (branding) in `AcornDFSdisc`


