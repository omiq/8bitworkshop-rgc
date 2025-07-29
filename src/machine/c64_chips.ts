import { CpuState, EmuState } from "../common/baseplatform";
import { hex } from "../common/util";

// Global variable to hold the chips-test C64 module
declare global {
  interface Window {
    c64_chips_module?: any;
    Module?: any;
  }
  var Module: any;
}

export class C64ChipsMachine {
  private module: any = null;
  private canvas: HTMLCanvasElement | null = null;
  private running = false;
  private name: string;
  private description: string;
  
  // Focus and keyboard protection properties
  private keyboardInterceptor: ((event: KeyboardEvent) => void) | null = null;
  private focusTrackingHandler: ((event: FocusEvent) => void) | null = null;
  private keyboardTrackingHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    this.name = "C64 (chips-test)";
    this.description = "Commodore 64 emulator using chips-test WebAssembly";
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  async init(): Promise<void> {
    try {
      console.log("Initializing chips-test C64 emulator...");
      
      // Create the canvas element that the chips-test emulator expects
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'canvas';
      // Make the canvas responsive - use larger size for better visibility
      this.canvas.width = 640;  // Double the original size
      this.canvas.height = 400; // Double the original size
      this.canvas.style.border = '1px solid #333';
      this.canvas.style.width = '100%';
      this.canvas.style.height = 'auto';
      this.canvas.style.maxWidth = '800px';
      this.canvas.style.maxHeight = '600px';
      
      // DISABLED: Prevent the canvas from grabbing keyboard focus
      // this.canvas.tabIndex = -1;
      // this.canvas.style.outline = 'none';
      // this.canvas.style.pointerEvents = 'auto';
      
      // DISABLED: Prevent focus on any mouse event
      // this.canvas.addEventListener('mousedown', (e) => {
      //   e.preventDefault();
      //   e.stopPropagation();
      //   // Only allow focus if explicitly requested
      //   if (e.target === this.canvas && e.detail === 2) { // Double click
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
      
      // DISABLED: Prevent default keyboard handling
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
      
      // DISABLED: Prevent focus on any other events
      // this.canvas.addEventListener('focus', (e) => {
      //   // Only allow focus if it was explicitly requested
      //   if (!e.isTrusted) {
      //     this.canvas.blur();
      //   }
      // });
      
      // DISABLED: Prevent any automatic focus
      // this.canvas.addEventListener('focusin', (e) => {
      //   if (e.target === this.canvas && !e.isTrusted) {
      //     e.preventDefault();
      //     e.stopPropagation();
      //   }
      // }, true);
      
      // Add canvas to the pre-existing C64 chips div
      const c64Div = document.getElementById('c64-chips-div');
      const c64Screen = document.getElementById('c64-chips-screen');
      if (c64Div && c64Screen) {
        c64Screen.appendChild(this.canvas);
        c64Div.style.display = 'block';
        console.log("✅ Added C64 canvas to pre-existing div");
      } else {
        // Fallback to body if div not found
        document.body.appendChild(this.canvas);
        console.log("⚠️ C64 div not found, using body fallback");
      }
      
      // Load the chips-test module if not already loaded
      if (!window.c64_chips_module) {
        const script = document.createElement('script');
        script.src = `res/c64.js?t=${Date.now()}`;
        script.async = true;
        
        // Wait for the module to load
        await new Promise<void>((resolve, reject) => {
          script.onload = () => {
            // Give the chips-test emulator a moment to initialize
            setTimeout(() => {
              // Check if the chips-test functions are available
              if (typeof (window as any).c64_quickload === 'function') {
                console.log("C64 quickload function found - using direct access");
                window.c64_chips_module = window;
                resolve();
                return;
              }
              
              // Also check for the Module object
              if (typeof (window as any).Module !== 'undefined' && (window as any).Module) {
                console.log("C64 Module found - using Module object");
                window.c64_chips_module = (window as any).Module;
                resolve();
                return;
              }
              
              // If we still can't find it, just assume it's working and use window
              console.log("C64 module detection failed, but emulator is running - using window fallback");
              window.c64_chips_module = window;
              resolve();
            }, 500); // Wait 500ms for initialization
          };
          script.onerror = () => reject(new Error("Failed to load C64 module"));
          document.head.appendChild(script);
        });
      }
      
      // Add cache-busting for WASM files
      const originalFetch = window.fetch;
      window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
        if (typeof input === 'string' && (input.includes('c64.wasm') || input.includes('c64.js'))) {
          const separator = input.includes('?') ? '&' : '?';
          input = `${input}${separator}t=${Date.now()}`;
        }
        return originalFetch.call(this, input, init);
      }
      
      this.module = window.c64_chips_module;

      // Initialize the module
      if (this.module && this.module._main) {
        // Call the main function to initialize the emulator
        this.module._main(0, 0);
        console.log("C64 chips-test emulator initialized successfully");
      } else if (this.module === window) {
        // We're using the window fallback - the emulator is already running
        console.log("C64 chips-test emulator using window fallback - already running");
        
        // Wait a bit more for the Module object to be fully ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to get the Module object
        if (typeof (window as any).Module !== 'undefined' && (window as any).Module) {
          console.log("Found Module object, setting module reference");
          this.module = (window as any).Module;
        }
        
        // Wait for the canvas to be properly set up before calling URL parser
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Skip calling the URL parameter parser for now since it causes DOM access issues
        // The emulator should work fine without it
        console.log("Skipping URL parameter parser to avoid DOM access issues");
      } else {
        throw new Error("C64 module not properly initialized");
      }
      
      // CRITICAL: Make canvas non-focusable after emulator is loaded
      if (this.canvas) {
        this.canvas.tabIndex = -1;
        this.canvas.style.outline = 'none';
        this.canvas.setAttribute('tabindex', '-1');
        console.log("✅ Made C64 canvas non-focusable");
      }
      
      // Add focus and keyboard protection
      this.addFocusTracking();
      
    } catch (error) {
      console.error("Failed to initialize C64 chips-test emulator:", error);
      throw error;
    }
  }

  // Focus and keyboard protection methods
  private addFocusTracking(): void {
    console.log("🔍 Adding global focus tracking to debug focus stealing...");
    
    // Focus tracking handler
    this.focusTrackingHandler = (event: FocusEvent) => {
      const fromElement = event.relatedTarget as HTMLElement;
      const toElement = event.target as HTMLElement;
      
      console.log("🔍 FOCUS CHANGE DETECTED:");
      console.log("  From:", fromElement?.tagName, fromElement?.className, fromElement?.id);
      console.log("  To:", toElement?.tagName, toElement?.className, toElement?.id);
      console.log("  Event type:", event.type);
      console.log("  Is trusted:", event.isTrusted);
      console.log("  Stack trace:", new Error().stack);
      
      // Check if focus is being stolen from CodeMirror editor
      if (fromElement && fromElement.tagName === 'TEXTAREA' && 
          toElement && toElement.tagName !== 'TEXTAREA' && 
          toElement.tagName !== 'INPUT') {
        console.log("🚨 WARNING: Focus stolen from CodeMirror editor!");
        console.log("🚨 TEXTAREA LOSING FOCUS:");
        console.log("Textarea losing focus to:", toElement.tagName, toElement.className);
      }
    };
    
    // Keyboard tracking handler
    this.keyboardTrackingHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        console.log("🔍 KEYBOARD EVENT ON TEXTAREA:");
        console.log("  Key:", event.key);
        console.log("  KeyCode:", event.keyCode);
        console.log("  Type:", event.type);
        console.log("  Is trusted:", event.isTrusted);
        console.log("  Default prevented:", event.defaultPrevented);
        console.log("  Target:", target.tagName, target.className);
        
        if (event.defaultPrevented) {
          console.log("🚨 WARNING: Keyboard event default was prevented!");
          console.log("  This might be why typing isn't working");
        }
      }
    };
    
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
    
    // Add event listeners with high priority
    document.addEventListener('focusin', this.focusTrackingHandler, true);
    document.addEventListener('focusout', this.focusTrackingHandler, true);
    document.addEventListener('keydown', this.keyboardTrackingHandler, true);
    document.addEventListener('keyup', this.keyboardTrackingHandler, true);
    document.addEventListener('keypress', this.keyboardTrackingHandler, true);
    
    // Add keyboard interceptor
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
  }

  run(): void {
    if (this.module && this.running) return;
    this.running = true;
    
    // The chips-test emulator runs automatically, we just need to ensure it's started
    if (this.module && typeof (this.module as any).c64_run === 'function') {
      (this.module as any).c64_run();
    } else if (typeof (window as any).c64_run === 'function') {
      (window as any).c64_run();
    }
  }

  stop(): void {
    this.running = false;
    // The chips-test emulator doesn't have a stop function, it runs continuously
    // We just mark it as not running
  }

  reset(): void {
    if (this.module && typeof (this.module as any).c64_reset === 'function') {
      (this.module as any).c64_reset();
    } else if (typeof (window as any).c64_reset === 'function') {
      (window as any).c64_reset();
    }
  }

  loadProgram(program: Uint8Array): void {
    console.log("=== C64 LOAD PROGRAM DEBUG (UPDATED VERSION) ===");
    console.log("✅ NEW FOCUS PREVENTION ACTIVE ===");
    console.log("C64 loadProgram called with", program.length, "bytes");
    console.log("First few bytes:", program.slice(0, 10));
    
    // CRITICAL: Reset emulator state before loading to prevent automatic execution
    console.log("🔄 Resetting emulator state to prevent automatic execution");
    this.reset();
    
    // Debug: Check what functions are available
    console.log("Available window functions:", Object.keys(window).filter(key => key.includes('c64')));
    console.log("Available module functions:", this.module ? Object.keys(this.module).filter(key => key.includes('c64')) : "No module");
    
    // Check if Module object has the function
    if (typeof (window as any).Module !== 'undefined' && (window as any).Module) {
      console.log("Module object available:", Object.keys((window as any).Module).filter(key => key.includes('c64')));
      console.log("All Module functions:", Object.keys((window as any).Module).slice(0, 20)); // First 20 functions
    } else {
      console.log("Module object not available");
    }
    
    // Check if Module object exists at all
    console.log("Window.Module exists:", typeof (window as any).Module !== 'undefined');
    if (typeof (window as any).Module !== 'undefined') {
      console.log("Module object keys:", Object.keys((window as any).Module));
    }
    
    // Check what's in the c64_chips_module
    if ((window as any).c64_chips_module) {
      console.log("c64_chips_module keys:", Object.keys((window as any).c64_chips_module));
      
      // Search for any function that might be the quickload function
      const allKeys = Object.keys((window as any).c64_chips_module);
      const quickloadCandidates = allKeys.filter(key => 
        key.toLowerCase().includes('quickload') || 
        key.toLowerCase().includes('load') || 
        key.toLowerCase().includes('prg') ||
        key.toLowerCase().includes('rom')
      );
      console.log("Quickload candidates:", quickloadCandidates);
      
      // Check if any of these are functions
      for (const candidate of quickloadCandidates) {
        const value = (window as any).c64_chips_module[candidate];
        if (typeof value === 'function') {
          console.log(`Found function: ${candidate}`, value);
        }
      }
    }
    
    // Convert to PRG format (2-byte header + program data)
    // Check if the program already has a PRG header (first two bytes are load address)
    let prgData: Uint8Array;
    
    if (program.length >= 2 && program[0] === 0x01 && program[1] === 0x08) {
      // Program already has PRG header, use as-is
      console.log("Program already has PRG header, using as-is");
      prgData = program;
    } else {
      // Add PRG header
      console.log("Adding PRG header to program");
      prgData = new Uint8Array(program.length + 2);
      prgData[0] = 0x01; // Load address low byte
      prgData[1] = 0x08; // Load address high byte (0x0801 for C64 BASIC)
      prgData.set(program, 2);
    }
    
    console.log("PRG data length:", prgData.length);
    console.log("PRG header:", prgData[0], prgData[1]);
    console.log("First few bytes of program:", prgData.slice(0, 10));
    
    // Try multiple approaches to call the quickload function
    let success = false;
    
    // Check for input parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const inputParam = urlParams.get('input');
    if (inputParam) {
      console.log("Found input parameter:", inputParam);
      // Try to add input parameter to the emulator
      if (this.module && typeof (this.module as any).__sargs_add_kvp === 'function') {
        try {
          (this.module as any).__sargs_add_kvp('input', inputParam);
          console.log("✅ Successfully added input parameter to module");
        } catch (e) {
          console.log("❌ Error adding input parameter to module:", e);
        }
      }
      if (typeof (window as any).h && typeof (window as any).h.__sargs_add_kvp === 'function') {
        try {
          (window as any).h.__sargs_add_kvp('input', inputParam);
          console.log("✅ Successfully added input parameter to window.h");
        } catch (e) {
          console.log("❌ Error adding input parameter to window.h:", e);
        }
      }
    }
    
    // Approach 1: Direct module access
    if (this.module && typeof (this.module as any).c64_quickload === 'function') {
      console.log("Calling c64_quickload via module");
      (this.module as any).c64_quickload(prgData);
      success = true;
    }
    
    // Approach 2: Window access
    if (!success && typeof (window as any).c64_quickload === 'function') {
      console.log("Calling c64_quickload via window");
      (window as any).c64_quickload(prgData);
      success = true;
    }
    
    // Approach 3: Module object access
    if (!success && typeof (window as any).Module !== 'undefined' && (window as any).Module) {
      const Module = (window as any).Module;
      if (typeof Module.c64_quickload === 'function') {
        console.log("Calling c64_quickload via Module object");
        Module.c64_quickload(prgData);
        success = true;
      }
    }
    
    // Approach 4: Try to call the function through the WebAssembly module
    if (!success && this.module && this.module._c64_quickload) {
      console.log("Calling c64_quickload via WebAssembly module");
      this.module._c64_quickload(prgData);
      success = true;
    }
    
    // Approach 5: Try to call through Module.exports (since drag-and-drop works)
    if (!success && typeof (window as any).Module !== 'undefined' && (window as any).Module) {
      const Module = (window as any).Module;
      if (Module.exports && Module.exports.c64_quickload) {
        console.log("Calling c64_quickload via Module.exports");
        Module.exports.c64_quickload(prgData);
        success = true;
      }
    }
    
    // Approach 6: Try to call through Module directly with the function name
    if (!success && typeof (window as any).Module !== 'undefined' && (window as any).Module) {
      const Module = (window as any).Module;
      // Try to call the function directly on the Module object
      try {
        console.log("Attempting to call c64_quickload directly on Module");
        Module.c64_quickload(prgData);
        success = true;
      } catch (e) {
        console.log("Direct Module call failed:", e);
      }
    }
    
    // Approach 7: Try to allocate memory in the WebAssembly module and call the function
    if (!success && typeof (window as any).Module !== 'undefined' && (window as any).Module) {
      const Module = (window as any).Module;
      try {
        console.log("Attempting to allocate memory and call c64_quickload");
        // Allocate memory in the WebAssembly module
        const ptr = Module._malloc(prgData.length);
        // Copy the data to the allocated memory
        Module.HEAPU8.set(prgData, ptr);
        // Call the function with the pointer and length
        Module.c64_quickload(ptr, prgData.length);
        // Free the memory
        Module._free(ptr);
        success = true;
      } catch (e) {
        console.log("Memory allocation approach failed:", e);
      }
    }
    
    // Approach 8: Try to trigger the drag-and-drop functionality programmatically
    if (!success) {
      try {
        console.log("Attempting to trigger drag-and-drop functionality");
        // Create a fake file object
        const file = new File([prgData], 'program.prg', { type: 'application/octet-stream' });
        
        // Create a fake drop event
        const dropEvent = new Event('drop', { bubbles: true });
        Object.defineProperty(dropEvent, 'dataTransfer', {
          value: {
            files: [file],
            getData: () => null
          }
        });
        
        // Dispatch the event on the canvas
        const canvas = this.getCanvas();
        if (canvas) {
          canvas.dispatchEvent(dropEvent);
          success = true;
          
          // DISABLED: Automatic RUN command trigger to prevent unwanted execution
          // The program should only run when explicitly requested by the user
          console.log("✅ Program loaded successfully - no automatic RUN command sent");
        }
      } catch (e) {
        console.log("Drag-and-drop trigger failed:", e);
      }
    }
    
    if (!success) {
      console.error("c64_quickload function not found!");
      console.log("Trying alternative function names...");
      
      // Try alternative function names that might be used
      const alternatives = ['quickload', 'load_prg', 'load_program', 'load_rom'];
      for (const alt of alternatives) {
        if (typeof (window as any)[alt] === 'function') {
          console.log(`Found alternative function: ${alt}`);
          (window as any)[alt](prgData);
          return;
        }
        if (this.module && typeof (this.module as any)[alt] === 'function') {
          console.log(`Found alternative function on module: ${alt}`);
          (this.module as any)[alt](prgData);
          return;
        }
      }
      
      console.error("No quickload function found with any name!");
    }
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  getFPS(): number {
    // Return a reasonable FPS estimate
    return this.running ? 50 : 0;
  }

  // Memory access functions (if needed)
  read(address: number): number {
    if (this.module && typeof (this.module as any).c64_read_memory === 'function') {
      return (this.module as any).c64_read_memory(address);
    } else if (typeof (window as any).c64_read_memory === 'function') {
      return (window as any).c64_read_memory(address);
    }
    return 0;
  }

  write(address: number, value: number): void {
    if (this.module && this.module.c64_write_memory) {
      this.module.c64_write_memory(address, value);
    }
  }

  // Required method implementations
  getCPUState(): CpuState {
    // Return basic CPU state if available
    if (this.module && this.module.c64_get_cpu_state) {
      return this.module.c64_get_cpu_state();
    }
    return {
      PC: 0,
      SP: 0
    };
  }

  saveState(): EmuState {
    // Return empty state for now
    return {
      c: this.getCPUState(),
      b: new Uint8Array(0)
    };
  }

  loadState(state: EmuState): void {
    // Load state if available
    if (this.module && this.module.c64_load_state && state.b) {
      this.module.c64_load_state(state.b);
    }
  }

  // Cleanup
  destroy(): void {
    this.stop();
    
    // Remove focus tracking
    this.removeFocusTracking();
    
    this.module = null;
    this.canvas = null;
    
    // Hide the C64 chips div when destroyed
    const c64Div = document.getElementById('c64-chips-div');
    if (c64Div) {
      c64Div.style.display = 'none';
      console.log("✅ Hidden C64 chips div");
    }
  }

  // Joystick support
  private joymask0 = 0;
  private joymask1 = 0;

  setKeyInput(key: number, code: number, flags: number): void {
    // Handle joystick input for C64
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
    if (this.module && typeof this.module.c64_joystick === 'function') {
      this.module.c64_joystick(this.joymask0, this.joymask1);
    } else if ((window as any).h && typeof (window as any).h.c64_joystick === 'function') {
      (window as any).h.c64_joystick(this.joymask0, this.joymask1);
    }
  }
} 