# 8bitworkshop Emulator Setup Guide

## Recent Fixes

### VIC-20 Emulator Fix
**Problem**: The VIC-20 emulator was not working due to an incomplete BIOS file.

**Solution**: Created a proper VIC-20 BIOS by combining the ROM components:
- Character ROM (4096 bytes)
- BASIC ROM (8192 bytes) 
- KERNAL ROM (8192 bytes)

**Files Updated**:
- `res/vic20.bios` - Now contains proper ROM data arranged correctly

**Verification**: The VIC-20 BIOS now starts with character ROM data (visible character patterns at offset 0x0000).

### C64 Emulator Font Fix
**Problem**: The C64 was using open-source ROMs which had different fonts than the original.

**Solution**: Updated the C64 BIOS to use the MEGA65 open-source ROMs which provide better compatibility:
- BASIC ROM (8192 bytes)
- Character ROM (4096 bytes)
- KERNAL ROM (8192 bytes)

**Files Updated**:
- `res/c64.bios` - Now uses proper ROM arrangement

## Adding New WASM/JS Emulators

### Quick Start
Use the provided script to add a new emulator:

```bash
./scripts/add_emulator.sh <platform_name> <emulator_type>
```

Example:
```bash
./scripts/add_emulator.sh zx81 wasm
./scripts/add_emulator.sh spectrum js
```

### Manual Setup

#### 1. Platform Interface (`src/platform/<platform>.ts`)
Create a platform interface that defines:
- Preset examples
- Memory map
- Compilation tools
- ROM handling

```typescript
import { Platform, Base6502MachinePlatform, Preset } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";

const PLATFORM_PRESETS : Preset[] = [
  {id:'hello.c', name:'Hello World (C)'},
  {id:'hello.asm', name:'Hello World (ASM)'},
];

const PLATFORM_MEMORY_MAP = { main:[
  {name:'RAM', start:0x0000, size:0x1000, type:'ram'},
  {name:'ROM', start:0x8000, size:0x2000, type:'rom'},
] }

class PlatformWASMPlatform extends Base6502MachinePlatform<any> implements Platform {
  newMachine() { return new PlatformWASMMachine('platform'); }
  getPresets() { return PLATFORM_PRESETS; }
  getDefaultExtension() { return ".c"; }
  readAddress(a) { return this.machine.readConst(a); }
  getMemoryMap() { return PLATFORM_MEMORY_MAP; }
  showHelp() { return "https://8bitworkshop.com/docs/platforms/platform/" }
  getROMExtension(rom:Uint8Array) { return ".bin"; }
}

PLATFORMS['platform'] = PlatformWASMPlatform;
PLATFORMS['platform.wasm'] = PlatformWASMPlatform;
```

#### 2. Machine Implementation (`src/machine/<platform>.ts`)
Create the emulator integration:

```typescript
import { Machine } from "../common/baseplatform";
import { Probeable, TrapCondition } from "../common/devices";
import { KeyFlags } from "../common/emu";
import { BaseWASMMachine } from "../common/wasmplatform";

export class PlatformWASMMachine extends BaseWASMMachine implements Machine, Probeable {
  numTotalScanlines = 312;
  cpuCyclesPerLine = 63;

  getBIOSLength() { return 0x2000; }

  loadBIOS(srcArray: Uint8Array) {
    super.loadBIOS(srcArray);
  }

  async fetchBIOS() {
    // Load BIOS from res/platform.bios
    let bios = new Uint8Array(8192);
    this.allocateBIOS(bios);
    this.loadBIOS(new Uint8Array(bios));
  }

  reset() {
    super.reset();
    // Clear keyboard
    for (var ch=0; ch<128; ch++) {
      this.setKeyInput(ch, 0, KeyFlags.KeyUp);
    }
    
    // Load ROM if available
    if (this.romptr && this.romlen) {
      this.exports.machine_load_rom(this.sys, this.romptr, this.romlen);
    }
  }

  advanceFrame(trap: TrapCondition) : number {
    var scanline = this.getRasterY();
    var clocks = Math.floor((this.numTotalScanlines - scanline) * 19656 / this.numTotalScanlines);
    var probing = this.probe != null;
    if (probing) this.exports.machine_reset_probe_buffer();
    clocks = super.advanceFrameClock(trap, clocks);
    if (probing) this.copyProbeData();
    return clocks;
  }

  getRasterY() {
    return this.exports.machine_get_raster_line(this.sys);
  }

  getCPUState() {
    this.exports.machine_save_cpu_state(this.sys, this.cpustateptr);
    var s = this.cpustatearr;
    var pc = s[2] + (s[3]<<8);
    return {
      PC:pc, SP:s[9], A:s[6], X:s[7], Y:s[8],
      C:s[10] & 1, Z:s[10] & 2, I:s[10] & 4,
      D:s[10] & 8, V:s[10] & 64, N:s[10] & 128,
      o:this.readConst(pc),
    }
  }

  saveState() {
    this.exports.machine_save_state(this.sys, this.stateptr);
    return {
      c:this.getCPUState(),
      state:this.statearr.slice(0),
      ram:this.statearr.slice(18640, 18640+0x200),
    };
  }

  loadState(state) : void {
    this.statearr.set(state.state);
    this.exports.machine_load_state(this.sys, this.stateptr);
  }

  getVideoParams() {
   return {width:256, height:192, overscan:true, videoFrequency:50, aspect:1.33};
  }

  setKeyInput(key: number, code: number, flags: number): void {
    if (key == 16 || key == 17 || key == 18 || key == 224) return;
    
    if (flags & KeyFlags.KeyDown) {
      this.exports.machine_key_down(this.sys, key);
    } else if (flags & KeyFlags.KeyUp) {
      this.exports.machine_key_up(this.sys, key);
    }
  }
}
```

