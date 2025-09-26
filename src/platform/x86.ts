
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
        // Disabled: SmallerC compiler is no longer used
        // if (s.endsWith(".c")) return "smlrc";
        if (s.endsWith(".c")) return "none"; // Disable SmallerC compilation
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
        // Disabled: Old SmallerC compiler output is no longer automatically executed
        // This prevents "Invalid Opcode" and "undefined symbol" errors
        console.log("loadROM called - old compiler output disabled");
        console.log("Title:", title, "ROM size:", rom ? rom.length : 0);
        console.log("Use window.compileWithTurboC() for native DOS compilation instead");
        
        // We no longer write to fda_fs or reset the emulator here
        // The source code is now handled by copySourceToHardDriveAndLaunch for Turbo C
    }
    
    // New method to create drive B: with source code and trigger auto-compilation
    async copySourceToDriveBAndCompile(sourceCode: string, filename: string) {
        if (!this.v86 || !this.fda_fs) {
            console.error("File system not available");
            return;
        }
        
        try {
            console.log(`Creating drive B: with ${filename} and triggering auto-compilation`);
            
            // Create a properly formatted FAT12 disk image
            const diskSize = 737280; // Same size as FreeDOS floppy
            const diskImage = new Uint8Array(diskSize);
            diskImage.fill(0);
            
            // Create a minimal FAT12 boot sector and filesystem
            // Boot sector (first 512 bytes)
            const bootSector = new Uint8Array(512);
            bootSector.fill(0);
            
            // Boot sector signature
            bootSector[0] = 0xEB; // JMP instruction
            bootSector[1] = 0x3C; // Jump offset
            bootSector[2] = 0x90; // NOP
            
            // OEM name
            const oemName = "MSDOS5.0";
            for (let i = 0; i < oemName.length; i++) {
                bootSector[3 + i] = oemName.charCodeAt(i);
            }
            
            // Bytes per sector (512)
            bootSector[11] = 0x00;
            bootSector[12] = 0x02;
            
            // Sectors per cluster (1)
            bootSector[13] = 0x01;
            
            // Reserved sectors (1)
            bootSector[14] = 0x01;
            bootSector[15] = 0x00;
            
            // Number of FATs (2)
            bootSector[16] = 0x02;
            
            // Root directory entries (224)
            bootSector[17] = 0xE0;
            bootSector[18] = 0x00;
            
            // Total sectors (1440 for 720KB)
            bootSector[19] = 0x80;
            bootSector[20] = 0x05;
            
            // Media descriptor (0xF0 for 1.44MB)
            bootSector[21] = 0xF0;
            
            // Sectors per FAT (9)
            bootSector[22] = 0x09;
            bootSector[23] = 0x00;
            
            // Boot signature (0xAA55)
            bootSector[510] = 0x55;
            bootSector[511] = 0xAA;
            
            // Copy boot sector to disk image
            for (let i = 0; i < 512; i++) {
                diskImage[i] = bootSector[i];
            }
            
            // Create FAT tables (simplified - just mark clusters as free)
            const fatStart = 512;
            const fatSize = 9 * 512; // 9 sectors per FAT
            
            // First FAT
            for (let i = 0; i < fatSize; i++) {
                diskImage[fatStart + i] = 0x00;
            }
            // Mark first cluster as end of file
            diskImage[fatStart] = 0xF8;
            diskImage[fatStart + 1] = 0xFF;
            
            // Second FAT (copy of first)
            for (let i = 0; i < fatSize; i++) {
                diskImage[fatStart + fatSize + i] = diskImage[fatStart + i];
            }
            
            // Root directory (starts after both FATs)
            const rootDirStart = fatStart + (2 * fatSize);
            
            // Create a simple file entry for our source file
            const fileName = filename.toUpperCase().padEnd(8, ' ');
            const fileExt = filename.includes('.') ? filename.split('.').pop().toUpperCase().padEnd(3, ' ') : '   ';
            
            // File entry (32 bytes)
            for (let i = 0; i < 8; i++) {
                diskImage[rootDirStart + i] = fileName.charCodeAt(i);
            }
            for (let i = 0; i < 3; i++) {
                diskImage[rootDirStart + 8 + i] = fileExt.charCodeAt(i);
            }
            
            // File attributes (0x20 = archive)
            diskImage[rootDirStart + 11] = 0x20;
            
            // File size
            const fileSize = sourceCode.length;
            diskImage[rootDirStart + 28] = fileSize & 0xFF;
            diskImage[rootDirStart + 29] = (fileSize >> 8) & 0xFF;
            diskImage[rootDirStart + 30] = (fileSize >> 16) & 0xFF;
            diskImage[rootDirStart + 31] = (fileSize >> 24) & 0xFF;
            
            // Write source code to data area (after root directory)
            const dataStart = rootDirStart + (224 * 32); // 224 root directory entries
            const sourceBytes = new TextEncoder().encode(sourceCode);
            for (let i = 0; i < sourceBytes.length && i < diskSize - dataStart; i++) {
                diskImage[dataStart + i] = sourceBytes[i];
            }
            
            console.log(`Source code written to B:\\${filename} (${fileSize} bytes)`);
            
            // Insert the new disk into drive B: using the correct method
            console.log("Inserting disk into drive B:");
            console.log("Available v86 methods:", Object.getOwnPropertyNames(this.v86));
            console.log("Available emulator methods:", Object.getOwnPropertyNames(this.emulator));
            
            // Try different methods to insert the disk
            if (this.emulator.insert_fdb) {
                console.log("Using emulator.insert_fdb()");
                this.emulator.insert_fdb(diskImage);
            } else if (this.v86.cpu.devices.fdc.insert_fdb) {
                console.log("Using v86.cpu.devices.fdc.insert_fdb()");
                this.v86.cpu.devices.fdc.insert_fdb(diskImage);
            } else {
                console.log("Using direct assignment to fdb_image");
                this.v86.cpu.devices.fdc.fdb_image = diskImage;
            }
            
            // Reset the emulator to trigger autoexec.bat
            console.log("Resetting emulator to trigger auto-compilation");
            this.reset();
            
        } catch (error) {
            console.error("Error setting up drive B compilation:", error);
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
            fdb: {
                // Drive B: will be created dynamically with source code
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
                
                console.log("Setting up hard drive detection...");
                
                // Also check for hard drive availability (for future use)
                const checkHDA = () => {
                    console.log("Checking for hard drive...");
                    console.log("Full v86 structure:", this.v86);
                    console.log("CPU devices:", this.v86.cpu.devices);
                    console.log("All device keys:", Object.keys(this.v86.cpu.devices));
                    console.log("IDE devices:", this.v86.cpu.devices.ide);
                    
                    // Check if there's an ide device with a different name
                    const deviceKeys = Object.keys(this.v86.cpu.devices);
                    console.log("Looking for IDE-related devices...");
                    deviceKeys.forEach(key => {
                        if (key.toLowerCase().includes('ide') || key.toLowerCase().includes('hda') || key.toLowerCase().includes('disk')) {
                            console.log(`Found potential IDE device: ${key}`, this.v86.cpu.devices[key]);
                        }
                    });
                    
                    // Try different paths to find the hard drive
                    let hda_image = null;
                    if (this.v86.cpu.devices.ide && this.v86.cpu.devices.ide.hda_image) {
                        hda_image = this.v86.cpu.devices.ide.hda_image;
                    } else if (this.v86.cpu.devices.hda && this.v86.cpu.devices.hda.image) {
                        hda_image = this.v86.cpu.devices.hda.image;
                    } else if (this.v86.hda_image) {
                        hda_image = this.v86.hda_image;
                    } else if (this.emulator.disk_images && this.emulator.disk_images.hda) {
                        hda_image = this.emulator.disk_images.hda;
                        console.log("Found hard drive in emulator.disk_images.hda:", hda_image);
                    }
                    
                    if (hda_image) {
                        console.log("Hard drive found via alternative path:", hda_image);
                        
                        // Expose the Turbo C compilation method globally
                        (window as any).compileWithTurboC = (sourceCode: string, filename: string) => {
                            this.copySourceToDriveBAndCompile(sourceCode, filename);
                        };
                        console.log("Turbo C compilation method exposed as window.compileWithTurboC()");
                    } else {
                        console.log("Hard drive not yet available, retrying...");
                        // Retry after another second
                        setTimeout(checkHDA, 1000);
                    }
                };
                
                console.log("Starting hard drive detection timer...");
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
