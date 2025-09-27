import { Platform } from "../common/baseplatform";
import { RasterVideo, PLATFORMS } from "../common/emu";
import { loadScript } from "../common/util";

declare global {
    interface Window {
        Dos: any;
        disk: any;
       
    }
}

class X86DOSBoxPlatform implements Platform {
    mainElement: HTMLElement;
    video: RasterVideo;
    console_div: HTMLElement;
    dosInstance: any;
    ci: any; // Command interface
    fs: any; // File system
    main: any; // Main function for running commands

    constructor(mainElement: HTMLElement) {
        this.mainElement = mainElement;
    }

    async start() {
        // Load js-dos library
        await loadScript('https://js-dos.com/6.22/current/js-dos.js');

        // Clear the main element and create the DOSBox canvas directly
        this.mainElement.innerHTML = '';
        
        // Create a canvas element for js-dos that fills the main element
        const canvas = document.createElement('canvas');
        canvas.id = 'jsdos';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        canvas.style.border = 'none';
        canvas.style.outline = 'none';
        
        // Prevent canvas from capturing focus automatically
        canvas.tabIndex = -1;
        canvas.style.pointerEvents = 'auto';
        
        // Track whether DOSBox should accept keyboard input
        let dosBoxHasFocus = false;
        
        // Store reference to this for use in event listeners
        const self = this;
        
        // Add a global keyboard event listener to prevent DOSBox from capturing keys when it shouldn't
        document.addEventListener('keydown', (e) => {
            // Check if the editor is focused (CodeMirror editor)
            const editor = document.querySelector('.CodeMirror-focused') || 
                          document.querySelector('.CodeMirror') ||
                          document.activeElement?.closest('.CodeMirror');
            
            if (!dosBoxHasFocus && editor) {
                // If editor is focused and DOSBox doesn't have focus, block the event
                e.stopPropagation();
                e.preventDefault();
                console.log("Blocked keyboard event from reaching DOSBox - editor has focus");
                return;
            }
            
            if (!dosBoxHasFocus) {
                // If DOSBox doesn't have focus, stop the event from reaching it
                e.stopPropagation();
                e.preventDefault();
                console.log("Blocked keyboard event from reaching DOSBox");
            }
        }, true); // Use capture phase to intercept before js-dos
        
        // Add click handler to focus canvas only when clicked
        canvas.addEventListener('click', () => {
            canvas.focus();
            dosBoxHasFocus = true;
            console.log("DOSBox now has focus - keyboard input enabled");
        });
        
        // Prevent canvas from stealing focus on page load
        canvas.addEventListener('focus', (e) => {
            // Only allow focus if canvas was explicitly clicked
            if (!canvas.dataset.clicked) {
                e.preventDefault();
                canvas.blur();
                dosBoxHasFocus = false;
            }
        });
        
        canvas.addEventListener('mousedown', () => {
            canvas.dataset.clicked = 'true';
            setTimeout(() => {
                delete canvas.dataset.clicked;
            }, 100);
        });
        
        // Add focus event listener to the canvas to manage focus state
        canvas.addEventListener('blur', () => {
            // When canvas loses focus, disable DOSBox keyboard input
            if (dosBoxHasFocus) {
                dosBoxHasFocus = false;
                console.log("DOSBox lost focus - keyboard input DISABLED");
            }
        });
        
        // Store the focus state for later use
        (canvas as any).dosBoxHasFocus = () => dosBoxHasFocus;
        (canvas as any).setDosBoxFocus = (focus: boolean) => {
            dosBoxHasFocus = focus;
            if (focus) {
                canvas.focus();
                console.log("DOSBox keyboard input ENABLED");
            } else {
                canvas.blur();
                console.log("DOSBox keyboard input DISABLED");
            }
        };
        
        // Add a global function to toggle DOSBox focus
        (window as any).toggleDosBoxFocus = () => {
            const canvas = document.getElementById('jsdos') as HTMLCanvasElement;
            if (canvas && (canvas as any).setDosBoxFocus) {
                const currentFocus = (canvas as any).dosBoxHasFocus();
                (canvas as any).setDosBoxFocus(!currentFocus);
            }
        };
        
        // Add click listener to document to disable DOSBox focus when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (!canvas.contains(e.target as Node) && dosBoxHasFocus) {
                dosBoxHasFocus = false;
                canvas.blur();
                console.log("Clicked outside DOSBox - keyboard input DISABLED");
            }
        });
        
        this.mainElement.appendChild(canvas);

        console.log("Creating js-dos DOSBox instance...");


        
        
        return new Promise<void>((resolve, reject) => {
            try {

                this.dosInstance = window.Dos(canvas, {
                    wdosboxUrl: "https://js-dos.com/6.22/current/wdosbox.js",
                });

                this.dosInstance.ready((fs: any, main: any) => {
                    console.log("js-dos ready, extracting Turbo C...");
                    
                    // Store the file system object
                    this.fs = fs;
                    
                    // Extract Turbo C from the zip file
                    fs.extract("res/tc.zip").then(() => {
                        console.log("Turbo C extracted, starting DOS...");
                        
                        // Start DOS and get command interface
                        main(["-c", "cd\\"]).then((ci: any) => {
                            this.ci = ci;
                            this.main = main; // Store the main function for running commands
                            console.log("DOSBox ready with Turbo C available");
                            
                            // Expose the compilation method globally
                            (window as any).compileWithTurboC = (sourceCode: string, filename: string) => {
                                this.compileWithTurboC(sourceCode, filename);
                            };
                            
                            resolve();
                        }).catch((error: any) => {
                            console.error("Error starting DOS:", error);
                            reject(error);
                        });
                    }).catch((error: any) => {
                        console.error("Error extracting Turbo C:", error);
                        reject(error);
                    });
                });
            } catch (error) {
                console.error("Error creating js-dos instance:", error);
                reject(error);
            }
        });
    }

    

    async compileWithTurboC( sourceCode: string, filename: string) {
        
        // Convert line endings to DOS format (CRLF)
        const dosSourceCode = sourceCode.replace(/\n/g, '\r\n');
        
        try {
            // Add a small delay to ensure file system is ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Try to delete the file first if it exists
            const filePath = `\\TC\\${filename}`;
            console.log(`Creating/overwriting file: ${filePath}`);
            await this.ci.shell('DEL ' + filePath);

            // Now create the file
            await this.fs.createFile(filePath, dosSourceCode);
            console.log(`✅ File created successfully: ${filePath}`);
            
            await this.ci.shell('z:rescan');
            await this.ci.shell('cd c:\\tc');
            await this.ci.shell('tcc -IC:\\TC\\INCLUDE -LC:\\TC\\LIB '+ ' c:\\tc\\' + filename);
            await this.ci.shell('c:\\tc\\' + filename.replace('.c', ''));
            
            // Focus the canvas after compilation so user can interact with the running program
            const canvas = document.getElementById('jsdos') as HTMLCanvasElement;
            if (canvas && (canvas as any).setDosBoxFocus) {
                (canvas as any).setDosBoxFocus(true);
                console.log("DOSBox focused after compilation - ready for user interaction");
            }
        } catch (error) {
            console.error("Error during compilation:", error);
        }
        
    }

    resize() {
        // DOSBox canvas automatically resizes to fill the container
        // No manual resizing needed
    }

    reset() {
        if (this.ci) {
            this.ci.run("cls");
        }
    }

    pause() {
        // js-dos doesn't have a direct pause method
        // We can pause by stopping the main loop or using the API
        if (this.dosInstance && this.dosInstance.api) {
            try {
                this.dosInstance.api.pauseMainLoop();
            } catch (error) {
                console.log("Pause not available in this js-dos version");
            }
        }
    }

    resume() {
        // js-dos resumes automatically when commands are sent
        if (this.dosInstance && this.dosInstance.api) {
            try {
                this.dosInstance.api.resumeMainLoop();
            } catch (error) {
                console.log("Resume not available in this js-dos version");
            }
        }
    }

    loadROM(title: string, rom: any) {
        // For DOSBox, we don't load ROMs in the traditional sense
        // Instead, we compile and run the program
        console.log("loadROM called - triggering compilation in DOSBox", title);
        console.log("ROM data type:", typeof rom, "ROM length:", rom ? rom.length : "null");
        console.log("CI available:", !!this.ci, "FS available:", !!this.fs);
        
        // Check if auto-compile is enabled
        const autoCompileEnabled = (window as any).autoCompileEnabled;
        console.log("Auto-compile enabled:", autoCompileEnabled);
        
        // Check if this is a manual compilation (triggered by play button)
        const isManualCompilation = (window as any).isManualCompilation || false;
        console.log("Manual compilation:", isManualCompilation);
        
        // Compile if auto-compile is enabled OR if this is a manual compilation
        if (this.ci && rom && rom.length > 0 && (autoCompileEnabled || isManualCompilation)) {
            // Get the source code from the current project
            const sourceCode = new TextDecoder().decode(rom);
            
            // Extract filename from title - handle both "snake.c" and "Snake Game (C)" formats
            let filename = title.split('/').pop() || title;
            
            // If title doesn't end with .c, try to get the actual filename from the current project
            if (!filename.endsWith('.c')) {
                // Try to get the current main filename from the global IDE state
                const currentMainFile = (window as any).IDE?.getCurrentMainFilename?.();
                if (currentMainFile && currentMainFile.endsWith('.c')) {
                    filename = currentMainFile.split('/').pop() || currentMainFile;
                } else {
                    // Fallback: use a default name
                    filename = 'main.c';
                }
            }
            
            console.log("Source code length:", sourceCode.length);
            console.log("Filename:", filename);
            console.log("First 100 chars of source:", sourceCode.substring(0, 100));
            
            // Compile and run the C program
            this.compileWithTurboC(sourceCode, filename);
        } else {
            console.log("loadROM conditions not met - ci:", !!this.ci, "rom length:", rom ? rom.length : "null", "auto-compile:", autoCompileEnabled, "manual:", isManualCompilation);
        }
    }

    isRunning(): boolean {
        return this.ci !== undefined;
    }

    getToolForFilename(filename: string): string {
        // For C files, we don't use the traditional build system
        // Instead, we compile directly in DOSBox using Turbo C
        if (filename.endsWith('.c')) {
            return 'none'; // Don't use build system, compile in DOSBox instead
        }
        return 'none';
    }

    getDefaultExtension(): string {
        return '.c';
    }
}

const X86DOSBOX_PRESETS = [
    {id:'hellodos.c', name:'Hello World (C)'},
    {id:'snake.c', name:'Snake Game (C)'},
   
];

// Register the platform
console.log("Registering x86dosbox platform...");
PLATFORMS['x86dosbox'] = class extends X86DOSBoxPlatform {
    getPresets() { return X86DOSBOX_PRESETS; }
    getDefaultExtension() { return '.c'; }
    getMemoryMap() { return { main: [
        {name:'DOS Memory',start:0x0,size:0x100000,type:'ram'},
    ] } };
    getROMExtension(rom : Uint8Array) {
        return ".exe";
    }
};
console.log("x86dosbox platform registered:", PLATFORMS['x86dosbox']);

export { X86DOSBoxPlatform };