#### 3. Platform Registration
Add to `src/platform/_index.ts`:
```typescript
case "platform": return import("../platform/platform");
```

#### 4. Required Files
Create these files in the `res/` directory:
- `res/platform.wasm` - Your WASM emulator
- `res/platform.bios` - BIOS/ROM data

#### 5. Compilation Tools (Optional)
Add to `src/worker/platforms.ts` if your platform needs specific compilation tools:
```typescript
'platform': {
  arch: '6502', // or 'z80', '6809', etc.
  define: ['__PLATFORM__'],
  cfgfile: 'platform.cfg',
  libargs: ['platform.lib'],
  acmeargs: ['-f', 'platform'],
},
```

### WASM Emulator Requirements

Your WASM emulator must export these functions:

```c
// Core machine functions
int machine_init(int bios_ptr);
int machine_get_state_size();
int machine_get_controls_state_size();
int machine_get_cpu_state_size();
int machine_get_sample_buffer();
void machine_load_rom(int sys, int rom_ptr, int rom_len);
void machine_save_state(int sys, int state_ptr);
void machine_load_state(int sys, int state_ptr);
void machine_save_cpu_state(int sys, int cpu_state_ptr);
void machine_reset_probe_buffer();

// Execution functions
int machine_exec(int sys, int cycles);
int machine_tick(int sys);
int machine_advance_frame_clock(int sys, int trap, int clocks);

// Input functions
void machine_key_down(int sys, int key);
void machine_key_up(int sys, int key);

// Video functions
int machine_get_raster_line(int sys);
void machine_sync_video(int sys);

// Audio functions
void machine_sync_audio(int sys);

// Memory functions
int malloc(int size);
```

### Testing Your Emulator

1. Build the project:
```bash
npm run build
```

2. Start the development server:
```bash
make tsweb
```

3. Test your platform:
```
http://localhost:8000/?platform=<your_platform>
```

### Example: Adding a ZX81 Emulator

```bash
# Use the script
./scripts/add_emulator.sh zx81 wasm

# Or manually create files
mkdir -p presets/zx81
mkdir -p src/platform
mkdir -p src/machine

# Create example programs
echo '10 PRINT "HELLO ZX81"' > presets/zx81/hello.bas

# Add your WASM emulator
cp your_zx81_emulator.wasm res/zx81.wasm

# Add your ROM
cp your_zx81_rom.bin res/zx81.bios

# Build and test
npm run build
make tsweb
```

### Troubleshooting

#### Common Issues

1. **BIOS not loading**: Check that `res/platform.bios` exists and has correct size
2. **WASM not loading**: Verify `res/platform.wasm` exists and exports required functions
3. **Compilation errors**: Check platform registration in `src/platform/_index.ts`
4. **Memory errors**: Verify memory map matches your emulator's expectations

#### Debug Tips

- Check browser console for JavaScript errors
- Verify WASM exports in browser dev tools
- Test with simple programs first
- Use the existing C64/VIC-20 implementations as reference

### Resources

- [8bitworkshop Architecture](README.md)
- [Base Platform Interface](src/common/baseplatform.ts)
- [WASM Platform Base](src/common/wasmplatform.ts)
- [Existing Platform Examples](src/platform/)
- [Existing Machine Examples](src/machine/) 