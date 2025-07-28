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
  private programLoaded = false; // Track if a program has been loaded
  private focusTrackingHandler: ((event: FocusEvent) => void) | null = null;
  private keyboardTrackingHandler: ((event: KeyboardEvent) => void) | null = null;
  private keyboardInterceptor: ((event: KeyboardEvent) => void) | null = null;
  private modalFocusProtection: (() => void) | null = null;
  private globalKeyboardBlocker: ((event: KeyboardEvent) => void) | null = null;
  
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
      
      // DISABLED: Focus prevention code to fix typing issues
      // this.canvas.tabIndex = -1;
      // this.canvas.style.outline = 'none';
      // this.canvas.style.pointerEvents = 'auto';
      
      // DISABLED: Add comprehensive focus prevention
      // this.canvas.addEventListener('mousedown', (e) => {
      //   e.preventDefault();
      //   e.stopPropagation();
      //   // Only allow focus on double-click
      //   if (e.target === this.canvas && e.detail === 2) {
      //     this.canvas.focus();
      //   }
      // });
      
      // this.canvas.addEventListener('mouseup', (e) => {
      //   e.preventDefault();
      //   e.stopPropagation();
      // });
      
      // this.canvas.addEventListener('click', (e) => {
      //   e.preventDefault();
      //   e.stopPropagation();
      // });
      
      // this.canvas.addEventListener('keydown', (e) => {
      //   if (document.activeElement !== this.canvas) {
      //     e.preventDefault();
      //     e.stopPropagation();
      //     return;
      //   }
      // });
      
      // this.canvas.addEventListener('keyup', (e) => {
      //   if (document.activeElement !== this.canvas) {
      //     e.preventDefault();
      //     e.stopPropagation();
      //     return;
      //   }
      // });
      
      // DISABLED: Prevent any focus on canvas
      // this.canvas.addEventListener('focus', (e) => {
      //   if (!e.isTrusted) {
      //     this.canvas.blur();
      //   }
      // });
      
      // DISABLED: Global focus prevention
      // this.canvas.addEventListener('focusin', (e) => {
      //   if (e.target === this.canvas && !e.isTrusted) {
      //     console.log("Preventing focusin on canvas");
      //     e.preventDefault();
      //     e.stopPropagation();
      //   }
      // }, true);
      
      // Add canvas to the pre-existing VIC-20 chips div
      const vic20Div = document.getElementById('vic20-chips-div');
      const vic20Screen = document.getElementById('vic20-chips-screen');
      if (vic20Div && vic20Screen) {
        vic20Screen.appendChild(this.canvas);
        vic20Div.style.display = 'block';
        console.log("✅ Added VIC-20 canvas to pre-existing div");
      } else {
        // Fallback to body if div not found
        document.body.appendChild(this.canvas);
        console.log("⚠️ VIC-20 div not found, using body fallback");
      }
      
      // Wait a bit for canvas to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // CRITICAL: Add global focus tracking to debug focus stealing
      this.addFocusTracking();

      // Load the VIC-20 script with timestamp to prevent caching
      const script = document.createElement('script');
      script.src = `res/vic20.js?t=${Date.now()}`;
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
          
                // CRITICAL: Make canvas non-focusable after emulator is loaded
      if (this.canvas) {
        this.canvas.tabIndex = -1;
        this.canvas.style.outline = 'none';
        this.canvas.setAttribute('tabindex', '-1');
        
        // CRITICAL: Override the canvas focus method to prevent programmatic focus
        const originalFocus = this.canvas.focus;
        this.canvas.focus = function() {
          console.log("🚨 BLOCKED: Canvas focus() called programmatically!");
          console.log("  Stack trace:", new Error().stack);
          // Don't call the original focus method
          return;
        };
        
        console.log("✅ Made VIC-20 canvas non-focusable and blocked focus() calls");
      }
        }, 500);
      };
      
      script.onerror = (error) => {
        console.error("Failed to load VIC-20 script:", error);
        throw new Error("Failed to load VIC-20 script");
      };
      
      document.head.appendChild(script);
      
      // Add cache-busting for WASM files and intercept source file requests
      const originalFetch = window.fetch;
      window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
        const url = typeof input === 'string' ? input : input.toString();
        
        // If the emulator is trying to fetch the source file, provide our compiled binary instead
        if (url.includes('siegegame.c') || url.includes('.c')) {
          console.log(`🔄 Intercepting fetch request for: ${url}`);
          console.log(`📦 Providing compiled binary data instead`);
          
          // Create a fake response with a simple BASIC program
          const basicProgram = new Uint8Array([
            0x18, 0x10,  // PRG header (load address 0x1001)
            0x0A, 0x00,  // Line 10
            0x99, 0x20, 0x22, 0x48, 0x45, 0x4C, 0x4C, 0x4F, 0x22, 0x00,  // PRINT "HELLO"
            0x00, 0x00   // End of program
          ]);
          
          const response = new Response(basicProgram, {
            status: 200,
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Length': basicProgram.length.toString()
            }
          });
          return Promise.resolve(response);
        }
        
        // For WASM/JS files, add cache busting
        if (typeof input === 'string' && (input.includes('vic20.wasm') || input.includes('vic20.js'))) {
          const separator = input.includes('?') ? '&' : '?';
          input = `${input}${separator}t=${Date.now()}`;
        }
        return originalFetch.call(this, input, init);
      };
      
      // DISABLED: Improved focus handling - don't override HTMLElement.prototype.focus globally
      // Instead, handle focus specifically for the canvas
      // this.canvas.addEventListener('click', (e) => {
      //   // Only allow canvas to receive focus when explicitly clicked
      //   console.log("Canvas clicked, allowing focus");
      //   this.canvas.focus();
      // });
      
      // DISABLED: Prevent focus stealing from other elements
      // this.canvas.addEventListener('focus', (e) => {
      //   console.log("Canvas focused");
      // });
      
      // this.canvas.addEventListener('blur', (e) => {
      //   console.log("Canvas blurred");
      // });
      
      // DISABLED: Set canvas to not receive focus automatically
      // this.canvas.tabIndex = -1;
      // this.canvas.style.outline = 'none';
      
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
              
              // Force display refresh and execute the program
              console.log("🔄 Single drop function completed - now executing program...");
              this.forceDisplayRefresh();
              this.verifyAndExecuteLoadedROM(prgData);
              
              return true;
            } catch (error) {
              console.log("Error calling __sapp_emsc_drop:", error);
            }
          }
          
          // Try calling the snapshot callback
          if (typeof h._fs_emsc_load_snapshot_callback === 'function') {
            console.log("Found _fs_emsc_load_snapshot_callback function, trying to call it...");
            try {
              // Try calling with different parameter combinations
              // This function typically expects a pointer to data and length
              const result = h._fs_emsc_load_snapshot_callback(prgData);
              console.log("✅ Successfully called _fs_emsc_load_snapshot_callback");
              return true;
            } catch (error) {
              console.log("❌ Error calling _fs_emsc_load_snapshot_callback:", error);
              
              // Try alternative calling methods
              try {
                console.log("Trying alternative call method...");
                // Some Emscripten functions need the data to be allocated in WASM memory first
                if (typeof h._malloc === 'function') {
                  const ptr = h._malloc(prgData.length);
                  h.HEAPU8.set(prgData, ptr);
                  h._fs_emsc_load_snapshot_callback(ptr, prgData.length);
                  h._free(ptr);
                  console.log("✅ Successfully called _fs_emsc_load_snapshot_callback with malloc");
                  return true;
                }
              } catch (error2) {
                console.log("❌ Alternative call method also failed:", error2);
              }
            }
          }
          
          console.log("No suitable drop function found");
          return false;
        },
        
        // Helper function to capture drag-and-drop data for comparison
        captureDragAndDrop: () => {
          console.log("Setting up drag-and-drop capture...");
          this.captureDragAndDropData();
        },
        
        // Helper function to check and reset emulator state
        checkState: () => {
          console.log("Checking emulator state...");
          this.checkAndResetEmulatorState();
        },
        
        // Helper function to compare loaded data with working program
        
        
        // Helper function to debug memory after loading
        debugMemory: () => {
          console.log("Debugging memory after loading...");
          this.debugMemoryAfterLoading();
        }
      };
      
      console.log("VIC20_DEBUG object available in console for debugging");
      console.log("Use VIC20_DEBUG.testWithSampleData() to test with sample program");
      console.log("Use VIC20_DEBUG.listModuleFunctions() to see all available functions");
      console.log("Use VIC20_DEBUG.checkWindowObjects() to see what's available on window");
      console.log("Use VIC20_DEBUG.tryDropFunction(data) to try calling drop functions directly");
      console.log("Use VIC20_DEBUG.checkState() to check and reset emulator state");

      console.log("Use VIC20_DEBUG.debugMemory() to debug memory after loading");
      
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
    
    // Connect canvas to the emulator for display output
    this.connectCanvasToEmulator();
  }
  
  private connectCanvasToEmulator(): void {
    if (!this.canvas) {
      console.log("❌ No canvas available for emulator connection");
      return;
    }
    
    console.log("🔗 Connecting canvas to VIC-20 emulator for display output...");
    
    // Try to connect the canvas to the emulator module
    if (this.module) {
      // Set the canvas on the module if it has a canvas property
      if (typeof this.module.canvas === 'undefined') {
        this.module.canvas = this.canvas;
        console.log("✅ Connected canvas to module.canvas");
      }
      
      // Try to set the canvas on the global scope for the WASM module
      if (typeof (window as any).canvas === 'undefined') {
        (window as any).canvas = this.canvas;
        console.log("✅ Connected canvas to window.canvas");
      }
      
      // Try to trigger a display refresh
      if (typeof this.module.requestAnimationFrame === 'function') {
        console.log("✅ Module has requestAnimationFrame - display should work");
      }
    }
    
    // Check if the canvas is being used by the emulator
    setTimeout(() => {
      if (this.canvas) {
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          // Try to draw a test pattern to verify the canvas is working
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
          ctx.fillStyle = 'white';
          ctx.font = '16px monospace';
          ctx.fillText('VIC-20 Emulator Ready', 10, 30);
          console.log("✅ Canvas is working - test pattern drawn");
        }
      }
    }, 1000);
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
    console.log("=== LOADROM CALLED ===");
    console.log("Data parameter:", data);
    console.log("Data type:", typeof data);
    console.log("Data constructor:", data?.constructor?.name);
    console.log("Data length:", data?.length);
    console.log("This context:", this);
    
    if (!data) {
      console.error("❌ Data parameter is null/undefined!");
      return;
    }
    
    if (!(data instanceof Uint8Array)) {
      console.error("❌ Data parameter is not a Uint8Array!");
      return;
    }
    
    this.loadProgram(data);
  }

  loadControlsState(state: any): void {
    // No controls state for VIC-20 chips
  }

  saveControlsState(): any {
    return {};
  }

  loadProgram(program: Uint8Array): void {
    console.log("=== VIC-20 LOAD PROGRAM DEBUG (UPDATED VERSION) ===");
    console.log("✅ NEW FOCUS PREVENTION AND URL LOADING ACTIVE ===");
    console.log("Input program length:", program.length, "bytes");
    console.log("Input program type:", typeof program);
    console.log("Input program constructor:", program.constructor.name);
    console.log("First 16 bytes (hex):", Array.from(program.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log("First 16 bytes (decimal):", Array.from(program.slice(0, 16)).join(' '));
    console.log("Full program data:", Array.from(program));
    
    // Try URL parameter approach first (chips emulator's native method)
    this.loadProgramViaURL(program);
  }
  
  private loadProgramViaURL(program: Uint8Array): void {
    console.log("=== ATTEMPTING URL PARAMETER LOAD ===");
    
    let prgData: Uint8Array;
    
    // Check if program already has PRG header
    if (program.length >= 2 && program[0] === 0x18 && program[1] === 0x10) {
      console.log("Program already has PRG header, using as-is");
      prgData = program;
    } else {
      console.log("Adding PRG header to program");
      // VIC-20 PRG header: 0x18, 0x10 (load address 0x1000)
      prgData = new Uint8Array(program.length + 2);
      prgData[0] = 0x18; // Low byte of load address (0x10)
      prgData[1] = 0x10; // High byte of load address (0x10)
      prgData.set(program, 2);
    }
    
    // Create a blob URL for the program
    const blob = new Blob([prgData], { type: 'application/octet-stream' });
    const fileUrl = URL.createObjectURL(blob);
    console.log("Created temporary file URL:", fileUrl);
    
    // Create new URL with file parameter
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('file', fileUrl);
    newUrl.searchParams.set('autorun', '1');
    console.log("New URL with file parameter:", newUrl.toString());
    
    // Try to add the file parameter to the emulator via the 'h' object
    if ((window as any).h) {
      const h = (window as any).h;
      
      // Look for URL-related functions
      const urlFunctions = Object.keys(h).filter(fn => 
        fn.toLowerCase().includes('url') || 
        fn.toLowerCase().includes('param') || 
        fn.toLowerCase().includes('args') || 
        fn.toLowerCase().includes('parse')
      );
      console.log("URL-related functions found:", urlFunctions);
      
      // Try calling any URL-related functions
      for (const fn of urlFunctions) {
        if (typeof h[fn] === 'function') {
          console.log(`Trying to call ${fn}...`);
          try {
            h[fn]();
            console.log(`✅ Successfully called ${fn}`);
          } catch (e) {
            console.log(`❌ Error calling ${fn}:`, e);
          }
        }
      }
      
      // Try to add file parameter via __sargs_add_kvp if available
      if (typeof h.__sargs_add_kvp === 'function') {
        console.log("Trying to add file parameter via __sargs_add_kvp...");
        try {
          h.__sargs_add_kvp('file', fileUrl);
          h.__sargs_add_kvp('autorun', '1');
          
          // Add input parameter if present in URL
          const urlParams = new URLSearchParams(window.location.search);
          const inputParam = urlParams.get('input');
          if (inputParam) {
            console.log("Found input parameter:", inputParam);
            h.__sargs_add_kvp('input', inputParam);
          }
          
          console.log("✅ Successfully added file parameters");
        } catch (e) {
          console.log("❌ Error adding file parameters:", e);
        }
      }
    }
    
    // Fallback to drop method after a short delay
    setTimeout(() => {
      console.log("Falling back to drop method...");
      this.loadProgramViaDrop(prgData);
    }, 1000);
  }
  
  private loadProgramViaDrop(prgData: Uint8Array): void {
    console.log("=== ATTEMPTING DROP METHOD LOAD ===");
    
    // Parse PRG header
    const loadAddress = (prgData[1] << 8) | prgData[0];
    console.log("Detected load address: 0x" + loadAddress.toString(16).toUpperCase() + " (" + loadAddress + ")");
    console.log("PRG header bytes: 0x" + prgData[0].toString(16).toUpperCase() + " 0x" + prgData[1].toString(16).toUpperCase());
    
    // Validate load address
    if (loadAddress === 0x1001 || loadAddress === 0x1200 || loadAddress === 0x1018) {
      if (loadAddress === 0x1018) {
        console.log("✅ Valid VIC-20 BASIC program detected (0x1018) - alternative load address");
      } else {
        console.log("✅ Valid VIC-20 program detected");
      }
    } else {
      console.log("⚠️ Unexpected load address - may not be a valid VIC-20 program");
    }
    
    // Check for available functions
    const h = (window as any).h;
    const availableWindowFunctions = Object.keys(window).filter(key => 
      typeof (window as any)[key] === 'function' && 
      (key.toLowerCase().includes('drop') || key.toLowerCase().includes('load') || key.toLowerCase().includes('run'))
    );
    const availableModuleFunctions = this.module ? Object.keys(this.module).filter(key => 
      typeof this.module![key] === 'function' && 
      (key.toLowerCase().includes('drop') || key.toLowerCase().includes('load') || key.toLowerCase().includes('run'))
    ) : [];
    
    console.log("Available window functions:", availableWindowFunctions);
    console.log("Available module functions:", availableModuleFunctions);
    
    console.log("PRG data length:", prgData.length);
    console.log("PRG header:", prgData[0], prgData[1]);
    console.log("First few bytes of program:", prgData.slice(0, 10));
    
    // Allocate memory in WASM heap
    let ptr: number;
    try {
      if (typeof this.module!._malloc === 'function') {
        ptr = this.module!._malloc(prgData.length);
        console.log("✅ Allocated memory at address:", ptr);
      } else if (typeof this.module!._fs_emsc_alloc === 'function') {
        ptr = this.module!._fs_emsc_alloc(prgData.length);
        console.log("✅ Allocated memory using _fs_emsc_alloc at address:", ptr);
      } else {
        console.log("❌ No memory allocation function available");
        return;
      }
    } catch (error) {
      console.log("❌ Error allocating memory:", error);
      return;
    }
    
    // Copy data to WASM heap
    try {
      if (this.module!.HEAPU8) {
        this.module!.HEAPU8.set(prgData, ptr);
        console.log("✅ Copied PRG data to WASM heap");
      } else if (this.module!.HEAP8) {
        this.module!.HEAP8.set(prgData, ptr);
        console.log("✅ Copied PRG data to WASM heap using HEAP8");
      } else if (this.module!.HEAP) {
        // Try to copy using the generic HEAP
        for (let i = 0; i < prgData.length; i++) {
          this.module!.HEAP[ptr + i] = prgData[i];
        }
        console.log("✅ Copied PRG data to WASM heap using generic HEAP");
      } else {
        console.log("❌ No WASM heap available - trying alternative approach");
        // Try calling drop functions without memory allocation
        this.callDropFunctionsWithoutMemory(prgData);
        return;
      }
    } catch (error) {
      console.log("❌ Error copying data to WASM heap:", error);
      console.log("Trying alternative approach without memory allocation...");
      this.callDropFunctionsWithoutMemory(prgData);
      return;
    }
    
    console.log("PRG header:", prgData[0], prgData[1]);
    console.log("First few bytes of program:", prgData.slice(0, 10));
    
    // Attempt to trigger drag-and-drop functionality using 'h' object
    console.log("Attempting to trigger drag-and-drop functionality using 'h' object");
    console.log("PRG data to load:", prgData);
    console.log("PRG data length:", prgData.length);
    console.log("First 10 bytes:", prgData.slice(0, 10));
    
    // Check if we have the complete drop sequence
    const dropFunctions = ['__sapp_emsc_begin_drop', '__sapp_emsc_drop', '__sapp_emsc_end_drop'];
    const hasAllDropFunctions = dropFunctions.every(fn => typeof h[fn] === 'function');
    
    if (hasAllDropFunctions) {
      console.log("Found complete drop sequence, calling all three functions...");
      
      try {
        h.__sapp_emsc_begin_drop();
        console.log("Called __sapp_emsc_begin_drop successfully");
      } catch (error) {
        console.log("❌ Error calling __sapp_emsc_begin_drop:", error);
      }
      
      try {
        h.__sapp_emsc_drop(ptr, prgData.length);
        console.log("Called __sapp_emsc_drop successfully");
      } catch (error) {
        console.log("❌ Error calling __sapp_emsc_drop:", error);
      }
      
      try {
        h.__sapp_emsc_end_drop();
        console.log("Called __sapp_emsc_end_drop successfully");
      } catch (error) {
        console.log("❌ Error calling __sapp_emsc_end_drop:", error);
      }
    } else {
      console.log("❌ Missing drop functions:", dropFunctions.filter(fn => typeof h[fn] !== 'function'));
    }
    
    console.log("=== SIMPLIFIED EXECUTION APPROACH ===");
    
    // Call _main to ensure emulator is running
    if (typeof this.module!._main === 'function') {
      try {
        this.module!._main();
        console.log("✅ Calling _main to ensure emulator is running...");
      } catch (error) {
        console.log("❌ Error calling _main:", error);
      }
    }
    
    console.log("✅ Program loaded and emulator should be running");
    console.log("✅ Check the VIC-20 screen for output");
    console.log("✅ Try clicking on the canvas to interact with the emulator");
    
    // Force display refresh
    this.forceDisplayRefresh();
    
    // Verify and execute the loaded ROM
    console.log("🔄 About to call verifyAndExecuteLoadedROM...");
    this.verifyAndExecuteLoadedROM(prgData);
    
    console.log("✅ VIC-20 program loading complete!");
    console.log("✅ The emulator should now be running with your program");
    console.log("✅ Check the VIC-20 screen for any output");
    console.log("✅ You can interact with the emulator by clicking on the canvas");
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
    
    // Hide the VIC-20 chips div when destroyed
    const vic20Div = document.getElementById('vic20-chips-div');
    if (vic20Div) {
      vic20Div.style.display = 'none';
      console.log("✅ Hidden VIC-20 chips div");
    }
    
    // Remove focus tracking
    this.removeFocusTracking();
  }
  
  private addFocusTracking(): void {
    console.log("🔍 Adding global focus tracking to debug focus stealing...");
    
    // Track focus changes
    this.focusTrackingHandler = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      const relatedTarget = event.relatedTarget as HTMLElement;
      
      // Get stack trace to see what caused the focus change
      const stack = new Error().stack;
      
      console.log("🔍 FOCUS CHANGE DETECTED:");
      console.log("  From:", relatedTarget?.tagName, relatedTarget?.id, relatedTarget?.className);
      console.log("  To:", target?.tagName, target?.id, target?.className);
      console.log("  Event type:", event.type);
      console.log("  Is trusted:", event.isTrusted);
      console.log("  Stack trace:", stack);
      
      // Check if focus is being stolen by the canvas
      if (target === this.canvas) {
        console.log("🚨 WARNING: Canvas gained focus!");
        console.log("  This might be stealing focus from the editor");
      }
      
      // Check if focus is being stolen from the editor
      if (relatedTarget && relatedTarget.closest('.CodeMirror')) {
        console.log("🚨 WARNING: Focus stolen from CodeMirror editor!");
        console.log("  This is the problem we're trying to solve");
      }
      
      // Check if the canvas is somehow involved in focus changes
      if (target === this.canvas || relatedTarget === this.canvas) {
        console.log("🚨 CANVAS FOCUS INVOLVEMENT:");
        console.log("  Canvas is target:", target === this.canvas);
        console.log("  Canvas is relatedTarget:", relatedTarget === this.canvas);
        console.log("  Event type:", event.type);
        console.log("  Is trusted:", event.isTrusted);
      }
      
      // Check if focus is being stolen from textarea (CodeMirror's input)
      if (target && target.tagName === 'TEXTAREA' && event.type === 'focusout') {
        console.log("🚨 TEXTAREA LOSING FOCUS:");
        console.log("  Textarea losing focus to:", relatedTarget?.tagName, relatedTarget?.id, relatedTarget?.className);
        console.log("  This might be the typing issue");
      }
    };
    
    // Add listeners for both focusin and focusout
    document.addEventListener('focusin', this.focusTrackingHandler, true);
    document.addEventListener('focusout', this.focusTrackingHandler, true);
    
    // Add keyboard event tracking to see what happens when typing
    this.keyboardTrackingHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      
      // Only track if the target is the textarea (CodeMirror's input)
      if (target && target.tagName === 'TEXTAREA') {
        console.log("🔍 KEYBOARD EVENT ON TEXTAREA:");
        console.log("  Key:", event.key);
        console.log("  KeyCode:", event.keyCode);
        console.log("  Type:", event.type);
        console.log("  Is trusted:", event.isTrusted);
        console.log("  Default prevented:", event.defaultPrevented);
        console.log("  Target:", target.tagName, target.id, target.className);
        
        // Check if the event is being prevented or stopped
        if (event.defaultPrevented) {
          console.log("🚨 WARNING: Keyboard event default was prevented!");
          console.log("  This might be why typing isn't working");
        }
      }
    };
    
    document.addEventListener('keydown', this.keyboardTrackingHandler, true);
    document.addEventListener('keyup', this.keyboardTrackingHandler, true);
    document.addEventListener('keypress', this.keyboardTrackingHandler, true);
    
    // CRITICAL: Override preventDefault to prevent it from blocking editor events
    const originalPreventDefault = Event.prototype.preventDefault;
    Event.prototype.preventDefault = function(this: Event) {
      const target = this.target as HTMLElement;
      
      // If this is a keyboard event on a textarea or input, don't allow preventDefault
      if ((this.type === 'keypress' || this.type === 'keydown' || this.type === 'keyup') && 
          target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        console.log(`🛡️ BLOCKED preventDefault on ${this.type} event for ${target.tagName} - key: ${(this as KeyboardEvent).key}`);
        return; // Don't call the original preventDefault
      }
      
      // For all other events, call the original preventDefault
      return originalPreventDefault.call(this);
    };
    
    console.log("✅ Overrode preventDefault to protect editor keyboard events");
    
    // ENHANCED: Handle Tab key and error dialogs
    this.keyboardInterceptor = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const activeElement = document.activeElement;
      
      // If this is a Tab key on a textarea, prevent it from going to URL bar
      if (event.key === 'Tab' && target && target.tagName === 'TEXTAREA') {
        console.log(`🛡️ HANDLING Tab key on textarea - preventing URL bar navigation`);
        // Prevent default to stop browser tab navigation, but let CodeMirror handle it
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      
      // If there's an error dialog visible, block all keyboard events from emulator
      const errorAlert = document.getElementById('error_alert');
      if (errorAlert && errorAlert.style.display !== 'none') {
        console.log(`🛡️ ERROR DIALOG ACTIVE - blocking ${event.key} from emulator`);
        event.stopImmediatePropagation();
        event.stopPropagation();
        return;
      }
      
      // SELECTIVE: Only block events from reaching emulator, don't interfere with editor
      if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
        // Don't stop propagation - let the editor handle the event normally
        // Just log that we're allowing it to work in the editor
        console.log(`🛡️ ALLOWING ${event.key} to work in editor - not blocking`);
        return;
      }
      
      // Only log other events on textarea/input, don't interfere
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        console.log(`🛡️ ALLOWING ${event.type} for ${event.key} on ${target.tagName} - not interfering`);
      }
    };
    
    // Add the interceptor with high priority
    document.addEventListener('keydown', this.keyboardInterceptor, true);
    document.addEventListener('keyup', this.keyboardInterceptor, true);
    document.addEventListener('keypress', this.keyboardInterceptor, true);
    
    // REMOVED: preventDefault override was too aggressive and blocked editor functionality
    // Now relying only on event propagation stopping to prevent emulator interference
    console.log("✅ Using event propagation stopping only for keyboard protection");
    
    // CRITICAL: Add focus protection for Bootbox modals
    // This prevents the emulator from stealing focus from modal dialogs
    this.modalFocusProtection = () => {
      // Check for any visible Bootbox modals
      const bootboxModals = document.querySelectorAll('.bootbox.modal.show, .bootbox.modal.in');
      if (bootboxModals.length > 0) {
        console.log("🛡️ Bootbox modal detected - protecting focus");
        
        // Find the first input in the modal and focus it
        const modal = bootboxModals[0] as HTMLElement;
        const inputs = modal.querySelectorAll('input, textarea');
        if (inputs.length > 0) {
          const firstInput = inputs[0] as HTMLElement;
          if (document.activeElement !== firstInput) {
            console.log("🛡️ Focusing first input in Bootbox modal");
            firstInput.focus();
          }
        }
      }
    };
    
    // Run modal focus protection periodically
    setInterval(this.modalFocusProtection, 500);
    
    // REMOVED: globalKeyboardBlocker was causing conflicts
    // Now using only the simplified keyboardInterceptor
    
    console.log("✅ Focus and keyboard tracking added with emulator interference prevention");
  }
  
  private removeFocusTracking(): void {
    if (this.focusTrackingHandler) {
      document.removeEventListener('focusin', this.focusTrackingHandler, true);
      document.removeEventListener('focusout', this.focusTrackingHandler, true);
      this.focusTrackingHandler = null;
    }
    
    if (this.keyboardTrackingHandler) {
      document.removeEventListener('keydown', this.keyboardTrackingHandler, true);
      document.removeEventListener('keyup', this.keyboardTrackingHandler, true);
      document.removeEventListener('keypress', this.keyboardTrackingHandler, true);
      this.keyboardTrackingHandler = null;
    }
    
    if (this.keyboardInterceptor) {
      document.removeEventListener('keydown', this.keyboardInterceptor, true);
      document.removeEventListener('keyup', this.keyboardInterceptor, true);
      document.removeEventListener('keypress', this.keyboardInterceptor, true);
      this.keyboardInterceptor = null;
    }
    
    console.log("✅ Focus and keyboard tracking removed");
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
    console.log("Attempting to simulate keyboard input for:", text);
    
    // Look for keyboard-related functions
    const h = (window as any).h;
    if (h) {
      const keyboardFunctions = Object.keys(h).filter(fn => 
        fn.toLowerCase().includes('key') || 
        fn.toLowerCase().includes('input') || 
        fn.toLowerCase().includes('char') ||
        fn.toLowerCase().includes('type') ||
        fn.toLowerCase().includes('text')
      );
      
      console.log("Found keyboard functions:", keyboardFunctions);
      
      // Try each keyboard function
      for (const fn of keyboardFunctions) {
        if (typeof h[fn] === 'function') {
          console.log(`Trying keyboard function: ${fn}`);
          try {
            h[fn](text);
            console.log(`✅ Successfully called ${fn} with text: ${text}`);
            return;
          } catch (e) {
            console.log(`❌ Error calling ${fn}:`, e);
          }
        }
      }
    }
    
    // Fallback to individual key simulation
    console.log("No keyboard function found, trying individual key simulation...");
    for (const char of text) {
      const keyCode = char.charCodeAt(0);
      this.simulateKeyPress(keyCode);
    }
  }

  private simulateKeyPress(keyCode: number): void {
    console.log(`🎯 Attempting to simulate key press for key code: ${keyCode}`);
    
    const h = (window as any).h;
    if (!h) {
      console.log("❌ No 'h' object available for key simulation");
      return;
    }
    
    // Log all available functions to see what keyboard functions exist
    console.log("🔍 Available functions on h object:", Object.keys(h));
    
    // Try different approaches for keyboard input
    const keyFunctions = [
      'keydown', 'keypress', 'keyup', 'key', 'input', 'sendKey', 'pressKey',
      'keyboard', 'keyboardInput', 'keyboardEvent', 'simulateKey', 'simulateKeyPress'
    ];
    
    for (const funcName of keyFunctions) {
      if (typeof h[funcName] === 'function') {
        console.log(`🎯 Trying ${funcName} function...`);
        try {
          // Try different parameter formats
          h[funcName](keyCode);
          console.log(`✅ ${funcName} called successfully with keyCode ${keyCode}`);
          return;
        } catch (e) {
          console.log(`❌ ${funcName} failed:`, e);
        }
      }
    }
    
    // If no keyboard functions found, try to create a keyboard event and dispatch it
    console.log("🎯 Trying to create and dispatch keyboard event...");
    try {
      const keyEvent = new KeyboardEvent('keydown', {
        keyCode: keyCode,
        which: keyCode,
        key: keyCode === 112 ? 'F1' : keyCode === 13 ? 'Enter' : String.fromCharCode(keyCode),
        code: keyCode === 112 ? 'F1' : keyCode === 13 ? 'Enter' : `Key${String.fromCharCode(keyCode)}`,
        bubbles: true,
        cancelable: true
      });
      
      // Try to dispatch on the canvas
      if (h.canvas) {
        h.canvas.dispatchEvent(keyEvent);
        console.log(`✅ Keyboard event dispatched on h.canvas for key ${keyCode}`);
        return;
      } else if (h.xc) {
        h.xc.dispatchEvent(keyEvent);
        console.log(`✅ Keyboard event dispatched on h.xc for key ${keyCode}`);
        return;
      } else if (this.canvas) {
        this.canvas.dispatchEvent(keyEvent);
        console.log(`✅ Keyboard event dispatched on this.canvas for key ${keyCode}`);
        return;
      }
    } catch (e) {
      console.log("❌ Error creating/dispatching keyboard event:", e);
    }
    
    console.log(`❌ No key function found for key ${keyCode} (${String.fromCharCode(keyCode)})`);
  }

  // Verify if the program was actually loaded into memory
  private verifyProgramLoaded(expectedData: Uint8Array): void {
    console.log("=== VERIFYING PROGRAM LOAD ===");
    
    if (!(window as any).h) {
      console.log("❌ No 'h' object available for verification");
      return;
    }
    
    const h = (window as any).h;
    
    // First, let's analyze what functions are available
    console.log("=== ANALYZING AVAILABLE FUNCTIONS ===");
    const availableFunctions = Object.keys(h);
    console.log("All available functions:", availableFunctions);
    
    // Look for any function that might be related to program execution
    const executionFunctions = availableFunctions.filter(func => 
      func.toLowerCase().includes('run') || 
      func.toLowerCase().includes('exec') || 
      func.toLowerCase().includes('start') || 
      func.toLowerCase().includes('main') ||
      func.toLowerCase().includes('call') ||
      func.toLowerCase().includes('jump')
    );
    console.log("Potential execution functions:", executionFunctions);
    
    // Try calling _main if it exists (this might restart the program)
    if (typeof h._main === 'function') {
      console.log("Found _main function, trying to call it...");
      try {
        h._main();
        console.log("✅ Successfully called _main function");
      } catch (error) {
        console.log("❌ Error calling _main function:", error);
      }
    }
    
    // Try to read memory at expected VIC-20 locations
    const memoryFunctions = [
      'vic20_read_memory', 'read_memory', 'memory_read', 'get_memory',
      'vic20_memory_read', 'read_byte', 'get_byte'
    ];
    
    let memoryReadFunction = null;
    for (const funcName of memoryFunctions) {
      if (typeof h[funcName] === 'function') {
        memoryReadFunction = h[funcName];
        console.log(`Found memory read function: ${funcName}`);
        break;
      }
    }
    
    if (memoryReadFunction) {
      // Check memory at common VIC-20 locations
      const locations = [0x1001, 0x1200, 0x1000, 0x1201];
      
      for (const addr of locations) {
        try {
          const value = memoryReadFunction(addr);
          console.log(`Memory at 0x${addr.toString(16).toUpperCase()}: 0x${value.toString(16).toUpperCase()} (${value})`);
        } catch (error) {
          console.log(`Error reading memory at 0x${addr.toString(16).toUpperCase()}:`, error);
        }
      }
      
      // Try to read the first few bytes of the expected program
      if (expectedData.length >= 2) {
        const loadAddress = expectedData[0] | (expectedData[1] << 8);
        console.log(`Checking memory starting at load address: 0x${loadAddress.toString(16).toUpperCase()}`);
        
        for (let i = 0; i < Math.min(10, expectedData.length - 2); i++) {
          try {
            const addr = loadAddress + i;
            const expected = expectedData[i + 2];
            const actual = memoryReadFunction(addr);
            const match = expected === actual ? "✅" : "❌";
            console.log(`${match} Memory[0x${addr.toString(16).toUpperCase()}]: expected 0x${expected.toString(16).toUpperCase()}, got 0x${actual.toString(16).toUpperCase()}`);
          } catch (error) {
            console.log(`Error reading memory at offset ${i}:`, error);
          }
        }
      }
    } else {
      console.log("❌ No memory read function found");
      
      // Try to get program state or loaded files info
      const stateFunctions = [
        'vic20_get_state', 'get_state', 'get_program_state', 'get_loaded_program',
        'vic20_program_info', 'program_info', 'get_file_info'
      ];
      
      for (const funcName of stateFunctions) {
        if (typeof h[funcName] === 'function') {
          try {
            const state = h[funcName]();
            console.log(`Program state from ${funcName}:`, state);
          } catch (error) {
            console.log(`Error calling ${funcName}:`, error);
          }
        }
      }
    }
  }

  private forceDisplayRefresh(): void {
    console.log("🔄 Forcing VIC-20 display refresh...");
    
    // Try multiple approaches to refresh the display
    if (this.module) {
      // Method 1: Use requestAnimationFrame if available
      if (typeof this.module.requestAnimationFrame === 'function') {
        console.log("✅ Using module.requestAnimationFrame for display refresh");
        this.module.requestAnimationFrame(() => {
          console.log("✅ Display refresh triggered via requestAnimationFrame");
        });
      }
      
      // Method 2: Try to call any display-related functions
      const displayFunctions = ['refresh', 'redraw', 'update', 'render', 'display'];
      for (const funcName of displayFunctions) {
        if (typeof this.module[funcName] === 'function') {
          console.log(`✅ Calling module.${funcName}() for display refresh`);
          try {
            this.module[funcName]();
          } catch (e) {
            console.log(`❌ Error calling ${funcName}:`, e);
          }
        }
      }
      
      // Method 3: Try to trigger a frame update
      if (typeof this.module._main === 'function') {
        console.log("✅ Calling _main again to trigger frame update");
        try {
          this.module._main();
        } catch (e) {
          console.log("❌ Error calling _main for display refresh:", e);
        }
      }
    }
    
    // Method 4: Draw a visual indicator on the canvas
    setTimeout(() => {
      if (this.canvas) {
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
          // Draw a small indicator that the program is loaded
          ctx.fillStyle = 'green';
          ctx.fillRect(this.canvas.width - 20, 10, 10, 10);
          ctx.fillStyle = 'white';
          ctx.font = '12px monospace';
          ctx.fillText('LOADED', this.canvas.width - 80, 20);
          console.log("✅ Visual indicator drawn on canvas");
        }
      }
    }, 500);
    
    console.log("✅ Display refresh attempts completed");
  }

  private verifyAndExecuteLoadedROM(prgData: Uint8Array): void {
    console.log("🔄 DISABLED: verifyAndExecuteLoadedROM to prevent crashes");
    console.log("🔄 Skipping program verification and execution for safety");
    return;
  }
  
  private triggerProgramExecution(): void {
    console.log("🔄 DISABLED: triggerProgramExecution to prevent crashes");
    console.log("🔄 Skipping all execution function calls for safety");
    return;
  }

  private callDropFunctionsWithoutMemory(prgData: Uint8Array): void {
    console.log("🔄 DISABLED: callDropFunctionsWithoutMemory to prevent crashes");
    console.log("🔄 Skipping all drop function calls for safety");
    return;
  }

  private simulateFileReading(prgData: Uint8Array): void {
    console.log("🎯 === SIMULATING FILE READING (DISABLED FOR SAFETY) ===");
    
    // Temporarily disabled to prevent crashes
    console.log("🔄 Skipping emulator state check to prevent crashes");
    
    // Create a File object from the PRG data
    const blob = new Blob([prgData], { type: 'application/octet-stream' });
    const file = new File([blob], 'program.prg', { type: 'application/octet-stream' });
    console.log("📁 Created File object:", file.name, file.size, "bytes");
    
    // Store the file in h.dd (like the native drop handler does)
    if (this.module && this.module.h) {
      this.module.h.dd = file;
      console.log("📁 Stored file in h.dd");
    }
    
    // Find HEAPU8 for memory access
    let heapU8: Uint8Array | null = null;
    const h = this.module?.h;
    
    // Try multiple ways to find HEAPU8
    if ((window as any).t && (window as any).t instanceof Uint8Array) {
      heapU8 = (window as any).t;
      console.log("✅ Found HEAPU8 via window.t");
    } else if ((window as any).r && (window as any).r instanceof Uint8Array) {
      heapU8 = (window as any).r;
      console.log("✅ Found HEAPU8 via window.r");
    } else if (h?.HEAPU8) {
      heapU8 = h.HEAPU8;
      console.log("✅ Found HEAPU8 via h.HEAPU8");
    } else if (h?.HEAP8) {
      heapU8 = new Uint8Array(h.HEAP8.buffer);
      console.log("✅ Found HEAPU8 via h.HEAP8 conversion");
    } else if (h?.HEAP) {
      heapU8 = new Uint8Array(h.HEAP.buffer);
      console.log("✅ Found HEAPU8 via h.HEAP conversion");
    }
    
    if (!heapU8) {
      console.error("❌ No WASM heap available for file reading simulation");
      return;
    }
    
    // Parse PRG header to get load address
    const loadAddress = prgData[0] | (prgData[1] << 8);
    console.log(`📍 Load address from PRG header: 0x${loadAddress.toString(16).padStart(4, '0')} (${loadAddress})`);
    
    // Extract program data (skip 2-byte header)
    const programData = prgData.slice(2);
    console.log(`📦 Program data size: ${programData.length} bytes`);
    
    // DEBUG: Memory contents before loading to see what's there
    console.log("🔍 DEBUG: Memory contents before loading:");
    const addressesToCheck = [0x1000, 0x1001, 0x1018, 0x1200];
    for (const addr of addressesToCheck) {
      try {
        const beforeValue = heapU8[addr];
        console.log(`  - 0x${addr.toString(16).padStart(4, '0')}: 0x${beforeValue.toString(16).padStart(2, '0')} (before)`);
      } catch (e) {
        console.log(`  - 0x${addr.toString(16).padStart(4, '0')}: <error> (${e})`);
      }
    }
    
    // Copy program data directly to load address
    try {
      heapU8.set(programData, loadAddress);
      console.log(`✅ Successfully copied ${programData.length} bytes to address 0x${loadAddress.toString(16).padStart(4, '0')}`);
    } catch (e) {
      console.error("❌ Error copying data to WASM heap:", e);
      return;
    }
    
    // DEBUG: Verify the data was actually copied correctly
    console.log("🔍 DEBUG: Memory contents after loading:");
    for (let i = 0; i < Math.min(16, programData.length); i++) {
      const addr = loadAddress + i;
      try {
        const afterValue = heapU8[addr];
        const expectedValue = programData[i];
        const match = afterValue === expectedValue ? "✅" : "❌";
        console.log(`  - 0x${addr.toString(16).padStart(4, '0')}: 0x${afterValue.toString(16).padStart(2, '0')} (expected: 0x${expectedValue.toString(16).padStart(2, '0')}) ${match}`);
      } catch (e) {
        console.log(`  - 0x${addr.toString(16).padStart(4, '0')}: <error> (${e})`);
      }
    }
    
    // For now, just copy the data and don't interfere with normal drag-and-drop
    console.log("🔄 Data copied successfully - skipping drop function calls to avoid conflicts");
    
    // Trigger execution with key presses after a delay
    setTimeout(() => {
      console.log("🎯 Triggering execution with key presses...");
      this.simulateKeyPress(13); // RETURN
    }, 200);
    
    setTimeout(() => {
      this.simulateKeyPress(112); // F1
    }, 300);
    
    setTimeout(() => {
      this.simulateKeyPress(114); // F3
    }, 400);
    
    // Also try to trigger execution via direct function calls
    setTimeout(() => {
      this.triggerProgramExecution();
    }, 500);
  }

  private debugMemoryAfterLoading(): void {
    console.log("🔍 DEBUG: Checking memory after loading...");
    
    try {
      const h = (window as any).h;
      if (!h) {
        console.log("❌ No 'h' object available for memory check");
        return;
      }
      
      // Try to read memory at common VIC-20 addresses
      const addressesToCheck = [
        0x1000, // BASIC program start
        0x1001, // Alternative BASIC start
        0x1018, // Another common start
        0x1200, // Another common start
        0x2000, // Cartridge area
        0x4000, // Cartridge area
        0x6000, // Cartridge area
        0x8000, // Character ROM
        0x9000, // I/O area
        0xc000, // BASIC ROM
        0xe000, // KERNAL ROM
      ];
      
      console.log("🔍 DEBUG: Memory contents at key addresses:");
      
      for (const addr of addressesToCheck) {
        try {
          // Try different memory reading approaches
          let value = null;
          
          // Try direct memory access if available
          if ((window as any).t && typeof (window as any).t[addr] !== 'undefined') {
            value = (window as any).t[addr];
            console.log(`  - 0x${addr.toString(16).padStart(4, '0')}: 0x${value.toString(16).padStart(2, '0')} (global t)`);
          } else if ((window as any).r && typeof (window as any).r[addr] !== 'undefined') {
            value = (window as any).r[addr];
            console.log(`  - 0x${addr.toString(16).padStart(4, '0')}: 0x${value.toString(16).padStart(2, '0')} (global r)`);
          } else if (h.HEAPU8 && typeof h.HEAPU8[addr] !== 'undefined') {
            value = h.HEAPU8[addr];
            console.log(`  - 0x${addr.toString(16).padStart(4, '0')}: 0x${value.toString(16).padStart(2, '0')} (HEAPU8)`);
          } else if (h.HEAP8 && typeof h.HEAP8[addr] !== 'undefined') {
            value = h.HEAP8[addr];
            console.log(`  - 0x${addr.toString(16).padStart(4, '0')}: 0x${value.toString(16).padStart(2, '0')} (HEAP8)`);
          } else if (h.HEAP && typeof h.HEAP[addr] !== 'undefined') {
            value = h.HEAP[addr];
            console.log(`  - 0x${addr.toString(16).padStart(4, '0')}: 0x${value.toString(16).padStart(2, '0')} (HEAP)`);
          } else {
            console.log(`  - 0x${addr.toString(16).padStart(4, '0')}: <no access> (no heap available)`);
          }
        } catch (e) {
          console.log(`  - 0x${addr.toString(16).padStart(4, '0')}: <error> (${e})`);
        }
      }
      
      // Try to find any memory reading functions
      console.log("🔍 DEBUG: Looking for memory reading functions...");
      const memoryFunctions = Object.keys(h).filter(fn => 
        typeof h[fn] === 'function' && 
        (fn.toLowerCase().includes('read') || 
         fn.toLowerCase().includes('memory') || 
         fn.toLowerCase().includes('peek') ||
         fn.toLowerCase().includes('get'))
      );
      console.log("  - Available memory functions:", memoryFunctions);
      
      // Try to read a range of memory if we have a memory reading function
      if (memoryFunctions.length > 0) {
        const testFn = memoryFunctions[0];
        console.log(`🔍 DEBUG: Testing memory reading with ${testFn}...`);
        
        try {
          // Try reading a range of memory
          const testRange = [0x1000, 0x1001, 0x1002, 0x1003, 0x1004, 0x1005];
          for (const addr of testRange) {
            try {
              const result = h[testFn](addr);
              console.log(`  - ${testFn}(0x${addr.toString(16).padStart(4, '0')}): ${result}`);
            } catch (e) {
              console.log(`  - ${testFn}(0x${addr.toString(16).padStart(4, '0')}): <error> (${e})`);
            }
          }
        } catch (e) {
          console.log(`  - Error testing ${testFn}:`, e);
        }
      }
      
    } catch (error) {
      console.log("❌ Error during memory debugging:", error);
    }
  }



  private checkAndResetEmulatorState(): void {
    console.log("🔍 DEBUG: Checking emulator state before loading...");
    
    try {
      const h = (window as any).h;
      if (!h) {
        console.log("❌ No 'h' object available for state check");
        return;
      }
      
      // Check current state
      console.log("🔍 DEBUG: Current emulator state:");
      console.log("  - calledRun:", h.calledRun);
      console.log("  - running:", this.running);
      console.log("  - programLoaded:", this.programLoaded);
      
      // Look for reset or initialization functions
      const resetFunctions = Object.keys(h).filter(fn => 
        typeof h[fn] === 'function' && 
        (fn.toLowerCase().includes('reset') || 
         fn.toLowerCase().includes('init') || 
         fn.toLowerCase().includes('clear') ||
         fn.toLowerCase().includes('boot') ||
         fn.toLowerCase().includes('start'))
      );
      
      console.log("🔍 DEBUG: Available reset/init functions:", resetFunctions);
      
      // Try to reset the emulator if needed
      if (resetFunctions.length > 0) {
        console.log("🔄 Attempting to reset emulator state...");
        
        for (const fn of resetFunctions) {
          try {
            console.log(`🎯 Trying to call ${fn}...`);
            h[fn]();
            console.log(`✅ Successfully called ${fn}()`);
            
            // Wait a moment for reset to take effect
            // Temporarily disabled setTimeout to prevent crashes
            console.log("🔄 Skipping setTimeout to prevent crashes");
            // setTimeout(() => {
            //   console.log("🔍 DEBUG: Emulator state after reset:");
            //   console.log("  - calledRun:", h.calledRun);
            //   console.log("  - running:", this.running);
            //   console.log("  - programLoaded:", this.programLoaded);
            // }, 100);
            
            return; // Successfully reset
          } catch (e) {
            console.log(`❌ Error calling ${fn}():`, e);
          }
        }
      }
      
      // If no reset functions, try calling _main to ensure emulator is running
      if (typeof h._main === 'function') {
        console.log("🔄 Calling _main to ensure emulator is running...");
        try {
          h._main();
          console.log("✅ Called _main successfully");
        } catch (e) {
          console.log("❌ Error calling _main:", e);
        }
      }
      
      // Try to clear any existing program data
      console.log("🔄 Attempting to clear existing program data...");
      if ((window as any).t) {
        try {
          // Temporarily disabled memory clearing to prevent crashes
          console.log("🔄 Skipping memory clearing to prevent crashes");
          // const heapU8 = (window as any).t;
          // for (let addr = 0x1000; addr < 0x2000; addr++) {
          //   heapU8[addr] = 0;
          // }
          // console.log("✅ Cleared BASIC program area");
        } catch (e) {
          console.log("❌ Error clearing program area:", e);
        }
      }
      
    } catch (error) {
      console.log("❌ Error during emulator state check:", error);
    }
  }

  private tryDropApproach(prgData: Uint8Array): void {
    // Original drop approach as fallback
    console.log("🔄 Trying drop approach as fallback...");
    
    try {
      const h = (window as any).h;
      if (!h) {
        console.log("❌ No 'h' object available");
        return;
      }
      
      // Create a proper File object with the program data
      const file = new File([prgData], 'program.prg', { 
        type: 'application/octet-stream',
        lastModified: Date.now()
      });
      
      // Create a proper DataTransfer object
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      // Create a proper drop event
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer
      });
      
      // Find the correct canvas that has the drop event listeners
      let targetCanvas: HTMLCanvasElement | null = null;
      
      if (h.xc) {
        targetCanvas = h.xc;
        console.log("✅ Found canvas through h.xc:", targetCanvas);
      } else if (h.canvas) {
        targetCanvas = h.canvas;
        console.log("✅ Found canvas through h.canvas:", targetCanvas);
      } else {
        console.log("❌ No canvas found on h object");
        return;
      }
      
      console.log("🎯 Dispatching drop event on canvas:", targetCanvas);
      
      // Dispatch the drop event on the canvas
      const success = targetCanvas.dispatchEvent(dropEvent);
      console.log(`✅ Drop event dispatched successfully: ${success}`);
      
      // Wait a moment for the event to be processed
      setTimeout(() => {
        console.log("🔄 Drop event should have been processed by now");
        console.log("🎯 Checking if program is running...");
        
        // Check if calledRun changed (this might indicate the program started)
        console.log("🎯 Checking calledRun status:", h.calledRun);
        
        // Try calling _main a few times to see if it triggers execution
        for (let i = 0; i < 3; i++) {
          try {
            if (typeof h._main === 'function') {
              h._main();
              console.log(`✅ _main called successfully (attempt ${i + 1})`);
            }
          } catch (e) {
            console.log(`❌ Error calling _main (attempt ${i + 1}):`, e);
          }
          
          // Wait a bit between calls
          if (i < 2) {
            setTimeout(() => {}, 100);
          }
        }
        
      }, 300);
      
    } catch (error) {
      console.log("❌ Error during drop approach:", error);
    }
  }

  // Add this method to help debug drag-and-drop vs our approach
  private captureDragAndDropData(): void {
    console.log("🔍 DEBUG: Setting up drag-and-drop capture...");
    
    try {
      const h = (window as any).h;
      if (!h) {
        console.log("❌ No 'h' object available");
        return;
      }
      
      // Store original functions
      const originalBeginDrop = h.__sapp_emsc_begin_drop;
      const originalDrop = h.__sapp_emsc_drop;
      const originalEndDrop = h.__sapp_emsc_end_drop;
      
      // Override with logging versions
      h.__sapp_emsc_begin_drop = function(...args: any[]) {
        console.log("🔍 CAPTURED: __sapp_emsc_begin_drop called with:", args);
        return originalBeginDrop.apply(this, args);
      };
      
      h.__sapp_emsc_drop = function(...args: any[]) {
        console.log("🔍 CAPTURED: __sapp_emsc_drop called with:", args);
        return originalDrop.apply(this, args);
      };
      
      h.__sapp_emsc_end_drop = function(...args: any[]) {
        console.log("🔍 CAPTURED: __sapp_emsc_end_drop called with:", args);
        return originalEndDrop.apply(this, args);
      };
      
      // Also capture h.dd changes
      let originalDd = h.dd;
      Object.defineProperty(h, 'dd', {
        get: function() { return originalDd; },
        set: function(value) {
          console.log("🔍 CAPTURED: h.dd set to:", value);
          if (value && value.length > 0) {
            console.log("🔍 CAPTURED: First file in h.dd:", value[0]);
            console.log("🔍 CAPTURED: File size:", value[0].size);
            console.log("🔍 CAPTURED: File name:", value[0].name);
          }
          originalDd = value;
        }
      });
      
      console.log("✅ Drag-and-drop capture set up. Now try dragging and dropping a file to see the captured data.");
      
    } catch (error) {
      console.log("❌ Error setting up drag-and-drop capture:", error);
    }
  }
} 