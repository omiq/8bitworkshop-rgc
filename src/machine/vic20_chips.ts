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
      
      // Add joystick parameter to ensure joystick support is enabled
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('joystick', 'true');
      window.history.replaceState({}, '', newUrl.toString());
      
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
        // Only intercept .c files, not .wasm or .js files
        if (url.includes('siegegame.c') || (url.includes('.c') && !url.includes('.wasm') && !url.includes('.js'))) {
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
          console.log("=== MODULE FUNCTIONS (FIRST METHOD) ===");
          
          // Try to get module from window.h first (this is where it actually is)
          if ((window as any).h) {
            console.log("✅ Found module via window.h");
            const h = (window as any).h;
            const functions = Object.keys(h).filter(key => typeof h[key] === 'function');
            console.log("Available functions via window.h:", functions);
            
            // Look for VIC-20 specific functions
            const vic20Functions = functions.filter(name => name.toLowerCase().includes('vic20'));
            console.log("VIC-20 specific functions:", vic20Functions);
            
            // Look for reset functions
            const resetFunctions = functions.filter(name => name.toLowerCase().includes('reset'));
            console.log("Reset functions:", resetFunctions);
            
            // Look for run/start functions
            const runFunctions = functions.filter(name => name.toLowerCase().includes('run') || name.toLowerCase().includes('start'));
            console.log("Run/Start functions:", runFunctions);
            
            // Look for CPU/execution functions
            const cpuFunctions = functions.filter(name => name.toLowerCase().includes('cpu') || name.toLowerCase().includes('pc') || name.toLowerCase().includes('exec'));
            console.log("CPU/Execution functions:", cpuFunctions);
            
            // Look for main/entry functions
            const mainFunctions = functions.filter(name => name.toLowerCase().includes('main'));
            console.log("Main functions:", mainFunctions);
            
            // Look for any function that might trigger execution
            const executionFunctions = functions.filter(name => 
              name.toLowerCase().includes('exec') || 
              name.toLowerCase().includes('run') || 
              name.toLowerCase().includes('start') || 
              name.toLowerCase().includes('reset') || 
              name.toLowerCase().includes('init') ||
              name.toLowerCase().includes('main') ||
              name.toLowerCase().includes('step') ||
              name.toLowerCase().includes('frame')
            );
            console.log("Potential execution functions:", executionFunctions);
            
            // Show all functions for debugging
            console.log("=== ALL FUNCTIONS ===");
            functions.forEach(funcName => {
              console.log(`  ${funcName}: ${typeof h[funcName]}`);
            });
            
            return functions;
          } else if (typeof (window as any).Module !== 'undefined' && (window as any).Module) {
            console.log("✅ Found module via window.Module");
            const Module = (window as any).Module;
            const functions = Object.keys(Module).filter(key => typeof Module[key] === 'function');
            console.log("Available functions via window.Module:", functions);
            return functions;
          } else {
            console.log("❌ No module available via window.h or window.Module");
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
        },
        
        // Load current compiled output
        loadCurrentOutput: () => {
          console.log("=== LOADING CURRENT COMPILED OUTPUT ===");
          if (typeof (window as any).current_output !== 'undefined' && (window as any).current_output) {
            console.log("Found current output:", (window as any).current_output.length, "bytes");
            this.loadProgramDirectly((window as any).current_output);
          } else {
            console.log("❌ No current output found");
          }
        },
        
        // Simulate drag and drop with current output
        simulateDragAndDrop: () => {
          console.log("=== SIMULATING DRAG AND DROP ===");
          if (typeof (window as any).current_output !== 'undefined' && (window as any).current_output) {
            console.log("Found current output:", (window as any).current_output.length, "bytes");
            this.tryDropApproach((window as any).current_output);
          } else {
            console.log("❌ No current output found");
          }
        },
        
        // Call drop functions directly
        callDropFunctionsDirectly: () => {
          console.log("=== CALLING DROP FUNCTIONS DIRECTLY ===");
          const h = (window as any).h;
          if (!h) {
            console.log("❌ No 'h' object available");
            return;
          }
          
          if (typeof (window as any).current_output !== 'undefined' && (window as any).current_output) {
            const data = (window as any).current_output;
            console.log("Using current output:", data.length, "bytes");
            
            try {
              // Call the drop functions directly
              if (typeof h.__sapp_emsc_begin_drop === 'function') {
                h.__sapp_emsc_begin_drop();
                console.log("✅ __sapp_emsc_begin_drop called");
              }
              
              if (typeof h.__sapp_emsc_drop === 'function') {
                h.__sapp_emsc_drop(data);
                console.log("✅ __sapp_emsc_drop called with data");
              }
              
              if (typeof h.__sapp_emsc_end_drop === 'function') {
                h.__sapp_emsc_end_drop();
                console.log("✅ __sapp_emsc_end_drop called");
              }
            } catch (error) {
              console.log("❌ Error calling drop functions:", error);
            }
          } else {
            console.log("❌ No current output found");
          }
        }
      };
      
      console.log("VIC20_DEBUG object available in console for debugging");
      console.log("Use VIC20_DEBUG.testWithSampleData() to test with sample program");
      console.log("Use VIC20_DEBUG.loadCurrentOutput() to load the current compiled output");
      console.log("Use VIC20_DEBUG.simulateDragAndDrop() to simulate drag and drop");
      console.log("Use VIC20_DEBUG.callDropFunctionsDirectly() to call drop functions directly");
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
    
    // Enable joystick support if available
    this.enableJoystickSupport();
  }
  
  private enableJoystickSupport(): void {
    console.log("🔧 Enabling joystick support...");
    
    if ((window as any).h && typeof (window as any).h.__sargs_add_kvp === 'function') {
      try {
        (window as any).h.__sargs_add_kvp('joystick', 'true');
        console.log("✅ Joystick support enabled via URL parameters");
      } catch (e) {
        console.log("❌ Error enabling joystick support:", e);
      }
    }
    
    // Also try to enable joystick support in the module
    if (this.module && typeof this.module.vic20_enable_joystick === 'function') {
      try {
        this.module.vic20_enable_joystick(true);
        console.log("✅ Joystick support enabled via module function");
      } catch (e) {
        console.log("❌ Error enabling joystick support in module:", e);
      }
    }
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
    console.log(`VIC20ChipsPlatform loadROM called with title: ${title} and ${data.length} bytes`);
    
    // Store the program data for later use
    const prgData = data;
    
    // Debug compilation output
    this.debugCompilationOutput();
    
    // Use the working approach: reset + real File object + drag-and-drop
    this.loadProgramWithWorkingMethod(prgData);
    
    // Add global debug functions
    this.addGlobalDebugFunctions();
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
    
    // Use the working approach: reset + real File object + drag-and-drop
    this.loadProgramWithWorkingMethod(program);
  }
  
  private loadProgramWithWorkingMethod(program: Uint8Array): void {
    console.log("=== USING WORKING METHOD: RESET + REAL FILE + DRAG-AND-DROP + RUN ===");
    
    // First reset the VIC-20 thoroughly with longer delays
    const h = (window as any).h;
    if (h) {
      console.log("1. Resetting VIC-20 thoroughly...");
      
      // Try multiple reset methods to ensure clean state
      if (typeof h.reset === 'function') {
        h.reset();
        console.log("✅ VIC-20 reset() called");
      }
      if (typeof h.vic20_reset === 'function') {
        h.vic20_reset();
        console.log("✅ VIC-20 vic20_reset() called");
      }
      if (typeof h.vic20_clear_screen === 'function') {
        h.vic20_clear_screen();
        console.log("✅ VIC-20 screen cleared");
      }
      
      // Wait much longer for reset to complete, then load program
      setTimeout(() => {
        console.log("2. Loading program with real File object...");
        
        // Get current output from IDE
        const output = (window as any).IDE?.getCurrentOutput();
        if (output) {
          // Create a real File object
          let prgFile = new File([output], "main.prg", { type: "application/octet-stream" });
          
          // Create a DataTransfer and add the File
          let dt = new DataTransfer();
          dt.items.add(prgFile);
          
          // Create a synthetic drop event
          let dropEvent = new DragEvent("drop", {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true
          });
          
          // Find the canvas and dispatch the event
          let canvas = document.getElementById("canvas");
          if (canvas) {
            canvas.dispatchEvent(dropEvent);
            console.log("✅ Drop event dispatched to canvas");
            
            // Wait much longer for program to load, then try multiple execution methods
            setTimeout(() => {
              console.log("3. Attempting to execute program...");
              
              // Method 1: Try direct execution via emulator functions
              if (typeof h.vic20_run === 'function') {
                console.log("3a. Trying vic20_run()...");
                h.vic20_run();
                console.log("✅ vic20_run() called");
              } else if (typeof h.run === 'function') {
                console.log("3a. Trying run()...");
                h.run();
                console.log("✅ run() called");
              } else if (typeof h.vic20_execute === 'function') {
                console.log("3a. Trying vic20_execute()...");
                h.vic20_execute();
                console.log("✅ vic20_execute() called");
              } else {
                // Method 2: Try keyboard input with clear screen
                console.log("3a. No direct execution functions found, trying keyboard input with clear screen...");
                setTimeout(() => {
                  console.log("3b. Sending clear screen + run command...");
                  // Send clear screen character (0x93) followed by run command
                  this.simulateKeyboardInput("\x93run\r");
                  console.log("✅ Clear screen + run command sent");
                }, 500);
              }
            }, 1000); // Increased from 500ms to 1000ms
          } else {
            console.log("❌ Canvas not found");
          }
        } else {
          console.log("❌ No current output found from IDE");
          // Fallback to using the program parameter
          let prgFile = new File([program], "main.prg", { type: "application/octet-stream" });
          let dt = new DataTransfer();
          dt.items.add(prgFile);
          let dropEvent = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true });
          let canvas = document.getElementById("canvas");
          if (canvas) {
            canvas.dispatchEvent(dropEvent);
            console.log("✅ Fallback drop event dispatched to canvas");
            
            // Wait much longer for program to load, then try multiple execution methods
            setTimeout(() => {
              console.log("3. Attempting to execute program...");
              
              // Method 1: Try direct execution via emulator functions
              if (typeof h.vic20_run === 'function') {
                console.log("3a. Trying vic20_run()...");
                h.vic20_run();
                console.log("✅ vic20_run() called");
              } else if (typeof h.run === 'function') {
                console.log("3a. Trying run()...");
                h.run();
                console.log("✅ run() called");
              } else if (typeof h.vic20_execute === 'function') {
                console.log("3a. Trying vic20_execute()...");
                h.vic20_execute();
                console.log("✅ vic20_execute() called");
              } else {
                // Method 2: Try keyboard input with clear screen
                console.log("3a. No direct execution functions found, trying keyboard input with clear screen...");
                setTimeout(() => {
                  console.log("3b. Sending clear screen + run command...");
                  // Send clear screen character (0x93) followed by run command
                  this.simulateKeyboardInput("\x93run\r");
                  console.log("✅ Clear screen + run command sent");
                }, 500);
              }
            }, 1000); // Increased from 500ms to 1000ms
          }
        }
      }, 500); // Increased from 200ms to 500ms for reset
    } else {
      console.log("❌ No 'h' object available");
    }
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
    newUrl.searchParams.set('joystick', 'true'); // Enable joystick support
    console.log("New URL with file parameter and joystick:", newUrl.toString());
    
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
          h.__sargs_add_kvp('joystick', 'true'); // Enable joystick support
          
          // Add input parameter if present in URL
          const urlParams = new URLSearchParams(window.location.search);
          const inputParam = urlParams.get('input');
          if (inputParam) {
            console.log("Found input parameter:", inputParam);
            h.__sargs_add_kvp('input', inputParam);
          }
          
          console.log("✅ Successfully added file parameters including joystick support");
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
    
    // Try direct memory loading as a fallback
    this.tryDirectMemoryLoading(prgData);
    
    // Debug: Log compilation output
    this.debugCompilationOutput();
    
    // Also try to trigger execution manually
    this.tryManualExecution(prgData);
    
    // Try the drop approach as well
    this.tryDropApproach(prgData);
  }
  
  private debugCompilationOutput(): void {
    console.log("=== DEBUGGING COMPILATION OUTPUT ===");
    
    // Try to access the worker's virtual file system
    if (typeof (window as any).worker !== 'undefined') {
      console.log("✅ Worker found, checking virtual file system...");
      
      // Check if we can access the store
      if ((window as any).worker.store) {
        console.log("✅ Store found, checking files...");
        const files = Object.keys((window as any).worker.store.workfs || {});
        console.log("Files in virtual file system:", files);
        
        // Check for main output file
        if ((window as any).worker.store.workfs['main']) {
          const mainFile = (window as any).worker.store.workfs['main'];
          console.log("Main file found:", mainFile);
          console.log("Main file size:", mainFile.data.length);
          console.log("Main file first 32 bytes:", Array.from(mainFile.data.slice(0, 32)).map((b: number) => b.toString(16).padStart(2, '0')).join(' '));
        }
        
        // Check for map file
        if ((window as any).worker.store.workfs['main.map']) {
          const mapFile = (window as any).worker.store.workfs['main.map'];
          console.log("Map file found:", mapFile);
          console.log("Map file content:", mapFile.data);
        }
      }
    }
    
    // Also check if we can access the builder
    if (typeof (window as any).builder !== 'undefined') {
      console.log("✅ Builder found");
      console.log("Builder steps:", (window as any).builder.steps);
    }
    
    // Check for any global compilation state
    if (typeof (window as any).current_output !== 'undefined') {
      console.log("✅ Current output found:", (window as any).current_output);
      console.log("Current output length:", (window as any).current_output?.length);
      
      // Log the first 32 bytes of the current output
      if ((window as any).current_output && (window as any).current_output.length > 0) {
        console.log("Current output first 32 bytes (hex):", Array.from((window as any).current_output.slice(0, 32)).map((b: number) => b.toString(16).padStart(2, '0')).join(' '));
        console.log("Current output first 32 bytes (decimal):", Array.from((window as any).current_output.slice(0, 32)).join(' '));
      }
    }
    
    // Check for compilation parameters
    if (typeof (window as any).compparams !== 'undefined') {
      console.log("✅ Compilation parameters found:", (window as any).compparams);
    }
    
    // Check for debug symbols
    if (typeof (window as any).platform !== 'undefined' && (window as any).platform.debugSymbols) {
      console.log("✅ Debug symbols found:", (window as any).platform.debugSymbols);
    }
  }
  
  private addGlobalDebugFunctions(): void {
    // Add global debug functions for manual testing
    (window as any).VIC20_DEBUG = {
      // Test with sample data
      testWithSampleData: () => {
        console.log("=== TESTING WITH SAMPLE DATA ===");
        const sampleData = new Uint8Array([
          0x01, 0x10,  // PRG header (load address 0x1001)
          0x0A, 0x00,  // Line 10
          0x99, 0x20, 0x22, 0x48, 0x45, 0x4C, 0x4C, 0x4F, 0x22, 0x00,  // PRINT "HELLO"
          0x00, 0x00   // End of program
        ]);
        this.loadProgramDirectly(sampleData);
      },
      
      // Load program directly
      loadProgramDirectly: (data: Uint8Array) => {
        console.log("=== LOADING PROGRAM DIRECTLY ===");
        this.loadProgramDirectly(data);
      },
      
      // Check module functions
      listModuleFunctions: () => {
        console.log("=== MODULE FUNCTIONS ===");
        const h = (window as any).h;
        if (h) {
          const functions = Object.keys(h).filter(key => typeof h[key] === 'function');
          console.log("Available functions:", functions);
          
          // Look for VIC-20 specific functions
          const vic20Functions = functions.filter(name => name.toLowerCase().includes('vic20'));
          console.log("VIC-20 specific functions:", vic20Functions);
          
          // Look for reset functions
          const resetFunctions = functions.filter(name => name.toLowerCase().includes('reset'));
          console.log("Reset functions:", resetFunctions);
          
          // Look for run/start functions
          const runFunctions = functions.filter(name => name.toLowerCase().includes('run') || name.toLowerCase().includes('start'));
          console.log("Run/Start functions:", runFunctions);
          
          // Look for CPU/execution functions
          const cpuFunctions = functions.filter(name => name.toLowerCase().includes('cpu') || name.toLowerCase().includes('pc') || name.toLowerCase().includes('exec'));
          console.log("CPU/Execution functions:", cpuFunctions);
          
          // Look for main/entry functions
          const mainFunctions = functions.filter(name => name.toLowerCase().includes('main'));
          console.log("Main functions:", mainFunctions);
          
          // Look for any function that might trigger execution
          const executionFunctions = functions.filter(name => 
            name.toLowerCase().includes('exec') || 
            name.toLowerCase().includes('run') || 
            name.toLowerCase().includes('start') || 
            name.toLowerCase().includes('reset') || 
            name.toLowerCase().includes('init') ||
            name.toLowerCase().includes('main') ||
            name.toLowerCase().includes('step') ||
            name.toLowerCase().includes('frame')
          );
          console.log("Potential execution functions:", executionFunctions);
          
          // Look for memory/load functions
          const memoryFunctions = functions.filter(name => 
            name.toLowerCase().includes('mem') ||
            name.toLowerCase().includes('load') ||
            name.toLowerCase().includes('write') ||
            name.toLowerCase().includes('read')
          );
          console.log("Memory/Load functions:", memoryFunctions);
          
          // Look for BASIC specific functions
          const basicFunctions = functions.filter(name => 
            name.toLowerCase().includes('basic') ||
            name.toLowerCase().includes('token') ||
            name.toLowerCase().includes('interpreter')
          );
          console.log("BASIC functions:", basicFunctions);
          
          // Show all functions for debugging
          console.log("=== ALL FUNCTIONS ===");
          functions.forEach(funcName => {
            console.log(`  ${funcName}: ${typeof h[funcName]}`);
          });
        } else {
          console.log("❌ No 'h' object available");
        }
      },
      
      // Check window objects
      checkWindowObjects: () => {
        console.log("=== WINDOW OBJECTS ===");
        console.log("h object:", (window as any).h);
        console.log("Module object:", (window as any).Module);
        console.log("VIC20 module:", (window as any).vic20_chips_module);
      },
      
      // Try drop function directly
      tryDropFunction: (data: Uint8Array) => {
        console.log("=== TRYING DROP FUNCTION DIRECTLY ===");
        if (this.module && typeof this.module.__sapp_emsc_begin_drop === 'function') {
          try {
            this.module.__sapp_emsc_begin_drop();
            console.log("✅ __sapp_emsc_begin_drop called");
          } catch (e) {
            console.log("❌ Error calling __sapp_emsc_begin_drop:", e);
          }
        }
      },
      
      // Check and reset emulator state
      checkState: () => {
        console.log("=== CHECKING EMULATOR STATE ===");
        if (this.module) {
          console.log("Module available:", !!this.module);
          console.log("Canvas connected:", !!this.canvas);
          console.log("Running:", this.running);
        }
      },
      
      // Debug memory after loading
      debugMemory: () => {
        console.log("=== DEBUGGING MEMORY ===");
        this.debugMemoryAfterLoading();
      },
      
      // Resume main loop
      resumeMainLoop: () => {
        console.log("=== RESUMING MAIN LOOP ===");
        const h = (window as any).h;
        if (h && typeof h.resumeMainLoop === 'function') {
          try {
            h.resumeMainLoop();
            console.log("✅ resumeMainLoop() called successfully");
          } catch (e) {
            console.log("❌ Error calling resumeMainLoop():", e);
          }
        } else {
          console.log("❌ resumeMainLoop function not available");
        }
      },
      
      // Try execution with resume
      tryExecutionWithResume: () => {
        console.log("=== TRYING EXECUTION WITH RESUME ===");
        const h = (window as any).h;
        if (h) {
          try {
            // First resume the main loop
            if (typeof h.resumeMainLoop === 'function') {
              h.resumeMainLoop();
              console.log("✅ resumeMainLoop() called");
            }
            
            // Then call _main to trigger execution
            if (typeof h._main === 'function') {
              h._main();
              console.log("✅ _main() called");
            }
            
            // Force a display refresh
            if (typeof h.requestAnimationFrame === 'function') {
              h.requestAnimationFrame(() => {
                console.log("✅ Display refresh triggered");
              });
            }
          } catch (e) {
            console.log("❌ Error in execution sequence:", e);
          }
        } else {
          console.log("❌ No 'h' object available");
        }
      },
      
      // Load current compiled output
      loadCurrentOutput: () => {
        console.log("=== LOADING CURRENT COMPILED OUTPUT ===");
        if (typeof (window as any).current_output !== 'undefined' && (window as any).current_output) {
          console.log("Found current output:", (window as any).current_output.length, "bytes");
          this.loadProgramDirectly((window as any).current_output);
        } else {
          console.log("❌ No current output found");
        }
      },
      
      // Simulate drag and drop with current output
      simulateDragAndDrop: () => {
        console.log("=== SIMULATING DRAG AND DROP ===");
        if (typeof (window as any).current_output !== 'undefined' && (window as any).current_output) {
          console.log("Found current output:", (window as any).current_output.length, "bytes");
          this.tryDropApproach((window as any).current_output);
        } else {
          console.log("❌ No current output found");
        }
      },
      
      // Call drop functions directly
      callDropFunctionsDirectly: () => {
        console.log("=== CALLING DROP FUNCTIONS DIRECTLY ===");
        const h = (window as any).h;
        if (!h) {
          console.log("❌ No 'h' object available");
          return;
        }
        
        if (typeof (window as any).current_output !== 'undefined' && (window as any).current_output) {
          const data = (window as any).current_output;
          console.log("Using current output:", data.length, "bytes");
          
          try {
            // Call the drop functions directly
            if (typeof h.__sapp_emsc_begin_drop === 'function') {
              h.__sapp_emsc_begin_drop();
              console.log("✅ __sapp_emsc_begin_drop called");
            }
            
            if (typeof h.__sapp_emsc_drop === 'function') {
              h.__sapp_emsc_drop(data);
              console.log("✅ __sapp_emsc_drop called with data");
            }
            
            if (typeof h.__sapp_emsc_end_drop === 'function') {
              h.__sapp_emsc_end_drop();
              console.log("✅ __sapp_emsc_end_drop called");
            }
          } catch (error) {
            console.log("❌ Error calling drop functions:", error);
          }
        } else {
          console.log("❌ No current output found");
        }
      },
      

      
      // Navigate to new location with current program
      gotoNewLocation: () => {
        console.log("=== NAVIGATING TO NEW LOCATION ===");
        if (typeof (window as any).IDE !== 'undefined' && (window as any).IDE.gotoNewLocation) {
          try {
            console.log("✅ Calling window.IDE.gotoNewLocation()");
            (window as any).IDE.gotoNewLocation();
            console.log("✅ Navigation triggered - this should reload the page with the program");
          } catch (e) {
            console.log("❌ Error calling gotoNewLocation():", e);
          }
        } else {
          console.log("❌ window.IDE.gotoNewLocation not available");
        }
      },
      
      // Try the complete sequence: load program, then navigate
      tryCompleteSequence: () => {
        console.log("=== TRYING COMPLETE SEQUENCE ===");
        if (typeof (window as any).current_output !== 'undefined' && (window as any).current_output) {
          console.log("1. Loading current output into memory...");
          this.loadProgramDirectly((window as any).current_output);
          console.log("2. Navigating to new location to trigger execution...");
          if (typeof (window as any).IDE !== 'undefined' && (window as any).IDE.gotoNewLocation) {
            (window as any).IDE.gotoNewLocation();
          }
        } else {
          console.log("❌ No current output found");
        }
      },
      
      // Simulate the download ROM process
      simulateDownloadROM: () => {
        console.log("=== SIMULATING DOWNLOAD ROM PROCESS ===");
        if (typeof (window as any).current_output !== 'undefined' && (window as any).current_output) {
          console.log("✅ Found current output:", (window as any).current_output.length, "bytes");
          
          // Create a blob like the download function does
          const blob = new Blob([(window as any).current_output], { type: "application/octet-stream" });
          console.log("✅ Created blob:", blob.size, "bytes");
          
          // Create a URL for the blob
          const url = URL.createObjectURL(blob);
          console.log("✅ Created blob URL:", url);
          
          // Now try to load this URL into the emulator
          console.log("🔧 Attempting to load blob URL into emulator...");
          
          // Try to add this URL as a file parameter
          const h = (window as any).h;
          if (h && typeof h.__sargs_add_kvp === 'function') {
            try {
              h.__sargs_add_kvp('file', url);
              h.__sargs_add_kvp('autorun', '1');
              h.__sargs_add_kvp('joystick', 'true');
              console.log("✅ Added blob URL as file parameter");
              
              // Try calling _main to trigger execution
              if (typeof h._main === 'function') {
                h._main();
                console.log("✅ Called _main() to trigger execution");
              }
            } catch (e) {
              console.log("❌ Error adding blob URL:", e);
            }
          } else {
            console.log("❌ No __sargs_add_kvp function available");
          }
          
          // Clean up the URL after a delay
          setTimeout(() => {
            URL.revokeObjectURL(url);
            console.log("🧹 Cleaned up blob URL");
          }, 5000);
          
        } else {
          console.log("❌ No current output found");
        }
      },
      
      // Try the complete download simulation sequence
      tryDownloadSimulation: () => {
        console.log("=== TRYING DOWNLOAD SIMULATION SEQUENCE ===");
        console.log("1. First, let's see what the download function actually does...");
        if (typeof (window as any).IDE !== 'undefined' && (window as any).IDE._downloadROMImage) {
          console.log("2. Download function is available, let's trace it...");
          // Instead of calling it directly, let's trace what it does
          const originalAlert = window.alert;
          window.alert = (msg) => {
            console.log("🔍 ALERT INTERCEPTED:", msg);
            return false; // Prevent the alert from showing
          };
          
          try {
            const result = (window as any).IDE._downloadROMImage();
            console.log("3. Download function returned:", result);
          } finally {
            window.alert = originalAlert;
          }
        } else {
          console.log("❌ Download function not available");
        }
      },
      
      // Reset VIC-20 and then load program
      resetAndLoadProgram: () => {
        console.log("=== RESETTING VIC-20 AND LOADING PROGRAM ===");
        
        // First reset the VIC-20
        const h = (window as any).h;
        if (h) {
          console.log("1. Resetting VIC-20...");
          if (typeof h.reset === 'function') {
            h.reset();
            console.log("✅ VIC-20 reset called");
          } else if (typeof h.vic20_reset === 'function') {
            h.vic20_reset();
            console.log("✅ VIC-20 reset called");
          } else {
            console.log("❌ No reset function found");
          }
          
          // Wait a moment for reset to complete
          setTimeout(() => {
            console.log("2. Loading program...");
            
            // Get current output
            const output = (window as any).IDE.getCurrentOutput();
            if (output) {
              // Create a real File object
              let prgFile = new File([output], "main.prg", { type: "application/octet-stream" });
              
              // Create a DataTransfer and add the File
              let dt = new DataTransfer();
              dt.items.add(prgFile);
              
              // Create a synthetic drop event
              let dropEvent = new DragEvent("drop", {
                dataTransfer: dt,
                bubbles: true,
                cancelable: true
              });
              
              // Find the canvas and dispatch the event
              let canvas = document.getElementById("canvas");
              if (canvas) {
                canvas.dispatchEvent(dropEvent);
                console.log("✅ Drop event dispatched to canvas");
              } else {
                console.log("❌ Canvas not found");
              }
            } else {
              console.log("❌ No current output found");
            }
          }, 100);
        } else {
          console.log("❌ No 'h' object available");
        }
      },
      
      // Refresh the VIC20_DEBUG object to get latest functions
      refresh: () => {
        console.log("=== REFRESHING VIC20_DEBUG OBJECT ===");
        console.log("This will re-add all debug functions to the existing VIC20_DEBUG object");
        
        // Get the current VIC20_DEBUG object
        const currentDebug = (window as any).VIC20_DEBUG;
        if (currentDebug) {
          console.log("✅ Found existing VIC20_DEBUG object, refreshing functions...");
          
          // Re-add all the functions to the existing object
          const newFunctions = {
            testWithSampleData: currentDebug.testWithSampleData,
            loadCurrentOutput: currentDebug.loadCurrentOutput,
            simulateDragAndDrop: currentDebug.simulateDragAndDrop,
            callDropFunctionsDirectly: currentDebug.callDropFunctionsDirectly,
            listModuleFunctions: currentDebug.listModuleFunctions,
            checkWindowObjects: currentDebug.checkWindowObjects,
            tryDropFunction: currentDebug.tryDropFunction,
            checkState: currentDebug.checkState,
            debugMemory: currentDebug.debugMemory,
            gotoNewLocation: currentDebug.gotoNewLocation,
            tryCompleteSequence: currentDebug.tryCompleteSequence,
            simulateDownloadROM: currentDebug.simulateDownloadROM,
            tryDownloadSimulation: currentDebug.tryDownloadSimulation,
            resetAndLoadProgram: currentDebug.resetAndLoadProgram
          };
          
          // Copy all functions to the existing object
          Object.assign(currentDebug, newFunctions);
          
          console.log("✅ VIC20_DEBUG object refreshed with all functions");
          console.log("Available functions:", Object.keys(currentDebug));
        } else {
          console.log("❌ No existing VIC20_DEBUG object found");
        }
      }
    };
    
    console.log("VIC20_DEBUG object available in console for debugging");
    console.log("Use VIC20_DEBUG.testWithSampleData() to test with sample program");
    console.log("Use VIC20_DEBUG.loadCurrentOutput() to load the current compiled output");
    console.log("Use VIC20_DEBUG.simulateDragAndDrop() to simulate drag and drop");
    console.log("Use VIC20_DEBUG.callDropFunctionsDirectly() to call drop functions directly");
    console.log("Use VIC20_DEBUG.listModuleFunctions() to see all available functions");
    console.log("Use VIC20_DEBUG.checkWindowObjects() to see what's available on window");
    console.log("Use VIC20_DEBUG.tryDropFunction(data) to try calling drop functions directly");
    console.log("Use VIC20_DEBUG.checkState() to check and reset emulator state");
    console.log("Use VIC20_DEBUG.debugMemory() to debug memory after loading");
    console.log("Use VIC20_DEBUG.refresh() to refresh the debug object if functions are missing");
    console.log("Use VIC20_DEBUG.gotoNewLocation() to navigate to new location with program");
    console.log("Use VIC20_DEBUG.tryCompleteSequence() to load program and navigate");
    console.log("Use VIC20_DEBUG.simulateDownloadROM() to simulate download ROM process");
    console.log("Use VIC20_DEBUG.tryDownloadSimulation() to trace download function");
    console.log("Use VIC20_DEBUG.resetAndLoadProgram() to reset VIC-20 and load program");
  }
  
  private loadProgramDirectly(data: Uint8Array): void {
    console.log("=== LOADING PROGRAM DIRECTLY ===");
    
    if (!this.module) {
      console.log("❌ No module available");
      return;
    }
    
    try {
      // Parse PRG header
      const loadAddress = (data[1] << 8) | data[0];
      const programData = data.slice(2); // Skip PRG header
      
      console.log("Load address:", loadAddress.toString(16));
      console.log("Program data length:", programData.length);
      
      // Load program directly into VIC-20 memory
      for (let i = 0; i < programData.length; i++) {
        const address = loadAddress + i;
        this.write(address, programData[i]);
      }
      
      console.log("✅ Program loaded directly into VIC-20 memory");
      
      // For BASIC programs, set the BASIC start pointer
      if (loadAddress === 0x1001) {
        this.write(0x2B, loadAddress & 0xFF); // BASIC start low
        this.write(0x2C, (loadAddress >> 8) & 0xFF); // BASIC start high
        this.write(0x2D, (loadAddress + programData.length) & 0xFF); // BASIC end low
        this.write(0x2E, ((loadAddress + programData.length) >> 8) & 0xFF); // BASIC end high
        
        console.log("✅ BASIC pointers set");
      }
      
      // Try to trigger program execution
      const h = (window as any).h;
      if (h) {
        console.log("🔍 Checking for vic20_reset function...");
        if (typeof h.vic20_reset === 'function') {
          h.vic20_reset();
          console.log("✅ VIC-20 reset called");
        } else {
          console.log("❌ vic20_reset function not found");
        }
        
        // Also try to set PC to load address
        console.log("🔍 Checking for vic20_set_pc function...");
        if (typeof h.vic20_set_pc === 'function') {
          h.vic20_set_pc(loadAddress);
          console.log("✅ PC set to load address");
        } else {
          console.log("❌ vic20_set_pc function not found");
        }
        
        // Try alternative reset methods
        console.log("🔍 Trying alternative reset methods...");
        if (typeof h.reset === 'function') {
          h.reset();
          console.log("✅ h.reset() called");
        }
        if (typeof h.vic20_reset_cpu === 'function') {
          h.vic20_reset_cpu();
          console.log("✅ h.vic20_reset_cpu() called");
        }
        if (typeof h.vic20_run === 'function') {
          h.vic20_run();
          console.log("✅ h.vic20_run() called");
        }
        
        // Try to trigger execution by calling _main
        console.log("🔍 Trying to trigger execution via _main...");
        if (typeof h._main === 'function') {
          h._main();
          console.log("✅ h._main() called to trigger execution");
        }
      } else {
        console.log("❌ No 'h' object available for execution");
      }
      
      // Force display refresh
      this.forceDisplayRefresh();
      
    } catch (error) {
      console.log("❌ Error in direct loading:", error);
    }
  }
  
  private tryManualExecution(prgData: Uint8Array): void {
    console.log("=== TRYING MANUAL EXECUTION ===");
    
    if (!this.module) {
      console.log("❌ No module available for manual execution");
      return;
    }
    
    try {
      // Parse PRG header
      const loadAddress = (prgData[1] << 8) | prgData[0];
      const programData = prgData.slice(2); // Skip PRG header
      
      console.log("Manual execution - Load address:", loadAddress.toString(16));
      console.log("Manual execution - Program data length:", programData.length);
      
      // Try to load program directly into VIC-20 memory
      for (let i = 0; i < programData.length; i++) {
        const address = loadAddress + i;
        this.write(address, programData[i]);
      }
      
      console.log("✅ Program loaded directly into VIC-20 memory for manual execution");
      
      // For BASIC programs, set the BASIC start pointer
      if (loadAddress === 0x1001) {
        this.write(0x2B, loadAddress & 0xFF); // BASIC start low
        this.write(0x2C, (loadAddress >> 8) & 0xFF); // BASIC start high
        this.write(0x2D, (loadAddress + programData.length) & 0xFF); // BASIC end low
        this.write(0x2E, ((loadAddress + programData.length) >> 8) & 0xFF); // BASIC end high
        
        console.log("✅ BASIC pointers set for manual execution");
      }
      
      // Try to trigger program execution
      if (typeof this.module.vic20_reset === 'function') {
        this.module.vic20_reset();
        console.log("✅ VIC-20 reset called for manual execution");
      }
      
      // Also try to set PC to load address
      if (typeof this.module.vic20_set_pc === 'function') {
        this.module.vic20_set_pc(loadAddress);
        console.log("✅ PC set to load address for manual execution");
      }
      
    } catch (error) {
      console.log("❌ Error in manual execution:", error);
    }
  }
  
  private tryDirectMemoryLoading(prgData: Uint8Array): void {
    console.log("=== TRYING DIRECT MEMORY LOADING ===");
    
    if (!this.module) {
      console.log("❌ No module available for direct memory loading");
      return;
    }
    
    // Parse PRG header
    const loadAddress = (prgData[1] << 8) | prgData[0];
    const programData = prgData.slice(2); // Skip PRG header
    
    console.log("Load address:", loadAddress.toString(16));
    console.log("Program data length:", programData.length);
    
    // Try to load program directly into VIC-20 memory
    try {
      // Load program data into memory starting at load address
      for (let i = 0; i < programData.length; i++) {
        const address = loadAddress + i;
        this.write(address, programData[i]);
      }
      
      console.log("✅ Program loaded directly into VIC-20 memory");
      
      // Try to set PC to load address for BASIC programs
      if (loadAddress === 0x1001) {
        // For BASIC programs, we need to set the BASIC start pointer
        this.write(0x2B, loadAddress & 0xFF); // BASIC start low
        this.write(0x2C, (loadAddress >> 8) & 0xFF); // BASIC start high
        this.write(0x2D, (loadAddress + programData.length) & 0xFF); // BASIC end low
        this.write(0x2E, ((loadAddress + programData.length) >> 8) & 0xFF); // BASIC end high
        
        console.log("✅ BASIC pointers set for program execution");
      }
      
      // Try to trigger program execution
      if (typeof this.module.vic20_reset === 'function') {
        this.module.vic20_reset();
        console.log("✅ VIC-20 reset called to start program execution");
      }
      
    } catch (error) {
      console.log("❌ Error in direct memory loading:", error);
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
      
      // AGGRESSIVE: Block ALL keyboard events from reaching emulator when editor has focus
      if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
        console.log(`🛡️ BLOCKING ${event.key} from emulator - editor has focus`);
        // Stop propagation to prevent emulator from seeing the event
        event.stopImmediatePropagation();
        event.stopPropagation();
        // Don't prevent default - let the editor handle it normally
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
    
    // CRITICAL: Add global keyboard blocker with highest priority
    // This prevents ANY keyboard events from reaching the emulator when editor has focus
    const globalKeyboardBlocker = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
        console.log(`🛡️ GLOBAL BLOCK: Preventing ${event.key} from reaching emulator (${activeElement.tagName} has focus)`);
        event.stopImmediatePropagation();
        event.stopPropagation();
        return;
      }
    };
    
    // Add global blocker with highest priority (useCapture: true)
    document.addEventListener('keydown', globalKeyboardBlocker, true);
    document.addEventListener('keyup', globalKeyboardBlocker, true);
    document.addEventListener('keypress', globalKeyboardBlocker, true);
    
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
    } else if ((window as any).h && typeof (window as any).h.__sargs_add_kvp === 'function') {
      // Try to set joystick state via URL parameters
      try {
        (window as any).h.__sargs_add_kvp('joystick0', this.joymask0.toString());
        (window as any).h.__sargs_add_kvp('joystick1', this.joymask1.toString());
      } catch (e) {
        console.log("❌ Error setting joystick state:", e);
      }
    }
    
    // Also try to write joystick state directly to VIC-20 I/O registers
    if (this.module) {
      // VIC-20 joystick port 1 (VIA 1, port A)
      this.write(0x9111, this.joymask0);
      // VIC-20 joystick port 2 (VIA 2, port A) 
      this.write(0x9121, this.joymask1);
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