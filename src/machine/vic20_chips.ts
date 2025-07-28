import { Machine, CpuState, EmuState } from '../common/baseplatform';

declare global {
  interface Window {
    vic20_chips_module?: any;
    Module?: any;
  }
}

export class VIC20ChipsMachine implements Machine {
  private module: any = null;
  private canvas: HTMLCanvasElement | null = null;
  private running = false;
  private name: string;
  private description: string;
  
  // CPU stub for interface compliance
  cpu = {
    getPC: () => 0,
    getSP: () => 0,
    isStable: () => true,
    saveState: () => ({ PC: 0, SP: 0 }),
    loadState: (state: any) => {},
    reset: () => {},
    connectMemoryBus: (bus: any) => {}
  };

  constructor() {
    this.name = "VIC-20 (chips-test)";
    this.description = "VIC-20 emulator using chips-test WebAssembly";
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  async init(): Promise<void> {
    try {
      console.log("Initializing chips-test VIC-20 emulator...");

      // Create canvas for the emulator
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'canvas';
      this.canvas.width = 800;
      this.canvas.height = 501;
      this.canvas.style.border = '1px solid #333';
      this.canvas.style.width = '100%';
      this.canvas.style.height = 'auto';
      this.canvas.style.maxWidth = '800px';
      this.canvas.style.maxHeight = '600px';
      
      // Add canvas to body temporarily
      document.body.appendChild(this.canvas);
      
      // Wait a bit for canvas to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Load the VIC-20 script
      const script = document.createElement('script');
      script.src = 'res/vic20.js';
      script.async = true;
      
      // Temporarily clear URL parameters to prevent the emulator from trying to load files on startup
      const originalSearch = window.location.search;
      const originalHref = window.location.href;
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      }
      
      script.onload = () => {
        console.log("VIC-20 script loaded");
        
        // Restore URL parameters if they were changed
        if (originalSearch && window.location.search !== originalSearch) {
          window.history.replaceState({}, '', originalHref);
        }
        
        // Wait for module to be ready
        setTimeout(() => {
          this.detectModule();
        }, 500);
      };
      
      script.onerror = (error) => {
        console.error("Failed to load VIC-20 script:", error);
        throw new Error("Failed to load VIC-20 script");
      };
      
      document.head.appendChild(script);
      
      // Add global debugging objects for console inspection first
      (window as any).VIC20_DEBUG = {
        module: this.module,
        canvas: this.canvas,
        machine: this,
        // Helper function to test with sample program data
        testWithSampleData: () => {
          // Create a simple VIC-20 BASIC program: 10 PRINT "HELLO"
          const basicProgram = new Uint8Array([
            0x18, 0x10,  // PRG header (load address 0x1001)
            0x0A, 0x00,  // Line 10
            0x99, 0x20, 0x22, 0x48, 0x45, 0x4C, 0x4C, 0x4F, 0x22, 0x00,  // PRINT "HELLO"
            0x00, 0x00   // End of program
          ]);
          console.log("Testing with sample BASIC program:", basicProgram);
          this.loadProgram(basicProgram);
        },
        // Helper function to list all Module functions
        listModuleFunctions: () => {
          if (typeof (window as any).Module !== 'undefined' && (window as any).Module) {
            const Module = (window as any).Module;
            console.log("All Module functions:", Object.keys(Module));
            return Object.keys(Module);
          } else {
            console.log("Module object not available");
            console.log("Checking if it's still loading...");
            // Try to wait a bit and check again
            setTimeout(() => {
              if (typeof (window as any).Module !== 'undefined' && (window as any).Module) {
                console.log("Module object now available after waiting!");
                const Module = (window as any).Module;
                console.log("All Module functions:", Object.keys(Module));
              } else {
                console.log("Module object still not available");
              }
            }, 1000);
            return [];
          }
        },
        // Helper function to wait for Module to be ready
        waitForModule: () => {
          return new Promise((resolve) => {
            const checkModule = () => {
              if (typeof (window as any).Module !== 'undefined' && (window as any).Module) {
                console.log("Module object is now available!");
                resolve((window as any).Module);
              } else {
                console.log("Module not ready yet, waiting...");
                setTimeout(checkModule, 100);
              }
            };
            checkModule();
          });
        },
        // Helper function to check what's available on window
        checkWindowObjects: () => {
          console.log("Checking all window objects...");
          const windowObjects = Object.keys(window).filter(key => 
            key.toLowerCase().includes('vic20') || 
            key.toLowerCase().includes('module') ||
            key.toLowerCase().includes('h') ||
            key.toLowerCase().includes('quickload') ||
            key.toLowerCase().includes('load')
          );
          console.log("Window objects with VIC-20/Module/load keywords:", windowObjects);
          
          // Also check for any function that might be the quickload function
          const allWindowKeys = Object.keys(window);
          const functionCandidates = allWindowKeys.filter(key => {
            const value = (window as any)[key];
            return typeof value === 'function' && (
              key.toLowerCase().includes('vic20') ||
              key.toLowerCase().includes('quickload') ||
              key.toLowerCase().includes('load') ||
              key.toLowerCase().includes('run')
            );
          });
          console.log("Function candidates on window:", functionCandidates);
          
          // Check what's in the 'h' object
          if ((window as any).h) {
            console.log("Found 'h' object:", (window as any).h);
            console.log("'h' object keys:", Object.keys((window as any).h));
            
            // Look for VIC-20 functions in the 'h' object
            const hKeys = Object.keys((window as any).h);
            const vic20Functions = hKeys.filter(key => 
              key.toLowerCase().includes('vic20') ||
              key.toLowerCase().includes('quickload') ||
              key.toLowerCase().includes('load') ||
              key.toLowerCase().includes('run')
            );
            console.log("VIC-20 functions in 'h' object:", vic20Functions);
            
            // Check if any of these are functions
            for (const funcName of vic20Functions) {
              const func = (window as any).h[funcName];
              if (typeof func === 'function') {
                console.log(`Found function: ${funcName}`, func);
              }
            }
            
            // Also check for drop-related functions
            const dropFunctions = hKeys.filter(key => 
              key.toLowerCase().includes('drop') ||
              key.toLowerCase().includes('snapshot') ||
              key.toLowerCase().includes('load')
            );
            console.log("Drop/Load functions in 'h' object:", dropFunctions);
            
            // Check if any of these are functions
            for (const funcName of dropFunctions) {
              const func = (window as any).h[funcName];
              if (typeof func === 'function') {
                console.log(`Found drop/load function: ${funcName}`, func);
              }
            }
            
            // Check for any function that might be the VIC-20 quickload
            const allFunctions = hKeys.filter(key => {
              const value = (window as any).h[key];
              return typeof value === 'function';
            });
            console.log("All functions in 'h' object:", allFunctions);
          }
          
          return { windowObjects, functionCandidates };
        },
        
        // Helper function to try calling the drop function directly
        tryDropFunction: (prgData: Uint8Array) => {
          console.log("Trying to call drop function directly...");
          
          if (!(window as any).h) {
            console.log("'h' object not available");
            return false;
          }
          
          const h = (window as any).h;
          
          // Try calling the complete drop sequence
          if (typeof h.__sapp_emsc_begin_drop === 'function' && 
              typeof h.__sapp_emsc_drop === 'function' && 
              typeof h.__sapp_emsc_end_drop === 'function') {
            console.log("Found complete drop sequence functions, trying to call them...");
            try {
              // Create a proper DataTransfer object
              const dataTransfer = new DataTransfer();
              const file = new File([prgData], 'program.prg', { type: 'application/octet-stream' });
              dataTransfer.items.add(file);
              
              // Create a mock drop event
              const mockEvent = {
                dataTransfer: dataTransfer
              };
              
              // Call the complete drop sequence
              h.__sapp_emsc_begin_drop(mockEvent);
              console.log("Called __sapp_emsc_begin_drop successfully");
              
              h.__sapp_emsc_drop(mockEvent);
              console.log("Called __sapp_emsc_drop successfully");
              
              h.__sapp_emsc_end_drop(mockEvent);
              console.log("Called __sapp_emsc_end_drop successfully");
              
              return true;
            } catch (error) {
              console.log("Error calling drop sequence:", error);
            }
          } else if (typeof h.__sapp_emsc_drop === 'function') {
            console.log("Found __sapp_emsc_drop function only, trying to call it...");
            try {
              // Create a proper DataTransfer object
              const dataTransfer = new DataTransfer();
              const file = new File([prgData], 'program.prg', { type: 'application/octet-stream' });
              dataTransfer.items.add(file);
              
              // Create a mock drop event
              const mockEvent = {
                dataTransfer: dataTransfer
              };
              h.__sapp_emsc_drop(mockEvent);
              console.log("Called __sapp_emsc_drop successfully");
              return true;
            } catch (error) {
              console.log("Error calling __sapp_emsc_drop:", error);
            }
          }
          
          // Try calling the snapshot callback
          if (typeof h._fs_emsc_load_snapshot_callback === 'function') {
            console.log("Found _fs_emsc_load_snapshot_callback function, trying to call it...");
            try {
              h._fs_emsc_load_snapshot_callback(prgData);
              console.log("Called _fs_emsc_load_snapshot_callback successfully");
              return true;
            } catch (error) {
              console.log("Error calling _fs_emsc_load_snapshot_callback:", error);
            }
          }
          
          console.log("No suitable drop function found");
          return false;
        }
      };
      
      console.log("VIC20_DEBUG object available in console for debugging");
      console.log("Use VIC20_DEBUG.testWithSampleData() to test with sample program");
      console.log("Use VIC20_DEBUG.listModuleFunctions() to see all available functions");
      console.log("Use VIC20_DEBUG.checkWindowObjects() to see what's available on window");
      console.log("Use VIC20_DEBUG.tryDropFunction(data) to try calling drop functions directly");
      
      // Wait for module to be detected
      await this.waitForModuleDetection();
      
    } catch (error) {
      console.error("Failed to initialize VIC-20 chips-test emulator:", error);
      throw error;
    }
  }

