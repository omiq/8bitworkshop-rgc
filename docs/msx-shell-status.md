## MSX-Shell (Full Emulation) - Status Report

Last updated: 2025-09-15

### Overview
- New platform `msx-shell` integrates an interactive development shell with the existing `MSX1` full emulator to allow assembling and running small programs from within the IDE.
- Shell UI is implemented in `src/platform/msx-shell.ts` and provides commands: `DIR/LS`, `TYPE/CAT`, `DEL/RM`, `COPY/CP`, `REN/MV`, `CD`, `CLS/CLEAR`, `HELP`, `ASM`, `RUN`, `LOAD`, `MEM`, `REG`, `RESET`.
- Assembler: `zmac` (for `.asm`) and `sdcc` (for `.c`) executed via the IDE worker.
- Virtual filesystem stores compiled outputs (e.g., `HELLO.COM`).

### What Works
- Assembling example programs (`hello.asm`) to a small `.COM` binary (41 bytes).
- Manual loading of program bytes into RAM at `0xC000` after configuring MSX slot mapping.
  - Uses `this.machine.slotmask = 0xFC` to map `0xC000-0xFFFF` to RAM.
- Setting CPU PC to `0xC000` and verifying state via `saveState()/loadState()`.
- Stepping Z80 instructions with `advanceInsn()` and intercepting MSX BIOS calls (`CLS 0x00C3`, `POSIT 0x00C6`, `CHPUT 0x00A2`, `CHGET 0x009F`).
- Added clear logging to the right pane for each instruction, CALL targets, BIOS interceptions, and program bounds checks.

### Current Limitations / Issues
- Output display: shell prints diagnostic lines, but program output is simulated rather than rendered on the MSX VDP. The shell intercepts BIOS calls and writes to the shell terminal; it does not draw on the emulated screen.
- Program bounds: the runner halts when PC exits `0xC000 .. 0xC000+size`, which avoids runaway execution but can stop before full return-to-shell semantics are implemented.
- CHPUT handling: interception happens before executing `CALL`. We read register `A` and, for diagnostics, also peek memory at `HL` to validate source characters. This is sufficient for demo logging but not a full MSX console implementation.
- C workflow: C examples compile, but full linkage against BIOS wrappers requires more work (e.g., consistent calling convention, symbols). Current focus shifted back to assembly testing.

### Key Files
- `src/platform/msx-shell.ts`: Shell UI, VFS, build integration, program loader, CPU stepping loop, BIOS interception.
- `src/machine/msx.ts`: MSX memory map and `slotmask`-based slot selection (BIOS/ROM/RAM).
- `presets/msx-shell/hello.asm`: Simple test that calls BIOS (CLS, POSIT, CHPUT, CHGET).

### Important Implementation Details
- Memory mapping (critical):
  - `slotmask` controls which slot is active per 16KB page.
  - Setting `slotmask = 0xFC` maps `0xC000-0xFFFF` to RAM (slot 3), enabling writes via `this.machine.write()`.
- Loader:
  - Writes program bytes to `0xC000 + i`.
  - Sets `PC = 0xC000` and verifies with `saveState()`.
- Runner:
  - Loops with `advanceInsn()`; before stepping, checks if opcode is `CALL` (0xCD) and intercepts known BIOS targets.
  - On handled BIOS, skips the CALL by advancing `PC += 3` and logs.
  - Stops on `RET` (0xC9), HALT, timeout, or leaving program range.

### Known Errors Encountered (now addressed or documented)
- Writes to RAM appearing as zeros: caused by default `slotmask` mapping everything to BIOS ROM. Fixed by setting `slotmask = 0xFC` before writes.
- Infinite loop/red spam: previously continued stepping after leaving program area. Runner now breaks immediately when PC is out of bounds.
- UI confusion: early debug lines were `console.log`-only; now mirrored to the shell output via `addOutput` for visibility.

### Suggested Next Steps (when resuming)
1. Replace BIOS interception with genuine emulated calls (let CALL execute) and capture VDP output, or redirect CHPUT to VDP layer rather than shell text.
2. Implement a small loader ABI for `.COM` programs: define entry, exit, and a small stack setup so programs can `RET` cleanly to the shell.
3. Provide basic runtime shims for C: consistent calling convention wrappers for BIOS, tiny crt0 (stack init, exit), and linker script.
4. Add a memory-safe execution window (guard pages or a trampoline) to avoid accidental jumps into BIOS while still allowing legitimate calls.
5. Provide `INKEY$`/keyboard bridge for CHGET from the shell input (buffering, non-blocking).

### Rollback/Safety
- All changes are isolated to `src/platform/msx-shell.ts` plus presets. No core emulator behavior was modified.
- Switching back to the primary platform(s) or branch is safe; `msx-shell` can be resumed later without impacting other targets.

### TL;DR
`msx-shell` can assemble and step a small program loaded at `0xC000`, intercepting BIOS calls and logging behavior. It doesn’t render on the VDP yet and halts when PC exits the program. The groundwork is in place; next work is wiring I/O to the real MSX subsystems and smoothing program ABI.


