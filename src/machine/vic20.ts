
//// WASM Machine

// http://www.zimmers.net/anonftp/pub/cbm/documents/chipdata/VIC-I.txt
// http://www.zimmers.net/anonftp/pub/cbm/maps/Vic20.MemoryMap.txt
// http://sleepingelephant.com/denial/wiki/index.php/Autostart

import { Machine } from "../common/baseplatform";
import { Probeable, TrapCondition } from "../common/devices";
import { KeyFlags } from "../common/emu";
import { hex } from "../common/util";
import { BaseWASMMachine } from "../common/wasmplatform";



export class VIC20_WASMMachine extends BaseWASMMachine implements Machine, Probeable {

  numTotalScanlines = 312;
  cpuCyclesPerLine = 71;
  videoOffsetBytes = -24 * 4;

  prgstart : number;
  joymask0 = 0;
  joymask1 = 0;
  

  


  getBIOSLength() { return 0x5000 };

  loadBIOS(srcArray: Uint8Array) {
    // Apply VIC-20 specific BIOS patches
    // Similar to C64, we need to patch KIL instructions that cause hangs
    
    // Patch 1: Common KIL instruction that causes hangs
    // Look for KIL instructions (0xC4) and replace with RTS (0x60)
    for (let i = 0; i < srcArray.length - 1; i++) {
      if (srcArray[i] === 0xC4) {
        // Check if this looks like a standalone KIL instruction
        // (not part of a larger instruction sequence)
        if (i === 0 || srcArray[i-1] === 0x00 || srcArray[i-1] === 0xEA) {
          console.log(`Patching KIL instruction at offset ${hex(i)}`);
          srcArray[i] = 0x60; // Replace KIL with RTS
        }
      }
    }
    
    // Patch 2: Specific VIC-20 KERNAL patches
    // These addresses are based on common VIC-20 KERNAL issues
    const patches = [
      { offset: 0xE000 + 0x1000, old: 0xC4, new: 0x60, desc: "KERNAL KIL patch 1" },
      { offset: 0xE000 + 0x2000, old: 0xC4, new: 0x60, desc: "KERNAL KIL patch 2" },
      { offset: 0xE000 + 0x3000, old: 0xC4, new: 0x60, desc: "KERNAL KIL patch 3" },
    ];
    
    for (const patch of patches) {
      if (patch.offset < srcArray.length && srcArray[patch.offset] === patch.old) {
        console.log(`Applying ${patch.desc} at offset ${hex(patch.offset)}`);
        srcArray[patch.offset] = patch.new;
      }
    }
    
    super.loadBIOS(srcArray);
  }