  private detectModule(): void {
    // Try to detect the module
    if (typeof (window as any).Module !== 'undefined' && (window as any).Module) {
      console.log("Found Module object, setting module reference");
      this.module = (window as any).Module;
      // Update the debug object
      (window as any).VIC20_DEBUG.module = this.module;
    } else if ((window as any).h) {
      console.log("Found 'h' object, using as module");
      this.module = (window as any).h;
      // Update the debug object
      (window as any).VIC20_DEBUG.module = this.module;
    } else {
      console.log("VIC-20 module detection failed, but emulator is running - using window fallback");
      this.module = window.vic20_chips_module;
    }
    
    console.log("VIC-20 chips-test emulator using window fallback - already running");
  }

  private async waitForModuleDetection(): Promise<void> {
    // Wait for module to be detected
    let attempts = 0;
    const maxAttempts = 20; // 2 seconds
    
    while (attempts < maxAttempts) {
      if (this.module || (window as any).Module || (window as any).h) {
        this.detectModule();
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      console.log("VIC-20 module detection timed out, but emulator should still work");
      this.detectModule();
    }
    
    // Skip calling the URL parameter parser for now since it causes DOM access issues
    // The emulator should work fine without it
    console.log("Skipping URL parameter parser to avoid DOM access issues");
  }

  run(): void {
    if (this.module && this.running) return;
    this.running = true;
    
    // The chips-test emulator runs automatically, we just need to ensure it's started
    if (this.module && typeof (this.module as any).vic20_run === 'function') {
      (this.module as any).vic20_run();
    } else if (typeof (window as any).vic20_run === 'function') {
      (window as any).vic20_run();
    }
  }

  stop(): void {
    this.running = false;
    // The chips-test emulator doesn't have a stop function, it runs continuously
    // We just mark it as not running
  }

  reset(): void {
    if (this.module && typeof (this.module as any).vic20_reset === 'function') {
      (this.module as any).vic20_reset();
    } else if (typeof (window as any).vic20_reset === 'function') {
      (window as any).vic20_reset();
    }
  }

  advanceFrame(trap: () => boolean): number {
    // The chips-test emulator runs automatically
    return 0;
  }

  loadROM(data: Uint8Array, title?: string): void {
    this.loadProgram(data);
  }

  loadControlsState(state: any): void {
    // No controls state for VIC-20 chips
  }

  saveControlsState(): any {
    return {};
  }

  loadProgram(program: Uint8Array): void {
    console.log("=== VIC-20 LOAD PROGRAM DEBUG ===");
    console.log("Input program length:", program.length, "bytes");
    console.log("Input program type:", typeof program);
    console.log("Input program constructor:", program.constructor.name);
    console.log("First 16 bytes (hex):", Array.from(program.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log("First 16 bytes (decimal):", Array.from(program.slice(0, 16)).join(' '));
    console.log("Full program data:", Array.from(program));
    
    // Check if this looks like a valid PRG file
    if (program.length >= 2) {
      const loadAddress = program[0] | (program[1] << 8);
      console.log("Detected load address:", `0x${loadAddress.toString(16).toUpperCase()} (${loadAddress})`);
      console.log("Expected VIC-20 load address should be 0x1001 (4097) or 0x1200 (4608)");
      
      if (loadAddress === 0x1001) {
        console.log("✅ Valid VIC-20 BASIC program detected");
      } else if (loadAddress === 0x1200) {
        console.log("✅ Valid VIC-20 machine code program detected");
      } else {
        console.log("⚠️ Unexpected load address - may not be a valid VIC-20 program");
      }
    }
    
    // Debug: Check what functions are available
    console.log("Available window functions:", Object.keys(window).filter(key => key.includes('vic20')));
    console.log("Available module functions:", this.module ? Object.keys(this.module).filter(key => key.includes('vic20')) : "No module");
    
    // Check if Module object has the function
    if (typeof (window as any).Module !== 'undefined' && (window as any).Module) {
      console.log("Module object available:", Object.keys((window as any).Module).filter(key => key.includes('vic20')));
      console.log("All Module functions:", Object.keys((window as any).Module).slice(0, 20)); // First 20 functions
    }
    
    // Check the Module object directly for VIC-20 functions
    if (typeof (window as any).Module !== 'undefined' && (window as any).Module) {
      const Module = (window as any).Module;
      console.log("Module object available:", Module);
      console.log("Module object functions:", Object.keys(Module).filter(key => 
        key.toLowerCase().includes('vic20') || 
        key.toLowerCase().includes('quickload') || 
        key.toLowerCase().includes('load') ||
        key.toLowerCase().includes('prg') ||
        key.toLowerCase().includes('run')
      ));
      
      // Look for any function that might be the quickload function
      const allKeys = Object.keys(Module);
      const quickloadCandidates = allKeys.filter(key => 
        key.toLowerCase().includes('quickload') || 
        key.toLowerCase().includes('load') || 
        key.toLowerCase().includes('prg') ||
        key.toLowerCase().includes('rom') ||
        key.toLowerCase().includes('vic20') ||
        key.toLowerCase().includes('run')
      );
      console.log("Quickload candidates:", quickloadCandidates);
      
      // Check if any of these are functions
      for (const candidate of quickloadCandidates) {
        const value = Module[candidate];
        if (typeof value === 'function') {
          console.log(`Found function: ${candidate}`, value);
        }
      }
    }
    
    // Convert to PRG format (2-byte header + program data)
    // Check if the program already has a PRG header (first two bytes are load address)
    let prgData: Uint8Array;
    
    if (program.length >= 2 && program[0] === 0x18 && program[1] === 0x10) {
      // Program already has PRG header, use as-is
      console.log("Program already has PRG header, using as-is");
      prgData = program;
    } else {
      // Add PRG header
      console.log("Adding PRG header to program");
      prgData = new Uint8Array(program.length + 2);
      prgData[0] = 0x18; // Load address low byte
      prgData[1] = 0x10; // Load address high byte (0x1018 for VIC-20 BASIC)
      prgData.set(program, 2);
    }
    
    console.log("PRG data length:", prgData.length);
    console.log("PRG header:", prgData[0], prgData[1]);
    console.log("First few bytes of program:", prgData.slice(0, 10));
    
    // Try multiple approaches to load the program
    
    // Approach 1: Try direct module call
    if (this.module && typeof (this.module as any).vic20_quickload === 'function') {
      console.log("Trying direct vic20_quickload call...");
      try {
        (this.module as any).vic20_quickload(prgData);
        console.log("Direct vic20_quickload call successful");
        return;
      } catch (error) {
        console.log("Direct vic20_quickload call failed:", error);
      }
    }
    
    // Approach 2: Try window object
    if (typeof (window as any).vic20_quickload === 'function') {
      console.log("Trying window.vic20_quickload call...");
      try {
        (window as any).vic20_quickload(prgData);
        console.log("Window vic20_quickload call successful");
        return;
      } catch (error) {
        console.log("Window vic20_quickload call failed:", error);
      }
    }
    
    // Approach 3: Try Module object
    if (typeof (window as any).Module !== 'undefined' && (window as any).Module) {
      const Module = (window as any).Module;
      if (typeof Module.vic20_quickload === 'function') {
        console.log("Trying Module.vic20_quickload call...");
        try {
          Module.vic20_quickload(prgData);
          console.log("Module vic20_quickload call successful");
          return;
        } catch (error) {
          console.log("Module vic20_quickload call failed:", error);
        }
      }
    }
    
    // Approach 4: Try calling the drop functions directly using the 'h' object
    console.log("Attempting to trigger drag-and-drop functionality using 'h' object");
    console.log("PRG data to load:", prgData);
    console.log("PRG data length:", prgData.length);
    console.log("First 10 bytes:", Array.from(prgData.slice(0, 10)));
    
    if ((window as any).h) {
      const h = (window as any).h;
      
      // Try the complete drop sequence first
      if (typeof h.__sapp_emsc_begin_drop === 'function' && 
          typeof h.__sapp_emsc_drop === 'function' && 
          typeof h.__sapp_emsc_end_drop === 'function') {
        console.log("Found complete drop sequence, calling all three functions...");
        try {
          // Create a proper DataTransfer object
          const dataTransfer = new DataTransfer();
          const file = new File([prgData], 'program.prg', { type: 'application/octet-stream' });
          dataTransfer.items.add(file);
          
          // Create a mock drop event
          const mockEvent = {
            dataTransfer: dataTransfer
          };
          
          // Call the complete drop sequence
          h.__sapp_emsc_begin_drop(mockEvent);
          console.log("Called __sapp_emsc_begin_drop successfully");
          
          h.__sapp_emsc_drop(mockEvent);
          console.log("Called __sapp_emsc_drop successfully");
          
          h.__sapp_emsc_end_drop(mockEvent);
          console.log("Called __sapp_emsc_end_drop successfully");
          
          // Try to trigger a RUN command after a short delay
          setTimeout(() => {
            console.log("Attempting to trigger RUN command after drop sequence");
            
            // Try multiple possible run function names
            const runFunctions = [
              'vic20_run', 'vic20_run_program', 'run', 'run_program', 
              'execute', 'execute_program', 'start_program', 'load_and_run'
            ];
            
            let runFunctionFound = false;
            
            // Try on module first
            if (this.module) {
              for (const funcName of runFunctions) {
                if (typeof (this.module as any)[funcName] === 'function') {
                  console.log(`Found run function on module: ${funcName}`);
                  (this.module as any)[funcName]();
                  runFunctionFound = true;
                  break;
                }
              }
            }
            
            // Try on window
            if (!runFunctionFound) {
              for (const funcName of runFunctions) {
                if (typeof (window as any)[funcName] === 'function') {
                  console.log(`Found run function on window: ${funcName}`);
                  (window as any)[funcName]();
                  runFunctionFound = true;
                  break;
                }
              }
            }
            
            // Try on 'h' object
            if (!runFunctionFound && (window as any).h) {
              const h = (window as any).h;
              for (const funcName of runFunctions) {
                if (typeof h[funcName] === 'function') {
                  console.log(`Found run function on 'h' object: ${funcName}`);
                  h[funcName]();
                  runFunctionFound = true;
                  break;
                }
              }
            }
            
            if (!runFunctionFound) {
              console.log("No run function found. Available functions on 'h' object:", Object.keys((window as any).h || {}));
            }
          }, 500);
          
          return;
        } catch (error) {
          console.log("Error calling complete drop sequence:", error);
        }
      } else if (typeof h.__sapp_emsc_drop === 'function') {
        console.log("Found __sapp_emsc_drop only, calling it...");
        try {
          // Create a proper DataTransfer object
          const dataTransfer = new DataTransfer();
          const file = new File([prgData], 'program.prg', { type: 'application/octet-stream' });
          dataTransfer.items.add(file);
          
          // Create a mock drop event
          const mockEvent = {
            dataTransfer: dataTransfer
          };
          h.__sapp_emsc_drop(mockEvent);
          console.log("Called __sapp_emsc_drop successfully");
          
          // Try to trigger a RUN command after a short delay
          setTimeout(() => {
            console.log("Attempting to trigger RUN command after drop");
            
            // Try multiple possible run function names
            const runFunctions = [
              'vic20_run', 'vic20_run_program', 'run', 'run_program', 
              'execute', 'execute_program', 'start_program', 'load_and_run'
            ];
            
            let runFunctionFound = false;
            
            // Try on module first
            if (this.module) {
              for (const funcName of runFunctions) {
                if (typeof (this.module as any)[funcName] === 'function') {
                  console.log(`Found run function on module: ${funcName}`);
                  (this.module as any)[funcName]();
                  runFunctionFound = true;
                  break;
                }
              }
            }
            
            // Try on window
            if (!runFunctionFound) {
              for (const funcName of runFunctions) {
                if (typeof (window as any)[funcName] === 'function') {
                  console.log(`Found run function on window: ${funcName}`);
                  (window as any)[funcName]();
                  runFunctionFound = true;
                  break;
                }
              }
            }
            
            // Try on 'h' object
            if (!runFunctionFound && (window as any).h) {
              const h = (window as any).h;
              for (const funcName of runFunctions) {
                if (typeof h[funcName] === 'function') {
                  console.log(`Found run function on 'h' object: ${funcName}`);
                  h[funcName]();
                  runFunctionFound = true;
                  break;
                }
              }
            }
            
            if (!runFunctionFound) {
              console.log("No run function found. Available functions on 'h' object:", Object.keys((window as any).h || {}));
            }
          }, 500);
          
          return;
        } catch (error) {
          console.log("Error calling __sapp_emsc_drop:", error);
        }
      }
    }
    
    // Fallback: Try the original drag-and-drop event approach
    console.log("Falling back to original drag-and-drop event approach");
    
    // Create a File object from the PRG data
    const file = new File([prgData], 'program.prg', { type: 'application/octet-stream' });
    console.log("Created file object:", file);
    console.log("File size:", file.size);
    
    // Create a drop event
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true
    });
    
    // Set the dataTransfer property directly
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: dataTransfer,
      writable: false
    });
    
