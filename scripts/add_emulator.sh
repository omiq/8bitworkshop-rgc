#!/bin/bash

# Script to add new WASM/JS-based emulators to 8bitworkshop
# Usage: ./scripts/add_emulator.sh <platform_name> <emulator_type>

set -e

PLATFORM_NAME=$1
EMULATOR_TYPE=$2

if [ -z "$PLATFORM_NAME" ] || [ -z "$EMULATOR_TYPE" ]; then
    echo "Usage: $0 <platform_name> <emulator_type>"
    echo "Example: $0 zx81 wasm"
    echo "Example: $0 spectrum js"
    exit 1
fi

echo "Adding new emulator: $PLATFORM_NAME ($EMULATOR_TYPE)"

# Create platform directory structure
mkdir -p presets/$PLATFORM_NAME
mkdir -p src/platform
mkdir -p src/machine

# Create basic preset files
cat > presets/$PLATFORM_NAME/hello.c << 'EOF'
#include <stdio.h>

int main() {
    printf("Hello from %s!\n", "$PLATFORM_NAME");
    return 0;
}
EOF

cat > presets/$PLATFORM_NAME/hello.asm << 'EOF'
; Hello World for $PLATFORM_NAME
    .org $1000
start:
    lda #$48    ; 'H'
    jsr putchar
    lda #$65    ; 'e'
    jsr putchar
    lda #$6C    ; 'l'
    jsr putchar
    lda #$6C    ; 'l'
    jsr putchar
    lda #$6F    ; 'o'
    jsr putchar
    lda #$0D    ; CR
    jsr putchar
    rts

putchar:
    ; Platform-specific character output routine
    ; TODO: Implement for $PLATFORM_NAME
    rts
EOF

# Create platform implementation
cat > src/platform/$PLATFORM_NAME.ts << 'EOF'
import { Platform, Base6502MachinePlatform, getToolForFilename_6502, getOpcodeMetadata_6502, Preset } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";

const ${PLATFORM_NAME^^}_PRESETS : Preset[] = [
  {id:'hello.c', name:'Hello World (C)'},
  {id:'hello.asm', name:'Hello World (ASM)'},
];

const ${PLATFORM_NAME^^}_MEMORY_MAP = { main:[
  {name:'RAM',          start:0x0000,size:0x1000,type:'ram'},
  {name:'ROM',          start:0x8000,size:0x2000,type:'rom'},
] }

// WASM $PLATFORM_NAME platform
class ${PLATFORM_NAME^^}WASMPlatform extends Base6502MachinePlatform<any> implements Platform {

  newMachine()          { return new (require("../machine/$PLATFORM_NAME").${PLATFORM_NAME^^}_WASMMachine)('$PLATFORM_NAME'); }

  getPresets()          { return ${PLATFORM_NAME^^}_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.readConst(a); }
  getMemoryMap()        { return ${PLATFORM_NAME^^}_MEMORY_MAP; }
  showHelp()            { return "https://8bitworkshop.com/docs/platforms/$PLATFORM_NAME/" }
  getROMExtension(rom:Uint8Array) { 
    return ".bin";
  }
}

PLATFORMS['$PLATFORM_NAME'] = ${PLATFORM_NAME^^}WASMPlatform;
PLATFORMS['$PLATFORM_NAME.wasm'] = ${PLATFORM_NAME^^}WASMPlatform;
EOF

# Create machine implementation
cat > src/machine/$PLATFORM_NAME.ts << 'EOF'
import { Machine } from "../common/baseplatform";
import { Probeable, TrapCondition } from "../common/devices";
import { KeyFlags } from "../common/emu";
import { BaseWASMMachine } from "../common/wasmplatform";

export class ${PLATFORM_NAME^^}_WASMMachine extends BaseWASMMachine implements Machine, Probeable {

  numTotalScanlines = 312;
  cpuCyclesPerLine = 63;

  getBIOSLength() { return 0x2000; }

  loadBIOS(srcArray: Uint8Array) {
    super.loadBIOS(srcArray);
  }

  async fetchBIOS() {
    // TODO: Implement proper BIOS loading for $PLATFORM_NAME
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

  getRasterCanvasPosition() {
    return {
      x: -1,
      y: this.getRasterY() - 14,
    }
  }

  getCPUState() {
    this.exports.machine_save_cpu_state(this.sys, this.cpustateptr);
    var s = this.cpustatearr;
    var pc = s[2] + (s[3]<<8);
    return {
      PC:pc,
      SP:s[9],
      A:s[6],
      X:s[7],
      Y:s[8],
      C:s[10] & 1,
      Z:s[10] & 2,
      I:s[10] & 4,
      D:s[10] & 8,
      V:s[10] & 64,
      N:s[10] & 128,
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
    if (key == 16 || key == 17 || key == 18 || key == 224) return; // meta keys
    
    if (flags & KeyFlags.KeyDown) {
      this.exports.machine_key_down(this.sys, key);
    } else if (flags & KeyFlags.KeyUp) {
      this.exports.machine_key_up(this.sys, key);
    }
  }
}
EOF

# Update platform index
echo "case \"$PLATFORM_NAME\": return import(\"../platform/$PLATFORM_NAME\");" >> src/platform/_index.ts

# Create placeholder for WASM file
echo "Creating placeholder for $PLATFORM_NAME.wasm..."
echo "# Placeholder for $PLATFORM_NAME WASM emulator" > res/$PLATFORM_NAME.wasm

# Create placeholder for BIOS file
echo "Creating placeholder for $PLATFORM_NAME.bios..."
dd if=/dev/zero of=res/$PLATFORM_NAME.bios bs=1 count=8192 2>/dev/null

echo ""
echo "New emulator '$PLATFORM_NAME' has been added!"
echo ""
echo "Next steps:"
echo "1. Add your WASM emulator file to res/$PLATFORM_NAME.wasm"
echo "2. Add your BIOS file to res/$PLATFORM_NAME.bios"
echo "3. Update src/machine/$PLATFORM_NAME.ts with proper emulator integration"
echo "4. Update src/platform/$PLATFORM_NAME.ts with proper platform configuration"
echo "5. Add compilation tools to src/worker/platforms.ts if needed"
echo "6. Test with: npm run build && make tsweb"
echo ""
echo "Files created:"
echo "- presets/$PLATFORM_NAME/ (example projects)"
echo "- src/platform/$PLATFORM_NAME.ts (platform interface)"
echo "- src/machine/$PLATFORM_NAME.ts (emulator integration)"
echo "- res/$PLATFORM_NAME.wasm (placeholder)"
echo "- res/$PLATFORM_NAME.bios (placeholder)"
EOF 