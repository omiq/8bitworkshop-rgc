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
        console.log("BBCMicroPlatform: BBC BASIC program detected, using embedBasic parameter");
        
        // Convert bytes back to text for BASIC programs
        const basicText = new TextDecoder().decode(rom);
        const encodedBasic = encodeURIComponent(basicText);
        
        // Load iframe with embedBasic parameter
        const iframeURL = `bbc-iframe.html?embedBasic=${encodedBasic}&t=${Date.now()}`;
        frame.src = iframeURL;
        
        console.log("BBCMicroPlatform: Loading iframe with BASIC program:", iframeURL);
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
      
      const bbc_debug = (window as any).bbc_debug;
      if (bbc_debug && bbc_debug.generateIframeURL) {
        try {
          // Await the async generateIframeURL function
          const iframeURL = await bbc_debug.generateIframeURL(output);
          console.log("BBCMicroPlatform: Generated iframe URL:", iframeURL);
          
          if (iframeURL) {
            await this.loadIframeWithProgram(iframeURL);
          } else {
            console.error("BBCMicroPlatform: generateIframeURL returned null");
          }
        } catch (error) {
          console.error("BBCMicroPlatform: Error generating iframe URL:", error);
        }
      } else {
        console.error("BBCMicroPlatform: bbc_debug not available");
      }
    } else {
      console.log("BBCMicroPlatform: No compiled program found, triggering compilation");
      await this.triggerCompilationAndReload();
    }
  }

  private async loadIframeWithProgram(iframeURL: string) {
    console.log("BBCMicroPlatform: Loading iframe with program URL:", iframeURL);
    
    var frame = document.getElementById("bbc-iframe") as HTMLIFrameElement;
    if (frame && frame.contentWindow) {
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
      console.error("BBCMicroPlatform: iframe not found or contentWindow not available");
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
        
        // Wait a bit for the compilation output to be processed
        setTimeout(async () => {
          const bbc_debug = (window as any).bbc_debug;
          if (bbc_debug && bbc_debug.generateIframeURL) {
            try {
              const newIframeURL = await bbc_debug.generateIframeURL(output);
              if (newIframeURL) {
                await this.loadIframeWithProgram(newIframeURL);
              }
            } catch (error) {
              console.error("BBCMicroPlatform: Error generating iframe URL after compilation:", error);
            }
          }
        }, 1000);
      }
    };
  }

  getDownloadFile(): {extension: string, blob: Blob} | undefined {
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