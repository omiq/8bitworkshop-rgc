import { Platform } from '../common/baseplatform';
import { BBCMicroMachine } from '../machine/bbc';
import { PLATFORMS } from '../common/emu';
import { AcornDFSdisc } from './AcornDFSdisc';

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
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.endsWith('.bas')) return 'bbcbasic';
    if (lowerFilename.endsWith('.c')) return 'cc65';
    if (lowerFilename.endsWith('.asm') || lowerFilename.endsWith('.s')) return 'ca65';
    if (lowerFilename.endsWith('.dasm')) return 'dasm';
    return 'cc65'; // default
  }

  getDefaultExtension(): string {
    return '.c';
  }

      getPresets(): any[] {
        return [
            { id: 'bbc_skeleton.bas', name: 'BBC BASIC Skeleton', category: 'BASIC' },
            { id: 'bbc_hello.bas', name: 'Hello World (BASIC)', category: 'BASIC' },
            { id: 'bbc_labels.bas', name: 'Labels and Subroutines (BASIC)', category: 'BASIC' },
            { id: 'bbc_input.bas', name: 'Keyboard Input and Movement (BASIC)', category: 'BASIC' },
            { id: 'bbc_textformat.bas', name: 'Text Formatting (BASIC)', category: 'BASIC' },
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
      // Extract model parameter from main page URL (available for both BASIC and C programs)
      const mainUrlParams = new URLSearchParams(window.location.search);
      const modelParam = mainUrlParams.get('model');
      const modelQuery = modelParam ? `&model=${encodeURIComponent(modelParam)}` : '';
      
      // Check if this is BBC BASIC (raw text) or compiled C code
      const isBasicProgram = this.isBasicProgram(rom);
      
      if (isBasicProgram) {
        console.log("BBCMicroPlatform: BBC BASIC program detected");
        
        // Convert bytes back to text for BASIC programs
        const basicText = new TextDecoder().decode(rom);
        const encodedBasic = encodeURIComponent(basicText);
        
        // Check if the URL would be too long (limit to ~1500 chars to be safe)
        const iframeURL = `bbc-iframe.html?embedBasic=${encodedBasic}&t=${Date.now()}${modelQuery}`;
        
        if (iframeURL.length > 1500) {
          console.log("BBCMicroPlatform: BASIC program too long for URL, using postMessage approach");
          // For long programs, use postMessage to send the BASIC text
          const baseURL = `bbc-iframe.html?t=${Date.now()}${modelQuery}`;
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
        
        // Load the iframe with just the base URL (including model parameter)
        const baseURL = `bbc-iframe.html?t=${Date.now()}${modelQuery}`;
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
      // Check if the extracted BASIC is complete by looking for the program terminator
      if (tokenizedBasic[tokenizedBasic.length - 1] === 0xFF) {
        console.log('BBCMicroPlatform: Extracted BASIC appears complete (ends with 0xFF)');
        const ssdData = this.createProperSSDWithTokenizedBasic(tokenizedBasic, filename);
        return {
          extension: '.ssd',
          blob: new Blob([ssdData], { type: 'application/octet-stream' })
        };
      } else {
        console.log('BBCMicroPlatform: Extracted BASIC appears incomplete, falling back to custom tokenizer');
      }
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
      
      // Log all available objects to understand the jsbeeb structure
      console.log('BBCMicroPlatform: All jsbeeb window objects:', Object.keys(jsbeebWindow));
      
      // Check for processor with multiple possible names
      let processor = jsbeebWindow.processor || jsbeebWindow.cpu || jsbeebWindow.emulator;
      if (!processor) {
        console.log('BBCMicroPlatform: No processor found in jsbeeb (tried processor, cpu, emulator)');
        console.log('BBCMicroPlatform: Available objects:', Object.keys(jsbeebWindow).filter(k => k.includes('proc') || k.includes('cpu') || k.includes('emu')));
        
        // Try to access through document or other global objects
        if (jsbeebWindow.document) {
          console.log('BBCMicroPlatform: Document found, checking for global objects');
          const globalObjects = Object.keys(jsbeebWindow.document.defaultView || {});
          console.log('BBCMicroPlatform: Global objects:', globalObjects.filter(k => k.includes('proc') || k.includes('cpu') || k.includes('emu')));
        }
        
        // Try to find processor in nested objects
        for (const key of Object.keys(jsbeebWindow)) {
          const obj = jsbeebWindow[key];
          if (obj && typeof obj === 'object') {
            if (obj.processor || obj.cpu || obj.emulator) {
              console.log(`BBCMicroPlatform: Found processor in ${key}:`, Object.keys(obj));
              processor = obj.processor || obj.cpu || obj.emulator;
              break;
            }
            // Check for readmem function which indicates a processor
            if (typeof obj.readmem === 'function') {
              console.log(`BBCMicroPlatform: Found readmem function in ${key}`);
              processor = obj;
              break;
            }
          }
        }
        
        if (!processor) {
          console.log('BBCMicroPlatform: Still no processor found after deep search');
          return null;
        }
      }
      
      // Read the BASIC program from memory
      // The program is stored starting at the page indicated by 0x18
      const page = processor.readmem(0x18) << 8;
      const top = (processor.readmem(0x02) | (processor.readmem(0x03) << 8));
      console.log(`BBCMicroPlatform: Memory page: 0x${page.toString(16)}, top: 0x${top.toString(16)}`);
      
      if (page === 0 || top === 0) {
        console.log('BBCMicroPlatform: No BASIC program in memory');
        return null;
      }
      
      const programLength = top - page;
      console.log(`BBCMicroPlatform: Program length: ${programLength} bytes`);
      if (programLength <= 0 || programLength > 8000) {
        console.log('BBCMicroPlatform: Invalid program length:', programLength);
        return null;
      }
      
      // Extract the tokenized BASIC program
      const tokenizedBasic = new Uint8Array(programLength);
      for (let i = 0; i < programLength; i++) {
        tokenizedBasic[i] = processor.readmem(page + i);
      }
      
    console.log(`BBCMicroPlatform: Extracted ${programLength} bytes of tokenized BASIC from emulator memory`);
    console.log('BBCMicroPlatform: First 20 bytes of extracted BASIC:', Array.from(tokenizedBasic.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('BBCMicroPlatform: Last 20 bytes of extracted BASIC:', Array.from(tokenizedBasic.slice(-20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    return tokenizedBasic;
      
    } catch (error) {
      console.log('BBCMicroPlatform: Error extracting tokenized BASIC:', error);
      return null;
    }
  }

  private createProperSSDWithTokenizedBasic(tokenizedBasic: Uint8Array, filename: string): Uint8Array {
    // Use the exact same AcornDFSdisc class as owlet-editor
    console.log(`BBCMicroPlatform: Creating SSD with ${tokenizedBasic.length} bytes of tokenized BASIC using AcornDFSdisc`);
    
    const disc = new AcornDFSdisc();
    
    // Add files in the same order as owlet-editor
    disc.save("README", "Created by BBC BASIC\r", 0x0000, 0x0000);
    disc.save("PROGRAM", tokenizedBasic, 0x1900, 0x1900);
    disc.save("SCREEN", new Uint8Array(0x5000), 0xffff3000, 0x0000); // Empty screen dump
    disc.save("!BOOT", 'CHAIN"PROGRAM"\r', 0x1900, 0x1900);
    
    return disc.image;
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