    // Dispatch the drop event on the canvas
    if (this.canvas) {
      console.log("Dispatching drop event on canvas:", this.canvas);
      this.canvas.dispatchEvent(dropEvent);
      
      // Try to trigger a RUN command after a short delay
      setTimeout(() => {
        console.log("Attempting to trigger RUN command");
        
        // Try multiple possible run function names
        const runFunctions = [
          'vic20_run', 'vic20_run_program', 'run', 'run_program', 
          'execute', 'execute_program', 'start_program', 'load_and_run'
        ];
        
        let runFunctionFound = false;
        
        // Try on module first
        if (this.module) {
          for (const funcName of runFunctions) {
            if (typeof (this.module as any)[funcName] === 'function') {
              console.log(`Found run function on module: ${funcName}`);
              (this.module as any)[funcName]();
              runFunctionFound = true;
              break;
            }
          }
        }
        
        // Try on window
        if (!runFunctionFound) {
          for (const funcName of runFunctions) {
            if (typeof (window as any)[funcName] === 'function') {
              console.log(`Found run function on window: ${funcName}`);
              (window as any)[funcName]();
              runFunctionFound = true;
              break;
            }
          }
        }
        
        // Try on 'h' object
        if (!runFunctionFound && (window as any).h) {
          const h = (window as any).h;
          for (const funcName of runFunctions) {
            if (typeof h[funcName] === 'function') {
              console.log(`Found run function on 'h' object: ${funcName}`);
              h[funcName]();
              runFunctionFound = true;
              break;
            }
          }
        }
        
        if (!runFunctionFound) {
          console.log("No run function found. Available functions on 'h' object:", Object.keys((window as any).h || {}));
        }
      }, 100);
    }
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  getFPS(): number {
    return 60; // VIC-20 runs at 60 FPS
  }

