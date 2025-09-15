import { Platform } from '../common/baseplatform';
import { BBCMicroMachine } from '../machine/bbc';
import { PLATFORMS } from '../common/emu';

export class BBCMicroPlatform implements Platform {
  private machine: BBCMicroMachine | null = null;
  private mainElement: HTMLElement;
  private currentSSDBlob: Blob | null = null;

  constructor(mainElement: HTMLElement) {
    this.mainElement = mainElement;
    
    // Listen for SSD blob messages from the iframe
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'ssd_blob_ready') {
        console.log("BBCMicroPlatform: Received SSD blob from iframe");
        this.setSSDBlob(event.data.blob);
      }
    });
  }

  getName(): string {
    return 'BBC Micro';
  }

  getDescription(): string {
    return 'BBC Micro (Model B) - 6502-based home computer from Acorn';
  }

  async init(): Promise<void> {
    console.log("BBCMicroPlatform init() called");
    // BBC Micro doesn't need special initialization like some platforms
  }

  start(): void {
    console.log("BBCMicroPlatform start() called");
    
    // Create iframe for BBC Micro emulator
    const iframe = document.createElement('iframe');
    iframe.id = 'bbc-iframe';
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.style.border = '1px solid #ccc';
    iframe.style.backgroundColor = '#000';
    
    // Add iframe to the main element
    this.mainElement.innerHTML = '';
    this.mainElement.appendChild(iframe);
    console.log("BBCMicroPlatform: iframe created, setting up with auto-compilation");
    
    // Set up iframe with auto-compilation (async)
    this.setupIframeWithAutoCompilation().catch(error => {
      console.error("BBCMicroPlatform: Error in setupIframeWithAutoCompilation:", error);
    });
  }

  stop(): void {
    console.log("BBCMicroPlatform stop() called");
    if (this.machine) {
      this.machine.stop();
    }
  }

  reset(): void {
    console.log("BBCMicroPlatform reset() called");
    if (this.machine) {
      this.machine.reset();
    }
  }

  isRunning(): boolean {
    return this.machine ? this.machine.running : false;
  }

  getToolForFilename(filename: string): string {
    // BBC Micro uses cc65 for C compilation
    if (filename.endsWith('.bas')) return 'bbcbasic';
    if (filename.endsWith('.c')) return 'cc65';
    if (filename.endsWith('.asm') || filename.endsWith('.s')) return 'ca65';
    if (filename.endsWith('.dasm')) return 'dasm';
    return 'cc65'; // default
  }

  getDefaultExtension(): string {
    return '.c';
  }

      getPresets(): any[] {
        return [
            { id: 'bbc_hello.bas', name: 'Hello World (BASIC)', category: 'BASIC' },
            { id: 'bbc_hello.c', name: 'Hello World', category: 'C' },
            { id: 'bbc_os_test.c', name: 'Inline Assembly' },
        ];
    }

  pause(): void {
    console.log("BBCMicroPlatform pause() called");
    if (this.machine) {
      this.machine.stop();
    }
  }

  resume(): void {
    console.log("BBCMicroPlatform resume() called");
    if (this.machine) {
      this.machine.run();
    }
  }

  loadROM(title: string, rom: Uint8Array): void {
    console.log("BBCMicroPlatform loadROM called with title:", title, "and", rom.length, "bytes");
    
    var frame = document.getElementById("bbc-iframe") as HTMLIFrameElement;
    if (frame && frame.contentWindow) {
      // Check if this is BBC BASIC (raw text) or compiled C code
      const isBasicProgram = this.isBasicProgram(rom);
      
      if (isBasicProgram) {
        console.log("BBCMicroPlatform: BBC BASIC program detected");
        
        // Convert bytes back to text for BASIC programs
        const basicText = new TextDecoder().decode(rom);
        const encodedBasic = encodeURIComponent(basicText);
        
        // Check if the URL would be too long (limit to ~1500 chars to be safe)
        const iframeURL = `bbc-iframe.html?embedBasic=${encodedBasic}&t=${Date.now()}`;
        
        if (iframeURL.length > 1500) {
          console.log("BBCMicroPlatform: BASIC program too long for URL, using postMessage approach");
          // For long programs, use postMessage to send the BASIC text
          const baseURL = 'bbc-iframe.html?t=' + Date.now();
          frame.src = baseURL;
          
          const onLoad = () => {
            console.log("BBCMicroPlatform: iframe loaded, sending BASIC program via postMessage");
            frame.contentWindow!.postMessage({
              type: 'basic_program',
              program: basicText,
              autoLoad: true
            }, '*');
            frame.removeEventListener('load', onLoad);
          };
          frame.addEventListener('load', onLoad);
        } else {
          console.log("BBCMicroPlatform: Using embedBasic parameter for short BASIC program");
          frame.src = iframeURL;
        }
        
        console.log("BBCMicroPlatform: Loading iframe with BASIC program, URL length:", iframeURL.length);
      } else if (rom.length > 0) { // Compiled C program
        console.log("BBCMicroPlatform: Compiled C program detected, using postMessage");
        
        // Load the iframe with just the base URL
        const baseURL = 'bbc-iframe.html?t=' + Date.now();
        frame.src = baseURL;
        
        // Set up a one-time load event listener
        const onLoad = () => {
          console.log("BBCMicroPlatform: iframe loaded, sending program via postMessage");
          // Send the program data via postMessage
          frame.contentWindow!.postMessage({
            type: 'compiled_program',
            program: rom,
            autoLoad: true
          }, '*');
          frame.removeEventListener('load', onLoad);
        };
        frame.addEventListener('load', onLoad);
      } else {
        // For small programs, still use URL parameters
        const bbc_debug = (window as any).bbc_debug;
        if (bbc_debug && bbc_debug.generateIframeURL) {
          // Handle async generateIframeURL
          bbc_debug.generateIframeURL(rom).then((iframeURL: string) => {
            console.log("BBCMicroPlatform: Generated iframe URL:", iframeURL);
            
            if (iframeURL) {
              const cacheBuster = '&t=' + Date.now();
              const freshURL = iframeURL + cacheBuster;
              console.log("BBCMicroPlatform: Loading fresh URL with cache buster:", freshURL);
              
              // Set up a one-time load event listener
              const onLoad = () => {
                console.log("BBCMicroPlatform: iframe loaded, calling checkForProgramInURL");
                if ((frame.contentWindow as any).checkForProgramInURL) {
                  (frame.contentWindow as any).checkForProgramInURL();
                }
                frame.removeEventListener('load', onLoad);
              };
              frame.addEventListener('load', onLoad);
              
              // Set the location (this triggers the load event)
              frame.contentWindow.location = freshURL;
            } else {
              console.error("BBCMicroPlatform: generateIframeURL returned null");
            }
          }).catch((error: any) => {
            console.error("BBCMicroPlatform: Error generating iframe URL:", error);
          });
        } else {
          console.error("BBCMicroPlatform: bbc_debug not available");
        }
      }
    } else {
      console.error("BBCMicroPlatform: iframe not found or contentWindow not available");
    }
    
    // BBC platform uses iframe approach, no machine object needed
  }

  private async setupIframeWithAutoCompilation() {
    console.log("BBCMicroPlatform: Setting up iframe with auto-compilation");
    
    // Check if we have a compiled program
    const output = (window as any).IDE?.getCurrentOutput();
    if (output && output instanceof Uint8Array) {
      console.log("BBCMicroPlatform: Found compiled program, loading iframe");
      this.loadROM("compiled_program", output);
    } else {
      console.log("BBCMicroPlatform: No compiled program found, triggering compilation");
      await this.triggerCompilationAndReload();
    }
  }


  private async triggerCompilationAndReload() {
    console.log("BBCMicroPlatform: Triggering compilation and reload");
    
    // Set up a one-time compilation listener
    this.setupCompilationListener();
    
    // Trigger compilation
    const worker = (window as any).worker;
    if (worker && worker.postMessage) {
      console.log("BBCMicroPlatform: Triggering compilation via worker");
      worker.postMessage({ type: 'compile' });
    } else {
      console.error("BBCMicroPlatform: Worker not available for compilation");
    }
  }

  private setupCompilationListener() {
    console.log("BBCMicroPlatform: Setting up compilation listener");
    
    // Hook into the global setCompileOutput function to detect successful compilations
    const originalSetCompileOutput = (window as any).setCompileOutput;
    (window as any).setCompileOutput = (output: any) => {
      // Call the original function
      if (originalSetCompileOutput) {
        originalSetCompileOutput(output);
      }
      
      // If we have output, reload the iframe with the new program
      if (output && output instanceof Uint8Array) {
        console.log("BBCMicroPlatform: Compilation completed, reloading iframe with new program");
        
        // Wait a bit for the compilation output to be processed, then use loadROM
        setTimeout(() => {
          this.loadROM("compiled_program", output);
        }, 1000);
      }
    };
  }

  getDownloadFile(): {extension: string, blob: Blob} | undefined {
    // Check if we have a BASIC program to create an SSD for
    const output = (window as any).IDE?.getCurrentOutput();
    if (output && output instanceof Uint8Array && this.isBasicProgram(output)) {
      console.log("BBCMicroPlatform: Creating SSD disk image for BASIC program");
      return this.createSSDForBasicProgram(output);
    }
    
    // Fall back to existing SSD blob if available
    if (this.currentSSDBlob) {
      return {
        extension: '.ssd',
        blob: this.currentSSDBlob
      };
    }
    return undefined;
  }

  setSSDBlob(blob: Blob): void {
    this.currentSSDBlob = blob;
  }

  private createSSDForBasicProgram(basicOutput: Uint8Array): {extension: string, blob: Blob} {
    // Convert the BASIC text to a format suitable for BBC Micro disk
    const basicText = new TextDecoder().decode(basicOutput);
    
    // Get the current filename or use a default
    const currentFile = (window as any).IDE?.getCurrentFilename() || 'PROGRAM';
    const filename = currentFile.replace(/\.(bas|BAS)$/, '').toUpperCase().substring(0, 7); // Max 7 chars for DFS
    
    // Create a proper SSD disk image using the DFS format
    const ssdData = this.createProperSSD(basicText, filename);
    
    return {
      extension: '.ssd',
      blob: new Blob([ssdData], { type: 'application/octet-stream' })
    };
  }

  private createProperSSD(basicText: string, filename: string): Uint8Array {
    // Create a proper Acorn DFS SSD disk image
    // This follows the DFS format used by the BBC Micro
    
    // Convert BASIC text to bytes (BBC Micro uses ASCII)
    const basicBytes = new TextEncoder().encode(basicText);
    
    // Create a 200KB disk image (80 tracks * 10 sectors * 256 bytes)
    const diskSize = 80 * 10 * 256;
    const disk = new Uint8Array(diskSize);
    
    // Initialize with zeros
    disk.fill(0);
    
    // Write DFS catalog header
    // Volume title (8 bytes)
    const volumeTitle = 'BBCMICRO';
    for (let i = 0; i < 8; i++) {
      disk[i] = i < volumeTitle.length ? volumeTitle.charCodeAt(i) : 0x20; // Space padding
    }
    
    // Catalog sector 0 header
    disk[0x100] = 0x42; // 'B'
    disk[0x101] = 0x4F; // 'O' 
    disk[0x102] = 0x54; // 'T'
    disk[0x103] = 0x00; // Null terminator
    disk[0x104] = 0x00; // BCD catalog cycle number
    disk[0x105] = 0x08; // Number of files << 3 (1 file = 8)
    disk[0x106] = 0x30; // *EXEC boot
    disk[0x107] = 0x20; // Number of sectors in volume (low byte)
    disk[0x108] = 0x03; // Number of sectors in volume (high byte)
    
    // File catalog entry
    // Filename (7 bytes, padded with spaces)
    const paddedFilename = filename.padEnd(7, ' ');
    for (let i = 0; i < 7; i++) {
      disk[0x008 + i] = paddedFilename.charCodeAt(i);
    }
    disk[0x00F] = 0x24; // '$' (file type indicator)
    
    // Load address (0x1900 for BASIC programs)
    disk[0x108] = 0x00; // Low byte
    disk[0x109] = 0x19; // High byte
    
    // Exec address (0x1900 for BASIC programs)
    disk[0x10A] = 0x00; // Low byte  
    disk[0x10B] = 0x19; // High byte
    
    // File length
    disk[0x10C] = basicBytes.length & 0xFF; // Low byte
    disk[0x10D] = (basicBytes.length >> 8) & 0xFF; // High byte
    
    // Extra info byte
    disk[0x10E] = 0x00; // Extra info
    
    // Start sector (sector 2, after catalog)
    disk[0x10F] = 0x02;
    
    // Write the BASIC program data starting at sector 2
    const dataStart = 0x200; // Sector 2 * 256 bytes
    for (let i = 0; i < basicBytes.length && i < (diskSize - dataStart); i++) {
      disk[dataStart + i] = basicBytes[i];
    }
    
    console.log(`BBCMicroPlatform: Created proper SSD with ${basicBytes.length} bytes of BASIC program as ${filename}`);
    
    return disk;
  }

  private isBasicProgram(rom: Uint8Array): boolean {
    // Check if this looks like BBC BASIC source code
    // BBC BASIC programs typically start with line numbers and contain BASIC keywords
    const text = new TextDecoder().decode(rom);
    
    // Look for BBC BASIC patterns:
    // 1. Starts with a line number (digits followed by space)
    // 2. Contains BBC BASIC keywords
    const basicKeywords = ['PRINT', 'REM', 'MODE', 'COLOUR', 'GOTO', 'FOR', 'NEXT', 'IF', 'THEN', 'ELSE', 'END', 'STOP', 'RUN', 'NEW', 'LOAD', 'SAVE'];
    
    const hasLineNumbers = /^\d+\s/.test(text.trim());
    const hasBasicKeywords = basicKeywords.some(keyword => 
      text.toUpperCase().includes(keyword)
    );
    
    return hasLineNumbers && hasBasicKeywords;
  }
}

// Register the BBC platform
PLATFORMS['bbc'] = BBCMicroPlatform;
PLATFORMS['bbc-micro'] = BBCMicroPlatform;
PLATFORMS['bbc.b'] = BBCMicroPlatform;
PLATFORMS['bbc.model.b'] = BBCMicroPlatform; 