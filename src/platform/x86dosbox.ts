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

    constructor(mainElement: HTMLElement) {
        this.mainElement = mainElement;
    }

    async start() {
        // Load js-dos library
        await loadScript('https://js-dos.com/6.22/current/js-dos.js');

        this.video = new RasterVideo(this.mainElement, 640, 480, { overscan: false });
        this.video.create();

        var div = document.createElement('div');
        div.classList.add('pc-console');
        div.classList.add('emuvideo');
        this.mainElement.appendChild(div);
        this.console_div = div;
        this.resize(); // set font size

        console.log("Creating js-dos DOSBox instance...");
        
        return new Promise<void>((resolve, reject) => {
            try {
                // Create a canvas element for js-dos
                const canvas = document.createElement('canvas');
                canvas.id = 'jsdos';
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                this.console_div.appendChild(canvas);

                this.dosInstance = window.Dos(canvas, {
                    wdosboxUrl: "https://js-dos.com/6.22/current/wdosbox.js",
                });

                this.dosInstance.ready((fs: any, main: any) => {
                    console.log("js-dos ready, extracting Turbo C...");
                    
                    // Extract Turbo C from the zip file
                    fs.extract("tc.zip").then(() => {
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
            console.error("DOSBox not ready");
            return;
        }

        try {
            console.log(`Compiling ${filename} with Turbo C...`);
            
            // Write source code to a file in DOSBox
            await this.ci.writeFile(filename, sourceCode);
            console.log(`Source code written to ${filename}`);
            
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
        if (this.console_div) {
            this.console_div.style.fontSize = Math.max(8, Math.min(24, this.mainElement.clientWidth / 80)) + "px";
        }
    }

    reset() {
        if (this.ci) {
            this.ci.run("cls");
        }
    }

    pause() {
        // js-dos doesn't have a direct pause method, but we can stop execution
        if (this.ci) {
            this.ci.run("pause");
        }
    }

    resume() {
        // js-dos resumes automatically when commands are sent
    }

    loadROM(title: string, rom: any) {
        // For DOSBox, we don't load ROMs in the traditional sense
        // Instead, we compile and run the program
        console.log("loadROM called - this should trigger compilation instead", title);
    }

    isRunning(): boolean {
        return this.ci !== undefined;
    }

    getToolForFilename(filename: string): string {
        // For C files, use Turbo C compiler
        if (filename.endsWith('.c')) {
            return 'tcc';
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
