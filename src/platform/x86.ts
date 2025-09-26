
import { Platform  } from "../common/baseplatform";
import { PLATFORMS, RasterVideo } from "../common/emu";
import { loadScript } from "../common/util";

// PC emulator: https://github.com/copy/v86

declare var V86Starter : any;
declare var V86 : any;
declare var CPU : any;
declare var fatfs : any;

const PC_PRESETS = [
    {id:'hello.asm', name:'Hello World (ASM)'},
    {id:'mandelg.asm', name:'Mandelbrot (ASM)'},
    {id:'snake.c', name:'Snake Game (C)'},
];

class FATFSArrayBufferDriver {
    buffer : ArrayBuffer;
    data : DataView;
    sectorSize : number;
    numSectors : number;
    constructor(buffer : ArrayBuffer) {
        this.buffer = buffer;
        this.data = new DataView(this.buffer);
        this.sectorSize = 512;
        this.numSectors = this.buffer.byteLength / this.sectorSize;
    }
    readSectors(sector, dest, cb) {
        var ofs = this.sectorSize * sector;
        for (var i=0; i<dest.length; i++) {
            dest[i] = this.data.getUint8(i + ofs);
        }
        //console.log('read', sector, dest, cb);
        cb(null);
    }
    writeSectors(sector, data, cb) {
        var ofs = this.sectorSize * sector;
        for (var i=0; i<data.length; i++) {
            this.data.setUint8(i + ofs, data[i]);
        }
        //console.log('write', sector, data, cb);
        cb(null);
    }
}
  
class X86PCPlatform implements Platform {

    mainElement : HTMLElement;
    video : RasterVideo;
    console_div : HTMLElement;

    emulator;
    v86;
    fda_image;
    fda_driver;
    fda_fs;

    constructor(mainElement) {
        //super();
        this.mainElement = mainElement;
    }
    getToolForFilename(s: string): string {
        if (s.endsWith(".c")) return "smlrc";
        return "yasm";
    }
    getDefaultExtension(): string {
        return ".asm";
    }
    getPresets() {
        return PC_PRESETS;
    }
    pause(): void {
        if (this.isRunning()) this.emulator.stop();
    }
    resume(): void {
        if (!this.isRunning()) this.emulator.run();
    }
    reset() {
        this.emulator.restart();
    }
    isRunning() {
        return this.emulator.is_running();
    }
    loadROM(title: string, rom: any) {
        if (!this.fda_fs) {
            console.error("File system not available, cannot load ROM");
            return;
        }
        
        // Write to floppy (A:) for FreeDOS compilation
        this.fda_fs.writeFile('main.exe', rom, {encoding:'binary'}, (e) => {
            if (e) throw e;
            else this.reset();
        });
    }
    