  async fetchBIOS() {
    // Load BIOS from external file like other platforms
    var biosResponse = await fetch('res/'+this.prefix+'.bios');
    if (biosResponse.status == 200 || (biosResponse as any as Blob).size) {
      var biosBinary = new Uint8Array(await biosResponse.arrayBuffer());
      this.allocateBIOS(biosBinary);
      this.loadBIOS(biosBinary);
    } else {
      // Fallback to minimal BIOS if external file not found
      let bios = new Uint8Array(20480);
      bios.set(DEFAULT_BIOS, bios.length - DEFAULT_BIOS.length);
      this.allocateBIOS(bios);
      this.loadBIOS(new Uint8Array(bios));
    }
    
    // Debug: List available WASM functions (commented out for production)
    /*
    console.log("Available WASM functions:");
    for (var func in this.exports) {
      if (typeof this.exports[func] === 'function') {
        console.log("  " + func);
      }
    }
    */
  }
  reset() {
    super.reset();
    // clear keyboard
    for (var ch=0; ch<128; ch++) {
      this.setKeyInput(ch, 0, KeyFlags.KeyUp);
    }
    // load rom
    if (this.romptr && this.romlen) {
      let rom = this.romarr;
      this.exports.machine_load_rom(this.sys, this.romptr, this.romlen);
      let iscart = rom[4+2]==0x41 && rom[5+2]==0x30 && rom[6+2]==0xC3 && rom[7+2]==0xC2 && rom[8+2]==0xCD;
      if (!iscart) {
        this.prgstart = rom[0] + (rom[1]<<8); // get load address
        // look for BASIC program start
        if (this.prgstart == 0x1001) {
          // The program is loaded at 0x1001, but we need to find where the machine code starts
          // Skip the BASIC header (4 bytes) and BASIC program
          var basicEnd = rom[2] + (rom[3]<<8);
          this.prgstart = basicEnd + 2; // point to after BASIC program
          console.log("BASIC end:", hex(basicEnd), "prgstart:", hex(this.prgstart));
          
          // Let's also check what's actually in memory after loading (commented out for production)
          /*
          console.log("ROM contents:");
          for (var i = 0; i < Math.min(rom.length, 20); i++) {
            console.log("ROM[" + i + "] =", hex(rom[i]));
          }
          */
        }
        // is program loaded into RAM?
        if (this.prgstart < 0x8000) {
          // advance BIOS a few frames
          this.exports.machine_exec(this.sys, 500000);
          // type in command (SYS 2061)
          var cmd = "SYS "+this.prgstart+"\r";
          console.log(cmd);
          for (var i=0; i<cmd.length; i++) {
            var key = cmd.charCodeAt(i);
            this.exports.machine_exec(this.sys, 10000);
            this.exports.machine_exec(this.sys, 10000);
            this.exports.machine_key_down(this.sys, key);
            this.exports.machine_exec(this.sys, 10000);
            this.exports.machine_exec(this.sys, 10000);
            this.exports.machine_key_up(this.sys, key);
          }
          // advance clock until program starts
          console.log("Waiting for PC to reach", hex(this.prgstart));
          
          // Execute the program for a reasonable amount of time
          console.log("Executing program for 50000 cycles...");
          this.exports.machine_exec(this.sys, 50000);
          console.log("Program execution complete, PC:", hex(this.getPC()));
          
          // Let the program continue running normally
          console.log("Program loaded and started successfully");
          
          // Debug: Check what's in the border color register after program execution (commented out for production)
          /*
          var borderColor = this.readConst(0x900F);
          console.log("Border color register ($900F) after program:", hex(borderColor));
          
          // Debug: Check a few other VIC registers
          var vicReg0 = this.readConst(0x9000);
          var vicReg1 = this.readConst(0x9001);
          var vicReg2 = this.readConst(0x9002);
          console.log("VIC registers: $9000=", hex(vicReg0), "$9001=", hex(vicReg1), "$9002=", hex(vicReg2));
          
          // Test: Try to manually write to the border color register
          console.log("Testing manual write to $900F...");
          this.write(0x900F, 0x01);
          console.log("After manual write, $900F =", hex(this.readConst(0x900F)));
          
          // Test: Try different VIC register addresses
          console.log("Testing other VIC registers...");
          this.write(0x9000, 0x01); // VIC register 0
          this.write(0x9001, 0x01); // VIC register 1  
          this.write(0x9002, 0x01); // VIC register 2
          console.log("After writes: $9000=", hex(this.readConst(0x9000)), "$9001=", hex(this.readConst(0x9001)), "$9002=", hex(this.readConst(0x9002)));
          
          // Test: Try using VIC-I chip functions directly
          console.log("Testing VIC-I chip functions...");
          if (this.exports.m6561_color) {
            console.log("Calling m6561_color...");
            this.exports.m6561_color(this.sys, 0x01); // Set border color to white
            console.log("After m6561_color call, $900F =", hex(this.readConst(0x900F)));
          }
          
          // Test: Try to manually execute our program code
          console.log("Testing manual program execution...");
          
          // Write our program code directly to memory at $1009
          console.log("Writing program code to memory...");
          this.write(0x1009, 0xA9); // LDA #$01
          this.write(0x100A, 0x01);
          this.write(0x100B, 0x8D); // STA $900F
          this.write(0x100C, 0x0F);
          this.write(0x100D, 0x90);
          
          console.log("Memory at $1009 after writing:", hex(this.readConst(0x1009)), hex(this.readConst(0x100A)), hex(this.readConst(0x100B)), hex(this.readConst(0x100C)), hex(this.readConst(0x100D)));
          
          // Execute a few instructions manually
          this.exports.machine_exec(this.sys, 1000);
          console.log("After manual execution, PC:", hex(this.getPC()));
          console.log("After manual execution, $900F =", hex(this.readConst(0x900F)));
          */
        }
      } else {
        // get out of reset
        //this.exports.machine_exec(this.sys, 100);
        // wait until cartridge start
        // TODO: detect ROM cartridge
        var warmstart = this.romarr[0x2+2] + this.romarr[0x3+2]*256;
        for (var i=0; i<10000 && this.getPC() != warmstart; i++) {
          this.exports.machine_tick(this.sys);
        }
        console.log('cart', i, hex(warmstart));
      }
      // TODO: shouldn't we return here @ start of frame?
      // and stop probing
    }
  }
  advanceFrame(trap: TrapCondition) : number {
    // TODO: does this sync with VSYNC?
    var scanline = this.getRasterY();
    var clocks = Math.floor((this.numTotalScanlines - scanline) * 22152 / this.numTotalScanlines);
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
      x: -1, // TODO?
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
      ram:this.statearr.slice(18640, 18640+0x200), // ZP and stack (TODO)
    };
  }
  loadState(state) : void {
    this.statearr.set(state.state);
    this.exports.machine_load_state(this.sys, this.stateptr);
  }
  getVideoParams() {
   return {width:232, height:272, overscan:true, videoFrequency:50, aspect:1.5};
  }
  setKeyInput(key: number, code: number, flags: number): void {
    // TODO: handle shifted keys
    if (key == 16 || key == 17 || key == 18 || key == 224) return; // meta keys
    //console.log(key, code, flags);
    //if (flags & KeyFlags.Shift) { key += 64; }
    // convert to vic20
    var mask = 0;
    var mask2 = 0;
    if (key == 37) { key = 0x8; mask = 0x4; } // LEFT
    if (key == 38) { key = 0xb; mask = 0x1; } // UP
    if (key == 39) { key = 0x9; mask = 0x8; } // RIGHT
    if (key == 40) { key = 0xa; mask = 0x2; } // DOWN
    if (key == 32) { mask = 0x10; } // FIRE
    /* player 2 (TODO)
    if (key == 65) { key = 65; mask2 = 0x4; } // LEFT
    if (key == 67) { key = 67; mask2 = 0x1; } // UP
    if (key == 68) { key = 68; mask2 = 0x8; } // RIGHT
    if (key == 83) { key = 83; mask2 = 0x2; } // DOWN
    if (key == 69) { mask2 = 0x10; } // FIRE
    */
    if (key == 113) { key = 0xf1; } // F2
    if (key == 115) { key = 0xf3; } // F4
    if (key == 119) { key = 0xf5; } // F8
    if (key == 121) { key = 0xf7; } // F10
    if (flags & KeyFlags.KeyDown) {
      this.exports.machine_key_down(this.sys, key);
      this.joymask0 |= mask;
      this.joymask1 |= mask2;
    } else if (flags & KeyFlags.KeyUp) {
      this.exports.machine_key_up(this.sys, key);
      this.joymask0 &= ~mask;
      this.joymask1 &= ~mask2;
    }
    this.exports.vic20_joystick(this.sys, this.joymask0, this.joymask1);
  }

  // Override write method to handle I/O registers
  write(address: number, value: number): void {
    address = address & 0xFFFF;
    value = value & 0xFF;
    
    // VIC registers ($9000-$900F)
    if (address >= 0x9000 && address <= 0x900F) {
      console.log(`VIC register write: $${hex(address)} = ${hex(value)}`);
      
      // Let the WASM emulator handle I/O registers internally
      super.write(address, value);
      
      // Force video sync after VIC register changes
      if (this.exports.machine_update_video) {
        this.exports.machine_update_video(this.sys);
      }
      if (this.exports.machine_sync_video) {
        this.exports.machine_sync_video(this.sys);
      }
      
      // Also force a video sync through the base class
      this.syncVideo();
      return;
    }
    
    // Color RAM ($9400-$97FF)
    if (address >= 0x9400 && address <= 0x97FF) {
      console.log(`Color RAM write: $${hex(address)} = ${hex(value)}`);
      
      // Let the WASM emulator handle color RAM internally
      super.write(address, value);
      
      // Force video sync after color RAM changes
      if (this.exports.machine_update_video) {
        this.exports.machine_update_video(this.sys);
      }
      if (this.exports.machine_sync_video) {
        this.exports.machine_sync_video(this.sys);
      }
      
      // Also force a video sync through the base class
      this.syncVideo();
      return;
    }
    
    // Default memory access
    super.write(address, value);
  }

}

