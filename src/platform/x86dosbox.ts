import { Platform } from "../common/baseplatform";
import { RasterVideo, PLATFORMS } from "../common/emu";
import { loadScript } from "../common/util";

declare global {
    interface Window {
        Dos: any;
    }
}

class X86DOSBoxPlatform implements Platform {
    mainElement: HTMLElement;
    video: RasterVideo;
    console_div: HTMLElement;
    dosInstance: any;
    ci: any; // Command interface
    fs: any; // File system

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

    async compileWithTurboC(sourceCode: string, filename: string) {
        if (!this.ci) {
            console.error("DOSBox not ready - CI not available");
            return;
        }

        try {
            console.log(`Compiling ${filename} with Turbo C...`);
            console.log(`Source code length: ${sourceCode.length}`);
            console.log(`FS object available: ${!!this.fs}`);
            console.log(`FS methods:`, this.fs ? Object.getOwnPropertyNames(this.fs) : "N/A");
            
            // Write source code to a file in DOSBox using the file system API
            // According to js-dos docs, we need to use the fs object from the ready callback
            if (this.fs) {
                console.log(`Attempting to create file: ${filename}`);
                try {
                    await this.fs.createFile(filename, sourceCode);
                    console.log(`✅ Source code written to ${filename}`);
                    
                    // Verify the file was created by trying to read it back
                    try {
                        const fileContent = await this.fs.readFile(filename);
                        console.log(`✅ File verification: ${fileContent.length} bytes read back`);
                    } catch (readError) {
                        console.error("❌ Could not read back the file:", readError);
                    }
                } catch (createError) {
                    console.error("❌ Error creating file:", createError);
                    return;
                }
            } else {
                console.error("❌ File system not available");
                return;
            }
            
            // Compile with Turbo C
            const compileCommand = `tc\\tcc.exe ${filename}`;
            console.log(`Running: ${compileCommand}`);
            
            await this.ci.run(compileCommand);
            console.log("Compilation completed");
            
            // Try to run the executable
            const executableName = filename.replace('.c', '.exe');
            console.log(`Running: ${executableName}`);
            
            await this.ci.run(executableName);
            console.log("Program executed");
            
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
        // The emulator can be paused by stopping the main loop
        if (this.dosInstance) {
            this.dosInstance.pause();
        }
    }

    resume() {
        // js-dos resumes automatically when commands are sent
        if (this.dosInstance) {
            this.dosInstance.resume();
        }
    }

    loadROM(title: string, rom: any) {
        // For DOSBox, we don't load ROMs in the traditional sense
        // Instead, we compile and run the program
        console.log("loadROM called - triggering compilation in DOSBox", title);
        console.log("ROM data type:", typeof rom, "ROM length:", rom ? rom.length : "null");
        console.log("CI available:", !!this.ci, "FS available:", !!this.fs);
        
        if (this.ci && title.endsWith('.c')) {
            // Get the source code from the current project
            const sourceCode = new TextDecoder().decode(rom);
            const filename = title.split('/').pop() || title;
            
            console.log("Source code length:", sourceCode.length);
            console.log("Filename:", filename);
            console.log("First 100 chars of source:", sourceCode.substring(0, 100));
            
            // Compile and run the C program
            this.compileWithTurboC(sourceCode, filename);
        } else {
            console.log("loadROM conditions not met - ci:", !!this.ci, "endsWith .c:", title.endsWith('.c'));
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
    {id:'hello.c', name:'Hello World (C)'},
    {id:'snake.c', name:'Snake Game (C)'},
    {id:'mandelbrot.c', name:'Mandelbrot (C)'},
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