  read(address: number): number {
    if (this.module && this.module.vic20_read_memory) {
      return this.module.vic20_read_memory(address);
    }
    return 0;
  }

  write(address: number, value: number): void {
    if (this.module && this.module.vic20_write_memory) {
      this.module.vic20_write_memory(address, value);
    }
  }

  getCPUState(): CpuState {
    return {
      PC: 0,
      SP: 0
    };
  }

  saveState(): EmuState {
    if (this.module && this.module.vic20_save_state) {
      const state = this.module.vic20_save_state();
      return { c: { PC: 0, SP: 0 }, b: state };
    }
    return { c: { PC: 0, SP: 0 }, b: null };
  }

  loadState(state: EmuState): void {
    if (this.module && this.module.vic20_load_state && state.b) {
      this.module.vic20_load_state(state.b);
    }
  }

  destroy(): void {
    this.running = false;
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.module = null;
  }

  // Joystick support
  private joymask0 = 0;
  private joymask1 = 0;

  setKeyInput(key: number, code: number, flags: number): void {
    // Handle joystick input for VIC-20
    if (key == 16 || key == 17 || key == 18 || key == 224) return; // meta keys
    
    var mask = 0;
    var mask2 = 0;
    
    // Player 1 joystick (arrow keys + space)
    if (key == 37) { key = 0x8; mask = 0x4; } // LEFT
    if (key == 38) { key = 0xb; mask = 0x1; } // UP
    if (key == 39) { key = 0x9; mask = 0x8; } // RIGHT
    if (key == 40) { key = 0xa; mask = 0x2; } // DOWN
    if (key == 32) { mask = 0x10; } // FIRE (space)
    
    // Player 2 joystick (WASD + E)
    if (key == 65) { key = 65; mask2 = 0x4; } // LEFT (A)
    if (key == 87) { key = 87; mask2 = 0x1; } // UP (W)
    if (key == 68) { key = 68; mask2 = 0x8; } // RIGHT (D)
    if (key == 83) { key = 83; mask2 = 0x2; } // DOWN (S)
    if (key == 69) { mask2 = 0x10; } // FIRE (E)
    
    // Function keys
    if (key == 113) { key = 0xf1; } // F2
    if (key == 115) { key = 0xf3; } // F4
    if (key == 119) { key = 0xf5; } // F8
    if (key == 121) { key = 0xf7; } // F10
    
    if (flags & 1) { // KeyDown
      this.joymask0 |= mask;
      this.joymask1 |= mask2;
    } else if (flags & 2) { // KeyUp
      this.joymask0 &= ~mask;
      this.joymask1 &= ~mask2;
    }
    
    // Update joystick state in the chips-test emulator
    if (this.module && typeof this.module.vic20_joystick === 'function') {
      this.module.vic20_joystick(this.joymask0, this.joymask1);
    } else if ((window as any).h && typeof (window as any).h.vic20_joystick === 'function') {
      (window as any).h.vic20_joystick(this.joymask0, this.joymask1);
    }
  }