    // New method to copy source code to hard drive and launch Turbo C
    async copySourceToHardDriveAndLaunch(sourceCode: string, filename: string) {
        if (!this.v86 || !this.v86.cpu.devices.ide || !this.v86.cpu.devices.ide.hda_image) {
            console.error("Hard drive not available");
            return;
        }
        
        try {
            // Create hard drive file system
            const hda_driver = new FATFSArrayBufferDriver(this.v86.cpu.devices.ide.hda_image.buffer);
            const hda_fs = fatfs.createFileSystem(hda_driver);
            
            // Write source code to hard drive
            const sourcePath = `C:\\${filename}`;
            console.log(`Writing source code to ${sourcePath}`);
            
            hda_fs.writeFile(sourcePath, sourceCode, {encoding:'utf8'}, (e) => {
                if (e) {
                    console.error("Error writing to hard drive:", e);
                    return;
                }
                
                console.log(`Source code written to ${sourcePath}`);
                
                // Launch Turbo C compiler
                const tccPath = "C:\\DEV\\TC\\TCC.EXE";
                const command = `${tccPath} ${filename}`;
                console.log(`Launching: ${command}`);
                
                // Send command to emulator
                this.v86.keyboard_send_text(command + "\r");
            });
            
        } catch (error) {
            console.error("Error setting up hard drive compilation:", error);
        }
    }
    async start() {
        await loadScript('./lib/libv86.js');
        await loadScript('./lib/fatfs.js');

        this.video = new RasterVideo(this.mainElement,640,480,{overscan:false});
        this.video.create();

        var div = document.createElement('div');
        div.classList.add('pc-console');
        div.classList.add('emuvideo');
        this.mainElement.appendChild(div);
        this.console_div = div;
        this.resize(); // set font size

        console.log("Creating V86Starter with MS-DOS 6.22 hard drive...");
        this.emulator = new V86Starter({
            memory_size: 2 * 1024 * 1024,
            vga_memory_size: 1 * 1024 * 1024,
            screen_container: this.mainElement,
            bios: {
                url: "./res/seabios.bin",
            },
            vga_bios: {
                url: "./res/vgabios.bin",
            },
            fda: {
                url: "./res/freedos722.img",
                size: 737280,
            },
            // Add hard drive as secondary device (MS-DOS 6.22)
            hda: {
                url: "./res/msdos622.img",  // Complete MS-DOS 6.22 disk image
                size: 64 * 1024 * 1024,    // 64MB hard drive
            },
            boot_order: 0x321,  // Boot from floppy first, then hard drive (BOOT_ORDER_FD_FIRST)
            autostart: true,
        });
        return new Promise<void>( (resolve, reject) => {
            this.emulator.add_listener("emulator-ready", () => {
                console.log("emulator ready");
                console.log(this.emulator);
                this.v86 = this.emulator.v86;
                
                // Use floppy disk file system (which we know works)
                this.fda_image = this.v86.cpu.devices.fdc.fda_image;
                this.fda_driver = new FATFSArrayBufferDriver(this.fda_image.buffer);
                this.fda_fs = fatfs.createFileSystem(this.fda_driver);
                
                // Also check for hard drive availability (for future use)
                const checkHDA = () => {
                    if (this.v86.cpu.devices.ide && this.v86.cpu.devices.ide.hda_image) {
                        console.log("Hard drive also available:", this.v86.cpu.devices.ide.hda_image);
                        
                        // Expose the Turbo C compilation method globally
                        (window as any).compileWithTurboC = (sourceCode: string, filename: string) => {
                            this.copySourceToHardDriveAndLaunch(sourceCode, filename);
                        };
                        console.log("Turbo C compilation method exposed as window.compileWithTurboC()");
                    }
                };
                setTimeout(checkHDA, 1000); // Check after 1 second
                
                resolve();
            });
        });
    }

    resize() {
        // set font size proportional to window width
        var charwidth = $(this.console_div).width() * 1.7 / 80;
        $(this.console_div).css('font-size', charwidth+'px');
    }

    getDebugTree() {
        return this.v86;
    }
    readAddress(addr:number) {
        return this.v86.cpu.mem8[addr];
    }
    getMemoryMap() { return { main:[
        {name:'Real Mode IVT',start:0x0,size:0x400,type:'ram'},
        {name:'BIOS Data Area',start:0x400,size:0x100,type:'ram'},
        {name:'User RAM',start:0x500,size:0x80000-0x500,type:'ram'},
        {name:'Extended BIOS Data Area',start:0x80000,size:0x20000,type:'ram'},
        {name:'Video RAM',start:0xa0000,size:0x20000,type:'ram'},
        {name:'Video BIOS',start:0xc0000,size:0x8000,type:'rom'},
        {name:'BIOS Expansions',start:0xc8000,size:0x28000,type:'rom'},
        {name:'PC BIOS',start:0xf0000,size:0x10000,type:'rom'},
    ] } };

    getROMExtension(rom : Uint8Array) {
        return ".exe";
    }
}

PLATFORMS['x86'] = X86PCPlatform;
