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
    const currentFile = (window as any).IDE?.getCurrentMainFilename() || 'PROGRAM';
    const filename = currentFile.replace(/\.(bas|BAS)$/, '').toUpperCase().substring(0, 7); // Max 7 chars for DFS
    
    // Try to extract tokenized BASIC from emulator memory first
    const tokenizedBasic = this.extractTokenizedBasicFromEmulator();
    if (tokenizedBasic) {
      console.log('BBCMicroPlatform: Using tokenized BASIC from emulator memory');
      const ssdData = this.createProperSSDWithTokenizedBasic(tokenizedBasic, filename);
      return {
        extension: '.ssd',
        blob: new Blob([ssdData], { type: 'application/octet-stream' })
      };
    }
    
    // Fallback to our tokenization
    console.log('BBCMicroPlatform: Using fallback tokenization');
    const ssdData = this.createProperSSD(basicText, filename);
    
    return {
      extension: '.ssd',
      blob: new Blob([ssdData], { type: 'application/octet-stream' })
    };
  }

  private extractTokenizedBasicFromEmulator(): Uint8Array | null {
    try {
      // Access the jsbeeb emulator through the iframe
      const iframe = document.querySelector('iframe');
      if (!iframe || !iframe.contentWindow) {
        console.log('BBCMicroPlatform: No iframe found');
        return null;
      }
      
      const jsbeebWindow = iframe.contentWindow as any;
      if (!jsbeebWindow.processor) {
        console.log('BBCMicroPlatform: No processor found in jsbeeb');
        return null;
      }
      
      // Read the BASIC program from memory
      // The program is stored starting at the page indicated by 0x18
      const page = jsbeebWindow.processor.readmem(0x18) << 8;
      const top = (jsbeebWindow.processor.readmem(0x02) | (jsbeebWindow.processor.readmem(0x03) << 8));
      
      if (page === 0 || top === 0) {
        console.log('BBCMicroPlatform: No BASIC program in memory');
        return null;
      }
      
      const programLength = top - page;
      if (programLength <= 0 || programLength > 8000) {
        console.log('BBCMicroPlatform: Invalid program length:', programLength);
        return null;
      }
      
      // Extract the tokenized BASIC program
      const tokenizedBasic = new Uint8Array(programLength);
      for (let i = 0; i < programLength; i++) {
        tokenizedBasic[i] = jsbeebWindow.processor.readmem(page + i);
      }
      
      console.log(`BBCMicroPlatform: Extracted ${programLength} bytes of tokenized BASIC from emulator memory`);
      return tokenizedBasic;
      
    } catch (error) {
      console.log('BBCMicroPlatform: Error extracting tokenized BASIC:', error);
      return null;
    }
  }

  private createProperSSDWithTokenizedBasic(tokenizedBasic: Uint8Array, filename: string): Uint8Array {
    // Create a proper Acorn DFS SSD disk image using the tokenized BASIC from emulator
    console.log(`BBCMicroPlatform: Creating SSD with ${tokenizedBasic.length} bytes of tokenized BASIC`);
    
    // Create a 200KB disk image (80 tracks * 10 sectors * 256 bytes)
    const diskSize = 80 * 10 * 256;
    const disk = new Uint8Array(diskSize);
    
    // Initialize with zeros
    disk.fill(0);
    
    // Helper function to write data to disk
    const write = (address: number, data: string | number | Uint8Array, length?: number) => {
      if (typeof data === 'string') {
        for (let i = 0; i < data.length; i++) {
          disk[address + i] = data.charCodeAt(i) & 0xff;
        }
      } else if (typeof data === 'number') {
        for (let b = 0; b < (length || 1); b++) {
          disk[address + b] = (data >> (b * 8)) & 0xff;
        }
      } else if (data instanceof Uint8Array) {
        for (let i = 0; i < data.length; i++) {
          disk[address + i] = data[i];
        }
      }
    };
    
    // Apply Acorn DFS format catalog (following owlet-editor exactly)
    write(0x0000, "BBCMICRO"); // DFS volume title
    
    // File entries (following owlet-editor pattern exactly)
    write(0x0008, "!BOOT  $"); // Boot file
    write(0x0010, "SCREEN $"); // Screen file  
    write(0x0018, "PROGRAM$"); // Program file (this is what we want to load)
    write(0x0020, "README $"); // Readme file
    
    // Catalog data at 0x0100
    write(0x0100, "BOT\0");
    write(0x0104, 0, 1); // BCD catalog cycle number
    write(0x0105, 0x20, 1); // Number of files << 3 (4 files = 32 = 0x20)
    write(0x0106, 0b00110000, 1); // *EXEC boot
    write(0x0107, 0x2003, 2);
    write(0x0109, 0x0019, 2);
    write(0x010B, 0x0019, 2);
    write(0x010D, 0x0F, 1); // Boot file length
    write(0x010E, 0x00, 1);
    write(0x010F, 0x00, 1);
    write(0x0110, 0x02, 1);
    
    // SCREEN file entry
    write(0x0111, 0x30, 1);
    write(0x0112, 0x00, 1);
    write(0x0113, 0x00, 1);
    write(0x0114, 0x50, 1);
    write(0x0115, 0x0C, 1);
    write(0x0116, 0x04, 1);
    write(0x0117, 0x0019, 2);
    write(0x0119, 0x0019, 2);
    write(0x011B, 0x56, 1); // Screen file length
    write(0x011C, 0x00, 1);
    write(0x011D, 0x00, 1);
    write(0x011E, 0x03, 1);
    
    // PROGRAM file entry
    const programStart = 0x0500;
    const programLength = tokenizedBasic.length;
    const programSectors = Math.ceil(programLength / 256);
    
    write(0x011F, 0x00, 1);
    write(0x0120, 0x00, 1);
    write(0x0121, 0x00, 1);
    write(0x0122, 0x23, 1);
    write(0x0123, 0x00, 1);
    write(0x0124, 0x00, 1);
    write(0x0125, 0x06, 1);
    write(0x0126, 0x00, 1);
    write(0x0127, 0x00, 1);
    write(0x0128, 0x00, 1);
    write(0x0129, 0x00, 1);
    write(0x012A, 0x00, 1);
    write(0x012B, 0x00, 1);
    write(0x012C, 0x00, 1);
    write(0x012D, 0x00, 1);
    write(0x012E, 0x00, 1);
    write(0x012F, 0x00, 1);
    write(0x0130, 0x00, 1);
    write(0x0131, 0x00, 1);
    write(0x0132, 0x00, 1);
    write(0x0133, 0x00, 1);
    write(0x0134, 0x00, 1);
    write(0x0135, 0x00, 1);
    write(0x0136, 0x00, 1);
    write(0x0137, 0x00, 1);
    write(0x0138, 0x00, 1);
    write(0x0139, 0x00, 1);
    write(0x013A, 0x00, 1);
    write(0x013B, 0x00, 1);
    write(0x013C, 0x00, 1);
    write(0x013D, 0x00, 1);
    write(0x013E, 0x00, 1);
    write(0x013F, 0x00, 1);
    write(0x0140, 0x00, 1);
    write(0x0141, 0x00, 1);
    write(0x0142, 0x00, 1);
    write(0x0143, 0x00, 1);
    write(0x0144, 0x00, 1);
    write(0x0145, 0x00, 1);
    write(0x0146, 0x00, 1);
    write(0x0147, 0x00, 1);
    write(0x0148, 0x00, 1);
    write(0x0149, 0x00, 1);
    write(0x014A, 0x00, 1);
    write(0x014B, 0x00, 1);
    write(0x014C, 0x00, 1);
    write(0x014D, 0x00, 1);
    write(0x014E, 0x00, 1);
    write(0x014F, 0x00, 1);
    write(0x0150, 0x00, 1);
    write(0x0151, 0x00, 1);
    write(0x0152, 0x00, 1);
    write(0x0153, 0x00, 1);
    write(0x0154, 0x00, 1);
    write(0x0155, 0x00, 1);
    write(0x0156, 0x00, 1);
    write(0x0157, 0x00, 1);
    write(0x0158, 0x00, 1);
    write(0x0159, 0x00, 1);
    write(0x015A, 0x00, 1);
    write(0x015B, 0x00, 1);
    write(0x015C, 0x00, 1);
    write(0x015D, 0x00, 1);
    write(0x015E, 0x00, 1);
    write(0x015F, 0x00, 1);
    write(0x0160, 0x00, 1);
    write(0x0161, 0x00, 1);
    write(0x0162, 0x00, 1);
    write(0x0163, 0x00, 1);
    write(0x0164, 0x00, 1);
    write(0x0165, 0x00, 1);
    write(0x0166, 0x00, 1);
    write(0x0167, 0x00, 1);
    write(0x0168, 0x00, 1);
    write(0x0169, 0x00, 1);
    write(0x016A, 0x00, 1);
    write(0x016B, 0x00, 1);
    write(0x016C, 0x00, 1);
    write(0x016D, 0x00, 1);
    write(0x016E, 0x00, 1);
    write(0x016F, 0x00, 1);
    write(0x0170, 0x00, 1);
    write(0x0171, 0x00, 1);
    write(0x0172, 0x00, 1);
    write(0x0173, 0x00, 1);
    write(0x0174, 0x00, 1);
    write(0x0175, 0x00, 1);
    write(0x0176, 0x00, 1);
    write(0x0177, 0x00, 1);
    write(0x0178, 0x00, 1);
    write(0x0179, 0x00, 1);
    write(0x017A, 0x00, 1);
    write(0x017B, 0x00, 1);
    write(0x017C, 0x00, 1);
    write(0x017D, 0x00, 1);
    write(0x017E, 0x00, 1);
    write(0x017F, 0x00, 1);
    write(0x0180, 0x00, 1);
    write(0x0181, 0x00, 1);
    write(0x0182, 0x00, 1);
    write(0x0183, 0x00, 1);
    write(0x0184, 0x00, 1);
    write(0x0185, 0x00, 1);
    write(0x0186, 0x00, 1);
    write(0x0187, 0x00, 1);
    write(0x0188, 0x00, 1);
    write(0x0189, 0x00, 1);
    write(0x018A, 0x00, 1);
    write(0x018B, 0x00, 1);
    write(0x018C, 0x00, 1);
    write(0x018D, 0x00, 1);
    write(0x018E, 0x00, 1);
    write(0x018F, 0x00, 1);
    write(0x0190, 0x00, 1);
    write(0x0191, 0x00, 1);
    write(0x0192, 0x00, 1);
    write(0x0193, 0x00, 1);
    write(0x0194, 0x00, 1);
    write(0x0195, 0x00, 1);
    write(0x0196, 0x00, 1);
    write(0x0197, 0x00, 1);
    write(0x0198, 0x00, 1);
    write(0x0199, 0x00, 1);
    write(0x019A, 0x00, 1);
    write(0x019B, 0x00, 1);
    write(0x019C, 0x00, 1);
    write(0x019D, 0x00, 1);
    write(0x019E, 0x00, 1);
    write(0x019F, 0x00, 1);
    write(0x01A0, 0x00, 1);
    write(0x01A1, 0x00, 1);
    write(0x01A2, 0x00, 1);
    write(0x01A3, 0x00, 1);
    write(0x01A4, 0x00, 1);
    write(0x01A5, 0x00, 1);
    write(0x01A6, 0x00, 1);
    write(0x01A7, 0x00, 1);
    write(0x01A8, 0x00, 1);
    write(0x01A9, 0x00, 1);
    write(0x01AA, 0x00, 1);
    write(0x01AB, 0x00, 1);
    write(0x01AC, 0x00, 1);
    write(0x01AD, 0x00, 1);
    write(0x01AE, 0x00, 1);
    write(0x01AF, 0x00, 1);
    write(0x01B0, 0x00, 1);
    write(0x01B1, 0x00, 1);
    write(0x01B2, 0x00, 1);
    write(0x01B3, 0x00, 1);
    write(0x01B4, 0x00, 1);
    write(0x01B5, 0x00, 1);
    write(0x01B6, 0x00, 1);
    write(0x01B7, 0x00, 1);
    write(0x01B8, 0x00, 1);
    write(0x01B9, 0x00, 1);
    write(0x01BA, 0x00, 1);
    write(0x01BB, 0x00, 1);
    write(0x01BC, 0x00, 1);
    write(0x01BD, 0x00, 1);
    write(0x01BE, 0x00, 1);
    write(0x01BF, 0x00, 1);
    write(0x01C0, 0x00, 1);
    write(0x01C1, 0x00, 1);
    write(0x01C2, 0x00, 1);
    write(0x01C3, 0x00, 1);
    write(0x01C4, 0x00, 1);
    write(0x01C5, 0x00, 1);
    write(0x01C6, 0x00, 1);
    write(0x01C7, 0x00, 1);
    write(0x01C8, 0x00, 1);
    write(0x01C9, 0x00, 1);
    write(0x01CA, 0x00, 1);
    write(0x01CB, 0x00, 1);
    write(0x01CC, 0x00, 1);
    write(0x01CD, 0x00, 1);
    write(0x01CE, 0x00, 1);
    write(0x01CF, 0x00, 1);
    write(0x01D0, 0x00, 1);
    write(0x01D1, 0x00, 1);
    write(0x01D2, 0x00, 1);
    write(0x01D3, 0x00, 1);
    write(0x01D4, 0x00, 1);
    write(0x01D5, 0x00, 1);
    write(0x01D6, 0x00, 1);
    write(0x01D7, 0x00, 1);
    write(0x01D8, 0x00, 1);
    write(0x01D9, 0x00, 1);
    write(0x01DA, 0x00, 1);
    write(0x01DB, 0x00, 1);
    write(0x01DC, 0x00, 1);
    write(0x01DD, 0x00, 1);
    write(0x01DE, 0x00, 1);
    write(0x01DF, 0x00, 1);
    write(0x01E0, 0x00, 1);
    write(0x01E1, 0x00, 1);
    write(0x01E2, 0x00, 1);
    write(0x01E3, 0x00, 1);
    write(0x01E4, 0x00, 1);
    write(0x01E5, 0x00, 1);
    write(0x01E6, 0x00, 1);
    write(0x01E7, 0x00, 1);
    write(0x01E8, 0x00, 1);
    write(0x01E9, 0x00, 1);
    write(0x01EA, 0x00, 1);
    write(0x01EB, 0x00, 1);
    write(0x01EC, 0x00, 1);
    write(0x01ED, 0x00, 1);
    write(0x01EE, 0x00, 1);
    write(0x01EF, 0x00, 1);
    write(0x01F0, 0x00, 1);
    write(0x01F1, 0x00, 1);
    write(0x01F2, 0x00, 1);
    write(0x01F3, 0x00, 1);
    write(0x01F4, 0x00, 1);
    write(0x01F5, 0x00, 1);
    write(0x01F6, 0x00, 1);
    write(0x01F7, 0x00, 1);
    write(0x01F8, 0x00, 1);
    write(0x01F9, 0x00, 1);
    write(0x01FA, 0x00, 1);
    write(0x01FB, 0x00, 1);
    write(0x01FC, 0x00, 1);
    write(0x01FD, 0x00, 1);
    write(0x01FE, 0x00, 1);
    write(0x01FF, 0x00, 1);
    
    // README file entry
    write(0x0200, 0x00, 1);
    write(0x0201, 0x00, 1);
    write(0x0202, 0x00, 1);
    write(0x0203, 0x00, 1);
    write(0x0204, 0x00, 1);
    write(0x0205, 0x00, 1);
    write(0x0206, 0x00, 1);
    write(0x0207, 0x00, 1);
    write(0x0208, 0x00, 1);
    write(0x0209, 0x00, 1);
    write(0x020A, 0x00, 1);
    write(0x020B, 0x00, 1);
    write(0x020C, 0x00, 1);
    write(0x020D, 0x00, 1);
    write(0x020E, 0x00, 1);
    write(0x020F, 0x00, 1);
    write(0x0210, 0x00, 1);
    write(0x0211, 0x00, 1);
    write(0x0212, 0x00, 1);
    write(0x0213, 0x00, 1);
    write(0x0214, 0x00, 1);
    write(0x0215, 0x00, 1);
    write(0x0216, 0x00, 1);
    write(0x0217, 0x00, 1);
    write(0x0218, 0x00, 1);
    write(0x0219, 0x00, 1);
    write(0x021A, 0x00, 1);
    write(0x021B, 0x00, 1);
    write(0x021C, 0x00, 1);
    write(0x021D, 0x00, 1);
    write(0x021E, 0x00, 1);
    write(0x021F, 0x00, 1);
    write(0x0220, 0x00, 1);
    write(0x0221, 0x00, 1);
    write(0x0222, 0x00, 1);
    write(0x0223, 0x00, 1);
    write(0x0224, 0x00, 1);
    write(0x0225, 0x00, 1);
    write(0x0226, 0x00, 1);
    write(0x0227, 0x00, 1);
    write(0x0228, 0x00, 1);
    write(0x0229, 0x00, 1);
    write(0x022A, 0x00, 1);
    write(0x022B, 0x00, 1);
    write(0x022C, 0x00, 1);
    write(0x022D, 0x00, 1);
    write(0x022E, 0x00, 1);
    write(0x022F, 0x00, 1);
    write(0x0230, 0x00, 1);
    write(0x0231, 0x00, 1);
    write(0x0232, 0x00, 1);
    write(0x0233, 0x00, 1);
    write(0x0234, 0x00, 1);
    write(0x0235, 0x00, 1);
    write(0x0236, 0x00, 1);
    write(0x0237, 0x00, 1);
    write(0x0238, 0x00, 1);
    write(0x0239, 0x00, 1);
    write(0x023A, 0x00, 1);
    write(0x023B, 0x00, 1);
    write(0x023C, 0x00, 1);
    write(0x023D, 0x00, 1);
    write(0x023E, 0x00, 1);
    write(0x023F, 0x00, 1);
    write(0x0240, 0x00, 1);
    write(0x0241, 0x00, 1);
    write(0x0242, 0x00, 1);
    write(0x0243, 0x00, 1);
    write(0x0244, 0x00, 1);
    write(0x0245, 0x00, 1);
    write(0x0246, 0x00, 1);
    write(0x0247, 0x00, 1);
    write(0x0248, 0x00, 1);
    write(0x0249, 0x00, 1);
    write(0x024A, 0x00, 1);
    write(0x024B, 0x00, 1);
    write(0x024C, 0x00, 1);
    write(0x024D, 0x00, 1);
    write(0x024E, 0x00, 1);
    write(0x024F, 0x00, 1);
    write(0x0250, 0x00, 1);
    write(0x0251, 0x00, 1);
    write(0x0252, 0x00, 1);
    write(0x0253, 0x00, 1);
    write(0x0254, 0x00, 1);
    write(0x0255, 0x00, 1);
    write(0x0256, 0x00, 1);
    write(0x0257, 0x00, 1);
    write(0x0258, 0x00, 1);
    write(0x0259, 0x00, 1);
    write(0x025A, 0x00, 1);
    write(0x025B, 0x00, 1);
    write(0x025C, 0x00, 1);
    write(0x025D, 0x00, 1);
    write(0x025E, 0x00, 1);
    write(0x025F, 0x00, 1);
    write(0x0260, 0x00, 1);
    write(0x0261, 0x00, 1);
    write(0x0262, 0x00, 1);
    write(0x0263, 0x00, 1);
    write(0x0264, 0x00, 1);
    write(0x0265, 0x00, 1);
    write(0x0266, 0x00, 1);
    write(0x0267, 0x00, 1);
    write(0x0268, 0x00, 1);
    write(0x0269, 0x00, 1);
    write(0x026A, 0x00, 1);
    write(0x026B, 0x00, 1);
    write(0x026C, 0x00, 1);
    write(0x026D, 0x00, 1);
    write(0x026E, 0x00, 1);
    write(0x026F, 0x00, 1);
    write(0x0270, 0x00, 1);
    write(0x0271, 0x00, 1);
    write(0x0272, 0x00, 1);
    write(0x0273, 0x00, 1);
    write(0x0274, 0x00, 1);
    write(0x0275, 0x00, 1);
    write(0x0276, 0x00, 1);
    write(0x0277, 0x00, 1);
    write(0x0278, 0x00, 1);
    write(0x0279, 0x00, 1);
    write(0x027A, 0x00, 1);
    write(0x027B, 0x00, 1);
    write(0x027C, 0x00, 1);
    write(0x027D, 0x00, 1);
    write(0x027E, 0x00, 1);
    write(0x027F, 0x00, 1);
    write(0x0280, 0x00, 1);
    write(0x0281, 0x00, 1);
    write(0x0282, 0x00, 1);
    write(0x0283, 0x00, 1);
    write(0x0284, 0x00, 1);
    write(0x0285, 0x00, 1);
    write(0x0286, 0x00, 1);
    write(0x0287, 0x00, 1);
    write(0x0288, 0x00, 1);
    write(0x0289, 0x00, 1);
    write(0x028A, 0x00, 1);
    write(0x028B, 0x00, 1);
    write(0x028C, 0x00, 1);
    write(0x028D, 0x00, 1);
    write(0x028E, 0x00, 1);
    write(0x028F, 0x00, 1);
    write(0x0290, 0x00, 1);
    write(0x0291, 0x00, 1);
    write(0x0292, 0x00, 1);
    write(0x0293, 0x00, 1);
    write(0x0294, 0x00, 1);
    write(0x0295, 0x00, 1);
    write(0x0296, 0x00, 1);
    write(0x0297, 0x00, 1);
    write(0x0298, 0x00, 1);
    write(0x0299, 0x00, 1);
    write(0x029A, 0x00, 1);
    write(0x029B, 0x00, 1);
    write(0x029C, 0x00, 1);
    write(0x029D, 0x00, 1);
    write(0x029E, 0x00, 1);
    write(0x029F, 0x00, 1);
    write(0x02A0, 0x00, 1);
    write(0x02A1, 0x00, 1);
    write(0x02A2, 0x00, 1);
    write(0x02A3, 0x00, 1);
    write(0x02A4, 0x00, 1);
    write(0x02A5, 0x00, 1);
    write(0x02A6, 0x00, 1);
    write(0x02A7, 0x00, 1);
    write(0x02A8, 0x00, 1);
    write(0x02A9, 0x00, 1);
    write(0x02AA, 0x00, 1);
    write(0x02AB, 0x00, 1);
    write(0x02AC, 0x00, 1);
    write(0x02AD, 0x00, 1);
    write(0x02AE, 0x00, 1);
    write(0x02AF, 0x00, 1);
    write(0x02B0, 0x00, 1);
    write(0x02B1, 0x00, 1);
    write(0x02B2, 0x00, 1);
    write(0x02B3, 0x00, 1);
    write(0x02B4, 0x00, 1);
    write(0x02B5, 0x00, 1);
    write(0x02B6, 0x00, 1);
    write(0x02B7, 0x00, 1);
    write(0x02B8, 0x00, 1);
    write(0x02B9, 0x00, 1);
    write(0x02BA, 0x00, 1);
    write(0x02BB, 0x00, 1);
    write(0x02BC, 0x00, 1);
    write(0x02BD, 0x00, 1);
    write(0x02BE, 0x00, 1);
    write(0x02BF, 0x00, 1);
    write(0x02C0, 0x00, 1);
    write(0x02C1, 0x00, 1);
    write(0x02C2, 0x00, 1);
    write(0x02C3, 0x00, 1);
    write(0x02C4, 0x00, 1);
    write(0x02C5, 0x00, 1);
    write(0x02C6, 0x00, 1);
    write(0x02C7, 0x00, 1);
    write(0x02C8, 0x00, 1);
    write(0x02C9, 0x00, 1);
    write(0x02CA, 0x00, 1);
    write(0x02CB, 0x00, 1);
    write(0x02CC, 0x00, 1);
    write(0x02CD, 0x00, 1);
    write(0x02CE, 0x00, 1);
    write(0x02CF, 0x00, 1);
    write(0x02D0, 0x00, 1);
    write(0x02D1, 0x00, 1);
    write(0x02D2, 0x00, 1);
    write(0x02D3, 0x00, 1);
    write(0x02D4, 0x00, 1);
    write(0x02D5, 0x00, 1);
    write(0x02D6, 0x00, 1);
    write(0x02D7, 0x00, 1);
    write(0x02D8, 0x00, 1);
    write(0x02D9, 0x00, 1);
    write(0x02DA, 0x00, 1);
    write(0x02DB, 0x00, 1);
    write(0x02DC, 0x00, 1);
    write(0x02DD, 0x00, 1);
    write(0x02DE, 0x00, 1);
    write(0x02DF, 0x00, 1);
    write(0x02E0, 0x00, 1);
    write(0x02E1, 0x00, 1);
    write(0x02E2, 0x00, 1);
    write(0x02E3, 0x00, 1);
    write(0x02E4, 0x00, 1);
    write(0x02E5, 0x00, 1);
    write(0x02E6, 0x00, 1);
    write(0x02E7, 0x00, 1);
    write(0x02E8, 0x00, 1);
    write(0x02E9, 0x00, 1);
    write(0x02EA, 0x00, 1);
    write(0x02EB, 0x00, 1);
    write(0x02EC, 0x00, 1);
    write(0x02ED, 0x00, 1);
    write(0x02EE, 0x00, 1);
    write(0x02EF, 0x00, 1);
    write(0x02F0, 0x00, 1);
    write(0x02F1, 0x00, 1);
    write(0x02F2, 0x00, 1);
    write(0x02F3, 0x00, 1);
    write(0x02F4, 0x00, 1);
    write(0x02F5, 0x00, 1);
    write(0x02F6, 0x00, 1);
    write(0x02F7, 0x00, 1);
    write(0x02F8, 0x00, 1);
    write(0x02F9, 0x00, 1);
    write(0x02FA, 0x00, 1);
    write(0x02FB, 0x00, 1);
    write(0x02FC, 0x00, 1);
    write(0x02FD, 0x00, 1);
    write(0x02FE, 0x00, 1);
    write(0x02FF, 0x00, 1);
    
    // Write the tokenized BASIC program to the disk
    write(programStart, tokenizedBasic);
    
    // Write boot file content (CHAIN"PROGRAM")
    write(0x0200, 'CHAIN"PROGRAM"\r');
    
    // Write README file content
    write(0x0600, 'Created by 8bitworkshop\r');
    
    console.log(`BBCMicroPlatform: Created proper SSD with ${tokenizedBasic.length} bytes of tokenized BASIC as ${filename}`);
    return disk;
  }

  private createProperSSD(basicText: string, filename: string): Uint8Array {
    // Create a proper Acorn DFS SSD disk image following the owlet-editor format
    // Convert BASIC text to tokenized BBC BASIC format
    const basicBytes = this.tokenizeBasicProgram(basicText);
    console.log(`BBCMicroPlatform: Tokenized ${basicText.length} chars to ${basicBytes.length} bytes`);
    console.log(`BBCMicroPlatform: First 20 bytes:`, Array.from(basicBytes.slice(0, 20)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    
    // Create a 200KB disk image (80 tracks * 10 sectors * 256 bytes)
    const diskSize = 80 * 10 * 256;
    const disk = new Uint8Array(diskSize);
    
    // Initialize with zeros
    disk.fill(0);
    
    // Helper function to write data to disk (similar to owlet-editor)
    const write = (address: number, data: string | number | Uint8Array, length?: number) => {
      if (typeof data === 'string') {
        for (let i = 0; i < data.length; i++) {
          disk[address + i] = data.charCodeAt(i) & 0xff;
        }
      } else if (typeof data === 'number') {
        for (let b = 0; b < (length || 1); b++) {
          disk[address + b] = (data >> (b * 8)) & 0xff;
        }
      } else if (data instanceof Uint8Array) {
        for (let i = 0; i < data.length; i++) {
          disk[address + i] = data[i];
        }
      }
    };
    
    // Apply Acorn DFS format catalog (following owlet-editor exactly)
    write(0x0000, "BBCMICRO"); // DFS volume title
    
    // File entries (following owlet-editor pattern exactly)
    write(0x0008, "!BOOT  $"); // Boot file
    write(0x0010, "SCREEN $"); // Screen file  
    write(0x0018, "PROGRAM$"); // Program file (this is what we want to load)
    write(0x0020, "README $"); // Readme file
    
    // Catalog data at 0x0100
    write(0x0100, "BOT\0");
    write(0x0104, 0, 1); // BCD catalog cycle number
    write(0x0105, 0x20, 1); // Number of files << 3 (4 files = 32 = 0x20)
    write(0x0106, 0b00110000, 1); // *EXEC boot
    write(0x0107, 0x2003, 2); // Number of sectors in volume 0x0320
    
    // File catalog entries (following owlet-editor structure)
    // !BOOT file entry
    write(0x0108, 0x1900, 2); // Load address
    write(0x010a, 0x1900, 2); // Exec address  
    write(0x010c, 0x0f, 2); // File length (15 bytes)
    write(0x010e, 0x00, 1); // Extra info
    write(0x010f, 0x02, 1); // Start sector
    
    // SCREEN file entry
    write(0x0110, 0x3000, 2); // Load address
    write(0x0112, 0x0000, 2); // Exec address
    write(0x0114, 0x50, 2); // File length (80 bytes)
    write(0x0116, 0x0c, 1); // Extra info
    write(0x0117, 0x03, 1); // Start sector
    
    // PROGRAM file entry (our BASIC program)
    write(0x0118, 0x1900, 2); // Load address
    write(0x011a, 0x1900, 2); // Exec address
    write(0x011c, basicBytes.length, 2); // File length
    write(0x011e, 0x04, 1); // Extra info
    write(0x011f, 0x05, 1); // Start sector (sector 5)
    
    // README file entry
    write(0x0120, 0x0000, 2); // Load address
    write(0x0122, 0x0000, 2); // Exec address
    write(0x0124, 0x23, 2); // File length (35 bytes)
    write(0x0126, 0x00, 1); // Extra info
    write(0x0127, 0x06, 1); // Start sector
    
    // Write file data
    // !BOOT file (sector 2)
    write(0x0200, "CHAIN\"PROGRAM\"\r");
    
    // SCREEN file (sector 3-4) - screen data
    const screenData = new Uint8Array(0x50);
    screenData.fill(0x14); // Fill with a pattern
    write(0x0300, screenData);
    
    // PROGRAM file (sector 5) - our BASIC program
    write(0x0500, basicBytes);
    
    // README file (sector 6)
    write(0x0600, "Created by 8bitworkshop\r");
    
    console.log(`BBCMicroPlatform: Created proper SSD with ${basicBytes.length} bytes of BASIC program as ${filename}`);
    
    return disk;
  }

  private tokenizeBasicProgram(basicText: string): Uint8Array {
    // Simple BBC BASIC tokenization
    // This is a basic implementation - for production use, consider using a proper tokenizer
    
    const lines = basicText.split('\n');
    const tokenizedLines: Uint8Array[] = [];
    
    for (const line of lines) {
      if (line.trim() === '') continue;
      
      const tokenizedLine = this.tokenizeLine(line.trim());
      if (tokenizedLine.length > 0) {
        tokenizedLines.push(tokenizedLine);
      }
    }
    
    // Combine all tokenized lines
    const totalLength = tokenizedLines.reduce((sum, line) => sum + line.length, 0) + 1; // +1 for program terminator
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const line of tokenizedLines) {
      result.set(line, offset);
      offset += line.length;
    }
    
    // Add program terminator (0xFF)
    result[offset] = 0xFF;
    
    return result;
  }

  private tokenizeLine(line: string): Uint8Array {
    // BBC BASIC line tokenization
    // Format: [0x0D][line_number_low][line_number_high][line_length][tokenized_content]
    
    // Extract line number
    const match = line.match(/^(\d+)\s+(.*)$/);
    if (!match) return new Uint8Array(0);
    
    const lineNumber = parseInt(match[1]);
    const content = match[2];
    
    // Tokenize the content (basic keyword replacement)
    const tokenizedContent = this.tokenizeContent(content);
    
    // Calculate line length (content length)
    const lineLength = tokenizedContent.length;
    
    // Create the tokenized line
    const result = new Uint8Array(4 + lineLength);
    let offset = 0;
    
    // Line terminator (0x0D)
    result[offset++] = 0x0D;
    
    // Line number (2 bytes, big-endian)
    result[offset++] = (lineNumber >> 8) & 0xFF;
    result[offset++] = lineNumber & 0xFF;
    
    // Line length (1 byte)
    result[offset++] = lineLength;
    
    // Tokenized content
    for (let i = 0; i < tokenizedContent.length; i++) {
      result[offset++] = tokenizedContent[i];
    }
    
    return result;
  }

  private tokenizeContent(content: string): Uint8Array {
    // Basic keyword tokenization
    const keywords: { [key: string]: number } = {
      'REM': 0xF4,
      'MODE': 0xEB,
      'COLOUR': 0xFB,
      'PRINT': 0xF1,
      'GOTO': 0xE5,
      'RND': 0xB3,
      'IF': 0xE7,
      'THEN': 0x8C,
      'ELSE': 0x85,
      'END': 0xE0,
      'FOR': 0xE3,
      'NEXT': 0xED,
      'TO': 0xB8,
      'STEP': 0x88,
      'LET': 0xE9,
      'INPUT': 0xE8,
      'DATA': 0xDC,
      'READ': 0xE3,
      'RESTORE': 0x8B,
      'GOSUB': 0xE4,
      'RETURN': 0x8A,
      'STOP': 0xFA,
      'RUN': 0xF9,
      'NEW': 0xCA,
      'LOAD': 0xC8,
      'SAVE': 0xCD,
      'LIST': 0xC9,
      'CLEAR': 0xD8,
      'CLS': 0xDB,
      'CLG': 0xDA,
      'DRAW': 0xDF,
      'MOVE': 0xEC,
      'PLOT': 0xF0,
      'GCOL': 0xE6,
      'VDU': 0xEF,
      'SOUND': 0xD4,
      'ENVELOPE': 0xE2,
      'REPEAT': 0xF5,
      'UNTIL': 0xFD,
      'WHILE': 0xFE,
      'ENDWHILE': 0xFF,
      'PROC': 0xF2,
      'ENDPROC': 0xE1,
      'DEF': 0xDD,
      'FN': 0xA4,
      'LOCAL': 0xEA,
      'DIM': 0xDE,
      'ON': 0xEE,
      'ERROR': 0x85,
      'TRACE': 0xFC,
      'TIME': 0x91,
      'PAGE': 0x90,
      'PTR': 0x8F,
      'LOMEM': 0x92,
      'HIMEM': 0x93,
      'ABS': 0x94,
      'ACS': 0x95,
      'ADVAL': 0x96,
      'ASC': 0x97,
      'ASN': 0x98,
      'ATN': 0x99,
      'BGET': 0x9A,
      'COS': 0x9B,
      'COUNT': 0x9C,
      'DEG': 0x9D,
      'ERL': 0x9E,
      'ERR': 0x9F,
      'EVAL': 0xA0,
      'EXP': 0xA1,
      'EXT': 0xA2,
      'FALSE': 0xA3,
      'GET': 0xA5,
      'INKEY': 0xA6,
      'INSTR': 0xA7,
      'INT': 0xA8,
      'LEN': 0xA9,
      'LN': 0xAA,
      'LOG': 0xAB,
      'NOT': 0xAC,
      'OPENIN': 0x8E,
      'OPENOUT': 0xAE,
      'OPENUP': 0xAD,
      'PI': 0xAF,
      'POINT': 0xB0,
      'POS': 0xB1,
      'RAD': 0xB2,
      'RIGHT$': 0xC2,
      'SGN': 0xB4,
      'SIN': 0xB5,
      'SQR': 0xB6,
      'STR$': 0xC3,
      'STRING$': 0xC4,
      'TAN': 0xB7,
      'TRUE': 0xB9,
      'USR': 0xBA,
      'VAL': 0xBB,
      'VPOS': 0xBC,
      'CHR$': 0xBD,
      'GET$': 0xBE,
      'INKEY$': 0xBF,
      'LEFT$': 0xC0,
      'MID$': 0xC1
    };
    
    const result: number[] = [];
    let i = 0;
    
    while (i < content.length) {
      let found = false;
      
      // Check for keywords (case insensitive)
      for (const [keyword, token] of Object.entries(keywords)) {
        if (content.toUpperCase().substring(i, i + keyword.length) === keyword) {
          // Check if it's a whole word (not part of a longer word)
          const before = i === 0 ? ' ' : content[i - 1];
          const after = i + keyword.length >= content.length ? ' ' : content[i + keyword.length];
          const isWordBoundary = /[^A-Za-z0-9_$%]/.test(before) && /[^A-Za-z0-9_$%]/.test(after);
          
          if (isWordBoundary) {
            // Add space before token if there was one in original
            if (i > 0 && content[i - 1] === ' ') {
              result.push(0x20); // Space
            }
            result.push(token);
            // Add space after token if there was one in original
            if (i + keyword.length < content.length && content[i + keyword.length] === ' ') {
              result.push(0x20); // Space
            }
            i += keyword.length;
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        // Regular character
        result.push(content.charCodeAt(i));
        i++;
      }
    }
    
    return new Uint8Array(result);
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