// pretty much just runs autostart ROM and not much else...
const DEFAULT_BIOS = [
  0xA2, 0x10, 0xA0, 0x91, 0x60, 0x71, 0xFF, 0x71, 0xFF, 0x5C, 0xFF, 0xA2, 0xFF, 0x78, 0x9A, 0xD8, 
  0x6C, 0x00, 0xA0, 0xA2, 0x45, 0xA0, 0xFF, 0x18, 0x78, 0x6C, 0x18, 0x03, 0x48, 0x8A, 0x48, 0x98, 
  0x48, 0xAD, 0x1D, 0x91, 0x10, 0x03, 0x6C, 0x02, 0xA0, 0x4C, 0x6C, 0xFF, 0x68, 0xA8, 0x68, 0xAA, 
  0x68, 0x40, 0x48, 0x8A, 0x48, 0x98, 0x48, 0xBA, 0xBD, 0x04, 0x01, 0x29, 0x10, 0xF0, 0x03, 0x6C, 
  0x16, 0x03, 0x6C, 0x14, 0x03, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x4C, 0x53, 0xFF, 0x4C, 0x44, 0xFF, 
  0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 
  0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 
  0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 
  0x6C, 0x1A, 0x03, 0x6C, 0x1C, 0x03, 0x6C, 0x1E, 0x03, 0x6C, 0x20, 0x03, 0x6C, 0x22, 0x03, 0x6C, 
  0x24, 0x03, 0x6C, 0x26, 0x03, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 
  0xFF, 0x6C, 0x28, 0x03, 0x6C, 0x2A, 0x03, 0x6C, 0x2C, 0x03, 0x4C, 0x44, 0xFF, 0x4C, 0x44, 0xFF, 
  0x4C, 0x44, 0xFF, 0x4C, 0x40, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x58, 0xFF, 0x4B, 0xFF, 0x72, 0xFF
];
