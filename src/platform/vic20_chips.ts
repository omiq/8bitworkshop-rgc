import { VIC20ChipsMachine } from "../machine/vic20_chips";
import { Platform, Preset } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { RasterVideo, AnimationTimer } from "../common/emu";

const VIC20_CHIPS_PRESETS : Preset[] = [
  {id:'hello.dasm', name:'Hello World (DASM)', category:'Assembly Language'},
  {id:'siegegame.c', name:'Siege Game', category:'C'},
  {id:'basic_test.dasm', name:'BASIC Test', category:'Assembly Language'},
  {id:'color_test.dasm', name:'Color Test', category:'Assembly Language'},
  {id:'simple_test.dasm', name:'Simple Test', category:'Assembly Language'},
  {id:'debug_test.dasm', name:'Debug Test', category:'Assembly Language'},
  {id:'hellocart.dasm', name:'Hello Cartridge', category:'Assembly Language'},
  {id:'cartheader.dasm', name:'Cartridge Header', category:'Assembly Language'},
  {id:'skeleton.cc65', name:'CC65 Skeleton', category:'C'},
];

const VIC20_CHIPS_MEMORY_MAP = { main:[
  {name:'RAM',          start:0x0000,size:0x1000,type:'ram'},
  {name:'Screen RAM',   start:0x1000,size:0x0400,type:'ram'},
  {name:'Color RAM',    start:0x9400,size:0x0400,type:'io'},
  {name:'Character ROM',start:0x8000,size:0x1000,type:'rom'},
  {name:'BASIC ROM',    start:0xc000,size:0x2000,type:'rom'},
  {name:'KERNAL ROM',   start:0xe000,size:0x2000,type:'rom'},
  {name:'VIC I/O',      start:0x9000,size:0x0400,type:'io'},
  {name:'VIA 1',        start:0x9110,size:0x0010,type:'io'},
  {name:'VIA 2',        start:0x9120,size:0x0010,type:'io'},
] }

// Chips-test VIC-20 platform
class VIC20ChipsPlatform implements Platform {
  private machine: VIC20ChipsMachine;
  private mainElement: HTMLElement;
  private timer: AnimationTimer;
  private video: RasterVideo;
  private running = false;

  constructor(mainElement: HTMLElement) {
    this.mainElement = mainElement;
    this.machine = new VIC20ChipsMachine();
  }

  async start(): Promise<void> {
    console.log("VIC20ChipsPlatform start() called");
    
    // Initialize the machine
    await this.machine.init();
    console.log("VIC20ChipsPlatform: machine initialized");
    
    // Give the chips-test emulator a moment to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("VIC20ChipsPlatform: waited 1 second for initialization");
    
    // Clear the main element and add the chips-test canvas
    this.mainElement.innerHTML = '';
    console.log("VIC20ChipsPlatform: cleared main element");
    
    // Get canvas from the chips-test emulator
    const canvas = this.machine.getCanvas();
    console.log("VIC20ChipsPlatform: got canvas:", canvas);
    
    if (canvas) {
      // Remove the canvas from document.body and add it to our main element
      if (canvas.parentNode) {
        console.log("VIC20ChipsPlatform: removing canvas from", canvas.parentNode);
        canvas.parentNode.removeChild(canvas);
      }
      this.mainElement.appendChild(canvas);
      console.log("VIC20ChipsPlatform: added canvas to main element");
      console.log("VIC20ChipsPlatform: canvas dimensions:", canvas.width, "x", canvas.height);
      console.log("VIC20ChipsPlatform: canvas style:", canvas.style.cssText);
    } else {
      console.error("VIC20ChipsPlatform: no canvas available!");
    }
    
    // Start the emulator
    await this.machine.run();
    this.running = true;
    console.log("VIC20ChipsPlatform: emulator started");
    
    console.log("VIC20ChipsPlatform start() completed");
    
    // Start animation timer
    this.timer = new AnimationTimer(50, this.nextFrame.bind(this));
  }

  private nextFrame(): void {
    if (this.running) {
      // The chips-test emulator handles its own frame updates
      // We just need to keep the timer running
    }
  }

  reset(): void {
    if (this.machine) {
      this.machine.reset();
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  pause(): void {
    if (this.machine) {
      this.machine.stop();
      this.running = false;
    }
  }

  resume(): void {
    if (this.machine) {
      this.machine.run();
      this.running = true;
    }
  }

  loadROM(title: string, rom: Uint8Array): void {
    console.log("VIC20ChipsPlatform loadROM called with title:", title, "and", rom.length, "bytes");
    if (this.machine) {
      this.machine.loadProgram(rom);
    } else {
      console.error("VIC20ChipsPlatform: machine is null!");
    }
  }

  getPresets(): Preset[] {
    return VIC20_CHIPS_PRESETS;
  }

  getDefaultExtension(): string {
    return ".c";
  }

  getToolForFilename(filename: string): string {
    if (filename.endsWith(".c")) return "cc65";
    if (filename.endsWith(".dasm")) return "dasm";
    if (filename.endsWith(".acme")) return "acme";
    if (filename.endsWith(".wiz")) return "wiz";
    return "cc65";
  }

  readAddress(addr: number): number {
    if (this.machine) {
      return this.machine.read(addr);
    }
    return 0;
  }

  getMemoryMap() {
    return VIC20_CHIPS_MEMORY_MAP;
  }

  showHelp(): string {
    return "https://8bitworkshop.com/docs/platforms/vic20/";
  }

  getROMExtension(rom: Uint8Array): string {
    if (rom && rom[0] == 0x01 && rom[1] == 0x10) return ".prg";
    else return ".bin";
  }

  // Optional methods with default implementations
  getCPUState() {
    if (this.machine) {
      return this.machine.getCPUState();
    }
    return { PC: 0, SP: 0 };
  }

  saveState() {
    if (this.machine) {
      return this.machine.saveState();
    }
    return { c: { PC: 0, SP: 0 }, b: new Uint8Array(0) };
  }

  loadState(state: any): void {
    if (this.machine) {
      this.machine.loadState(state);
    }
  }

  getPC(): number {
    const cpuState = this.getCPUState();
    return cpuState.PC;
  }

  getSP(): number {
    const cpuState = this.getCPUState();
    return cpuState.SP;
  }

  isStable(): boolean {
    return true; // Assume stable for chips-test emulator
  }
}

PLATFORMS['vic20.chips'] = VIC20ChipsPlatform;

// Export the platform class for dynamic loading
export default VIC20ChipsPlatform; 