  // Simulate keyboard input for typing commands
  private simulateKeyboardInput(text: string): void {
    if (!(window as any).h) return;
    
    const h = (window as any).h;
    
    // Try to find keyboard input functions
    const keyboardFunctions = [
      'keyboard_input', 'key_input', 'type_text', 'send_text',
      'vic20_keyboard', 'keyboard_send', 'input_text'
    ];
    
    for (const funcName of keyboardFunctions) {
      if (typeof h[funcName] === 'function') {
        console.log(`Found keyboard function: ${funcName}`);
        try {
          h[funcName](text);
          console.log(`Successfully called ${funcName} with "${text}"`);
          return;
        } catch (error) {
          console.log(`Error calling ${funcName}:`, error);
        }
      }
    }
    
    // If no keyboard function found, try to simulate individual key presses
    console.log("No keyboard function found, trying individual key simulation...");
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      this.simulateKeyPress(char);
    }
  }

  // Simulate individual key press
  private simulateKeyPress(keyCode: number): void {
    if (!(window as any).h) return;
    
    const h = (window as any).h;
    
    // Try different key press functions
    const keyFunctions = [
      'key_press', 'key_down', 'keyboard_key', 'send_key',
      'vic20_key', 'key_input', 'input_key'
    ];
    
    for (const funcName of keyFunctions) {
      if (typeof h[funcName] === 'function') {
        try {
          h[funcName](keyCode);
          console.log(`Successfully called ${funcName} with key ${keyCode}`);
          return;
        } catch (error) {
          console.log(`Error calling ${funcName}:`, error);
        }
      }
    }
    
    console.log(`No key function found for key ${keyCode}`);
  }
} 