import { Platform } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";

class X86DOSBoxPlatform implements Platform {
    mainElement: HTMLElement;
    private pauseResumeSupported = false;

    constructor(mainElement: HTMLElement) {
        this.mainElement = mainElement;
        
        // Listen for messages from the iframe
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'emulator_capabilities') {
                console.log("X86DOSBoxPlatform: Received emulator capabilities:", event.data.capabilities);
                
                if (event.data.capabilities && typeof event.data.capabilities.pauseResume === 'boolean') {
                    this.pauseResumeSupported = event.data.capabilities.pauseResume;
                    console.log("X86DOSBoxPlatform: Pause/resume supported:", this.pauseResumeSupported);
                    
                    // Update the UI to show/hide pause/resume buttons
                    this.updateControlButtons();
                }
            } else if (event.data && event.data.type === 'debug_objects') {
                console.log("X86DOSBoxPlatform: Received debug message from iframe:", event.data.message);
                console.log("Note: Debug objects are available in the iframe context, not the main window");
            }
        });
    }

    getName(): string {
        return 'x86 (DOSBox)';
    }

    getDescription(): string {
        return 'x86 DOSBox - Run C programs in a DOS environment with Turbo C';
    }

    async init(): Promise<void> {
        console.log("X86DOSBoxPlatform init() called");
        // No special initialization needed
    }

    async start(): Promise<void> {
        console.log("X86DOSBoxPlatform start() called - using iframe approach");
        
        // Set up compilation listener immediately
        this.setupCompilationListener();
        
        // Initially hide pause/resume buttons until we know if they're supported
        this.pauseResumeSupported = false;
        setTimeout(() => this.updateControlButtons(), 100);
        
        // Check if iframe already exists
        let iframe = document.getElementById("x86dosbox-iframe") as HTMLIFrameElement;
        
        if (!iframe) {
            // Create iframe for DOSBox emulator
            iframe = document.createElement('iframe');
            iframe.id = 'x86dosbox-iframe';
            iframe.style.width = '100%';
            iframe.style.height = '600px';
            iframe.style.border = '1px solid #ccc';
            iframe.style.backgroundColor = '#000';
            
            // Add iframe to the main element
            this.mainElement.innerHTML = '';
            this.mainElement.appendChild(iframe);
            console.log("X86DOSBoxPlatform: iframe created");
            
            // Load the iframe content
            iframe.src = 'x86dosbox-iframe.html';
        } else {
            console.log("X86DOSBoxPlatform: iframe already exists, reusing");
        }
        
        // Set up iframe with auto-compilation (async)
        this.setupIframeWithAutoCompilation().catch(error => {
            console.error("X86DOSBoxPlatform: Error in setupIframeWithAutoCompilation:", error);
        });
    }

    stop(): void {
        console.log("X86DOSBoxPlatform stop() called");
        // Instead of sending a message, reload the iframe directly
        const frame = document.getElementById("x86dosbox-iframe") as HTMLIFrameElement;
        if (frame) {
            frame.src = frame.src; // Reload the iframe
            console.log("X86DOSBoxPlatform: Reloaded iframe for stop/reset");
        }
    }

    reset(): void {
        console.log("X86DOSBoxPlatform reset() called");
        // Instead of sending a message, reload the iframe directly
        const frame = document.getElementById("x86dosbox-iframe") as HTMLIFrameElement;
        if (frame) {
            frame.src = frame.src; // Reload the iframe
            console.log("X86DOSBoxPlatform: Reloaded iframe for reset");
        }
    }

    pause(): void {
        if (!this.pauseResumeSupported) {
            console.log("X86DOSBoxPlatform: Pause not supported by emulator");
            return;
        }
        
        console.log("X86DOSBoxPlatform pause() called");
        // Send pause command to iframe emulator
        const frame = document.getElementById("x86dosbox-iframe") as HTMLIFrameElement;
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'pause' }, '*');
            console.log("X86DOSBoxPlatform: Sent pause command to iframe");
        }
    }

    resume(): void {
        if (!this.pauseResumeSupported) {
            console.log("X86DOSBoxPlatform: Resume not supported by emulator");
            return;
        }
        
        console.log("X86DOSBoxPlatform resume() called");
        // Send resume command to iframe emulator
        const frame = document.getElementById("x86dosbox-iframe") as HTMLIFrameElement;
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'resume' }, '*');
            console.log("X86DOSBoxPlatform: Sent resume command to iframe");
        }
    }

    isRunning(): boolean {
        // For iframe-based emulators, we assume they're always running
        return true;
    }

    getToolForFilename(filename: string): string {
        // For DOSBox, we don't use traditional build tools - compilation happens in the emulator
        const lowerFilename = filename.toLowerCase();
        if (lowerFilename.endsWith('.c')) return 'none';
        return 'none';
    }

    getDefaultExtension(): string {
        return '.c';
    }

    getPresets(): any[] {
        return [
            { id: 'hellodos.c', name: 'Hello World (C)' },
            { id: 'graphics.c', name: 'BGI Graphics Demo (C)' },
        ];
    }

    loadROM(title: string, rom: any): void {
        console.log("X86DOSBoxPlatform loadROM called with title:", title, "and", rom.length, "bytes");
        
        const frame = document.getElementById("x86dosbox-iframe") as HTMLIFrameElement;
        if (frame && frame.contentWindow) {
            // Check if this is a C program
            if (rom && rom.length > 0) {
                console.log("X86DOSBoxPlatform: C program detected, sending via postMessage");
                
                // Extract the actual filename from the title or get it from the current project
                let filename = 'program.c';
                if (title && title.endsWith('.c')) {
                    filename = title;
                } else {
                    // Try to get the current main filename
                    const currentFilename = (window as any).IDE?.getCurrentMainFilename?.();
                    if (currentFilename && currentFilename.endsWith('.c')) {
                        filename = currentFilename;
                    }
                }
                
                console.log("X86DOSBoxPlatform: Using filename:", filename);
                
                // Don't reload the iframe - just send the program data
                frame.contentWindow.postMessage({
                    type: 'compiled_program',
                    program: rom,
                    filename: filename,
                    autoLoad: true
                }, '*');
            } else {
                console.error("X86DOSBoxPlatform: No program data to load");
            }
        } else {
            console.error("X86DOSBoxPlatform: iframe not found or contentWindow not available");
        }
    }

    getMemoryMap() {
        return {
            main: [
                { name: "DOS Memory", start: 0, size: 1048576, type: "ram" }
            ]
        };
    }

    getROMExtension(rom: Uint8Array): string {
        return ".exe";
    }

    private updateControlButtons(): void {
        // Find the control buttons in the UI and show/hide them based on capability
        const pauseButton = document.getElementById('dbg_pause') as HTMLElement;
        const resumeButton = document.getElementById('dbg_go') as HTMLElement;
        
        if (pauseButton) {
            pauseButton.style.display = this.pauseResumeSupported ? 'inline-block' : 'none';
            console.log("X86DOSBoxPlatform: Pause button visibility:", this.pauseResumeSupported ? 'visible' : 'hidden');
        } else {
            console.log("X86DOSBoxPlatform: Pause button not found");
        }
        
        if (resumeButton) {
            resumeButton.style.display = this.pauseResumeSupported ? 'inline-block' : 'none';
            console.log("X86DOSBoxPlatform: Resume button visibility:", this.pauseResumeSupported ? 'visible' : 'hidden');
        } else {
            console.log("X86DOSBoxPlatform: Resume button not found");
        }
    }

    private async setupIframeWithAutoCompilation() {
        console.log("X86DOSBoxPlatform: Setting up iframe with auto-compilation");
        
        // Check if auto-compile is enabled
        const autoCompileEnabled = (window as any).autoCompileEnabled === true;
        console.log("X86DOSBoxPlatform: Auto-compile enabled:", autoCompileEnabled);
        
        // Check if we have a compiled program
        const output = (window as any).IDE?.getCurrentOutput();
        if (output && output instanceof Uint8Array) {
            console.log("X86DOSBoxPlatform: Found compiled program, loading iframe");
            this.loadROM("compiled_program", output);
        } else if (autoCompileEnabled) {
            console.log("X86DOSBoxPlatform: No compiled program found, triggering compilation");
            await this.triggerCompilationAndReload();
        } else {
            console.log("X86DOSBoxPlatform: Auto-compile disabled, not triggering initial compilation");
        }
    }

    private async triggerCompilationAndReload() {
        console.log("X86DOSBoxPlatform: Triggering compilation and reload");
        
        // Check for worker availability with retry
        const checkWorkerAndCompile = () => {
            const worker = (window as any).worker;
            if (worker && worker.postMessage) {
                console.log("X86DOSBoxPlatform: Triggering compilation via worker");
                
                // Get current project files
                const project = (window as any).IDE?.getCurrentProject();
                const files = project?.getFiles() || {};
                
                // Check if we have any files to compile
                const fileKeys = Object.keys(files);
                if (fileKeys.length === 0) {
                    console.log("X86DOSBoxPlatform: No files to compile, skipping worker message");
                    return;
                }
                
                // Create proper worker message format
                const mainFile = fileKeys[0];
                const message = {
                    updates: Object.entries(files).map(([path, data]) => ({
                        path: path,
                        data: typeof data === 'string' ? data : new TextDecoder().decode(data as Uint8Array)
                    })),
                    buildsteps: [{
                        path: mainFile,
                        files: [mainFile],
                        platform: 'x86dosbox',
                        tool: 'none',
                        mainfile: true
                    }]
                };
                worker.postMessage(message);
            } else {
                console.log("X86DOSBoxPlatform: Worker not yet available, retrying in 500ms");
                setTimeout(checkWorkerAndCompile, 500);
            }
        };
        
        checkWorkerAndCompile();
    }

    private setupCompilationListener() {
        console.log("X86DOSBoxPlatform: Setting up compilation listener");
        
        // Check if we've already set up the listener
        if ((window as any).x86dosboxCompilationListenerSetup) {
            console.log("X86DOSBoxPlatform: Compilation listener already set up, skipping");
            return;
        }
        
        // Mark that we've set up the listener
        (window as any).x86dosboxCompilationListenerSetup = true;
        
        // Hook into the global setCompileOutput function to detect successful compilations
        const originalSetCompileOutput = (window as any).setCompileOutput;
        (window as any).setCompileOutput = (output: any) => {
            // Call the original function
            if (originalSetCompileOutput) {
                originalSetCompileOutput(output);
            }
            
            // Check if auto-compile is enabled before processing output
            const autoCompileEnabled = (window as any).autoCompileEnabled === true;
            const isManualCompilation = (window as any).isManualCompilation === true;
            
            console.log("X86DOSBoxPlatform: Compilation output received - autoCompileEnabled:", autoCompileEnabled, "isManualCompilation:", isManualCompilation);
            console.log("X86DOSBoxPlatform: Raw autoCompileEnabled value:", (window as any).autoCompileEnabled);
            console.log("X86DOSBoxPlatform: Output type:", typeof output, "is Uint8Array:", output instanceof Uint8Array);
            
            if (output && output instanceof Uint8Array && (autoCompileEnabled || isManualCompilation)) {
                console.log("X86DOSBoxPlatform: Compilation completed, sending program to iframe");
                
                // Wait a bit for the compilation output to be processed, then use loadROM
                setTimeout(() => {
                    this.loadROM("compiled_program", output);
                }, 1000);
            } else if (output && output instanceof Uint8Array) {
                console.log("X86DOSBoxPlatform: Compilation completed but auto-compile is disabled, not loading program");
            }
        };
    }
}

// Register the platform
PLATFORMS['x86dosbox'] = X86DOSBoxPlatform;

export default X86DOSBoxPlatform;
