import { C64ChipsMachine } from "../machine/c64";
import { Platform, Preset } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { RasterVideo, AnimationTimer } from "../common/emu";

const C64_PRESETS : Preset[] = [
  {id:'helloc.c', name:'Hello World', category:'C'},
  {id:'demo.c', name:'Scrolling Text and Music Demo', category:'C'},
  {id:'screen_ram.c', name:'Screen RAM'},
  {id:'siegegame.c', name:'Siege Game'},
  {id:'joymove.c', name:'Sprite Movement'},
  {id:'sprite_collision.c', name:'Sprite Collision'},
  {id:'scroll1.c', name:'Scrolling (Single Buffer)'},
  {id:'test_setirq.c', name:'Raster Interrupts'},
  {id:'test_display_list.c', name:'Raster IRQ Library'},
  {id:'scrolling_text.c', name:'Big Scrolling Text'},
  {id:'side_scroller.c', name:'Side-Scrolling Game'},
  {id:'scroll2.c', name:'Scrolling (Double Buffer)'},
  {id:'scroll3.c', name:'Scrolling (Multidirectional)'},
  {id:'scroll4.c', name:'Scrolling (Color RAM Buffering)'},
  {id:'scroll5.c', name:'Scrolling (Camera Following)'},
  {id:'scrollingmap1.c', name:'Scrolling Tile Map'},
  {id:'fullscrollgame.c', name:'Full-Scrolling Game'},
  {id:'test_multiplex.c', name:'Sprite Retriggering'},
  {id:'test_multispritelib.c', name:'Sprite Multiplexing Library'},
  {id:'mcbitmap.c', name:'Multicolor Bitmap Mode'},
  {id:'testlz4.c', name:'LZ4 Bitmap Compression'},
  {id:'mandel.c', name:'Mandelbrot Fractal'},
  {id:'musicplayer.c', name:'Music Player'},
  {id:'sidtune.dasm', name:'Tiny SID Tune (ASM)'},
  {id:'siddemo.c', name:'SID Player Demo'},
  {id:'digisound.c', name:'Digi Sound Player'},
  {id:'climber.c', name:'Climber Game'},
  {id:'test_border_sprites.c', name:'Sprites in the Borders'},
  {id:'sprite_stretch.c', name:'Sprite Stretching'},
  {id:'linecrunch.c', name:'Linecrunch'},
  {id:'fld.c', name:'Flexible Line Distance'},
  {id:'plasma.c', name:'Plasma Demo'},
  {id:'23matches.c', name:'23 Matches'},
  {id:'tgidemo.c', name:'TGI Graphics Demo'},
  {id:'upandaway.c', name:'Up, Up and Away'},
  {id:'hello.dasm', name:'Hello World (DASM)', category:'Assembly Language'},
  {id:'hello.acme', name:'Hello World (ACME)'},
  {id:'hello.wiz', name:'Hello Wiz (Wiz)'},
];

const C64_MEMORY_MAP = { main:[
  {name:'6510 Registers',start:0x0,  size:0x2,type:'io'},
  {name:'BIOS Reserved', start:0x200,   size:0xa7},
  {name:'Default Screen RAM', start:0x400,   size:1024,type:'ram'},
  {name:'Cartridge ROM',start:0x8000,size:0x2000,type:'rom'},
  {name:'BASIC ROM',    start:0xa000,size:0x2000,type:'rom'},
  {name:'Upper RAM',    start:0xc000,size:0x1000,type:'ram'},
  {name:'Character ROM',start:0xd000,size:0x1000,type:'rom'},
  {name:'VIC-II I/O',   start:0xd000,size:0x0400,type:'io'},
  {name:'SID',          start:0xd400,size:0x0400,type:'io'},
  {name:'Color RAM',    start:0xd800,size:0x0400,type:'io'},
  {name:'CIA 1',        start:0xdc00,size:0x0100,type:'io'},
  {name:'CIA 2',        start:0xdd00,size:0x0100,type:'io'},
  {name:'I/O 1',        start:0xde00,size:0x0100,type:'io'},
  {name:'I/O 2',        start:0xdf00,size:0x0100,type:'io'},
  {name:'KERNAL ROM',   start:0xe000,size:0x2000,type:'rom'},
] }

// Chips-test C64 platform
class C64ChipsPlatform implements Platform {
  private machine: C64ChipsMachine;
  private mainElement: HTMLElement;
  private timer: AnimationTimer;
  private video: RasterVideo;
  private running = false;

  constructor(mainElement: HTMLElement) {
    this.mainElement = mainElement;
    this.machine = new C64ChipsMachine();
  }

  async start(): Promise<void> {
    console.log("C64ChipsPlatform start() called");
    
    // Initialize the machine
    await this.machine.init();
    
    // Give the chips-test emulator a moment to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Clear the main element and add the chips-test canvas
    this.mainElement.innerHTML = '';
    
    // Get canvas from the chips-test emulator
    const canvas = this.machine.getCanvas();
    if (canvas) {
      // Remove the canvas from document.body and add it to our main element
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      this.mainElement.appendChild(canvas);
    }
    
    // Start the emulator
    await this.machine.run();
    this.running = true;
    
    console.log("C64ChipsPlatform start() completed");
    
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
    console.log("C64ChipsPlatform loadROM called with title:", title, "and", rom.length, "bytes");
    if (this.machine) {
      this.machine.loadProgram(rom);
    } else {
      console.error("C64ChipsPlatform: machine is null!");
    }
  }

  getPresets(): Preset[] {
    return C64_PRESETS;
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
    return C64_MEMORY_MAP;
  }

  showHelp(): string {
    return "https://8bitworkshop.com/docs/platforms/c64/";
  }

  getROMExtension(rom: Uint8Array): string {
    if (rom && rom[0] == 0x01 && rom[1] == 0x08) return ".prg";
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

  getExtraCompileFiles(filename: string): string[] {
    // Add binary files needed for specific demos
    if (filename === 'sidplaysfx.s') {
      return ['sidmusic1.bin'];
    }
    return [];
  }
}

PLATFORMS['c64'] = C64ChipsPlatform;

// Export the platform class for dynamic loading
export default C64ChipsPlatform; 