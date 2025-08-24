// Test script to use the actual WASM-based cc65 system for BBC compilation
// This will show us the real error output

const fs = require('fs');
const path = require('path');

// Mock the WASM environment
global.emglobal = {
    cc65: () => ({
        FS: {
            readFile: (path, options) => {
                console.log('FS.readFile called with:', path, options);
                return new Uint8Array([0x00, 0x00, 0x00]); // Mock data
            },
            writeFile: (path, data) => {
                console.log('FS.writeFile called with:', path, 'data length:', data.length);
            },
            mkdir: (path) => console.log('FS.mkdir called with:', path),
            mount: (type, options, path) => console.log('FS.mount called with:', type, path)
        },
        instantiateWasm: () => Promise.resolve({}),
        noInitialRun: true,
        print: (s) => console.log('cc65 stdout:', s),
        printErr: (s) => console.log('cc65 stderr:', s)
    }),
    ld65: () => ({
        FS: {
            readFile: (path, options) => {
                console.log('FS.readFile called with:', path, options);
                return new Uint8Array([0x00, 0x00, 0x00]); // Mock data
            },
            writeFile: (path, data) => {
                console.log('FS.writeFile called with:', path, 'data length:', data.length);
            },
            mkdir: (path) => console.log('FS.mkdir called with:', path),
            mount: (type, options, path) => console.log('FS.mount called with:', type, path)
        },
        instantiateWasm: () => Promise.resolve({}),
        noInitialRun: true,
        print: (s) => console.log('ld65 stdout:', s),
        printErr: (s) => console.log('ld65 stderr:', s)
    })
};

// Mock the store
global.store = {
    hasFile: (path) => {
        console.log('store.hasFile called with:', path);
        return true;
    },
    getFileEntry: (path) => {
        console.log('store.getFileEntry called with:', path);
        return { data: new Uint8Array([0x00, 0x00, 0x00]) };
    },
    getFileData: (path) => {
        console.log('store.getFileData called with:', path);
        return new Uint8Array([0x00, 0x00, 0x00]);
    }
};

// Mock the worker environment
global.self = {
    postMessage: (msg) => console.log('Worker postMessage:', msg)
};

// Mock the filesystem loading
global.loadFilesystem = (name) => {
    console.log('loadFilesystem called with:', name);
    return Promise.resolve();
};

global.loadWASM = (name) => {
    console.log('loadWASM called with:', name);
    return Promise.resolve();
};

// Mock the module loading
global.moduleInstFn = (name) => {
    console.log('moduleInstFn called with:', name);
    return () => Promise.resolve({});
};

// Mock the print function
global.print_fn = (s) => console.log('print_fn:', s);

// Mock the error matcher
global.makeErrorMatcher = (errors, regex, lineIndex, msgIndex, pathIndex, fileIndex) => {
    return (s) => {
        console.log('Error matcher called with:', s);
        const match = regex.exec(s);
        if (match) {
            errors.push({
                line: parseInt(match[lineIndex]),
                msg: match[msgIndex],
                path: match[pathIndex] || match[fileIndex]
            });
        }
    };
};

// Mock the filesystem setup
global.setupFS = (FS, name) => {
    console.log('setupFS called with:', name);
    // Mock the WORKERFS
    FS.filesystems = {
        WORKERFS: {
            mount: (options, path) => console.log('WORKERFS.mount called with:', path)
        }
    };
    FS.mkdir('/share');
    FS.mount(FS.filesystems.WORKERFS, {}, '/share');
};

// Mock the file population
global.populateFiles = (step, FS, options) => {
    console.log('populateFiles called with step:', step.path);
    // Mock file writing
    FS.writeFile('main.c', step.files[0]);
    FS.writeFile('bbc.cfg', fs.readFileSync('presets/bbc/bbc.cfg'));
    FS.writeFile('common.h', fs.readFileSync('presets/bbc/common.h'));
};

global.populateExtraFiles = (step, FS, files) => {
    console.log('populateExtraFiles called with:', files);
};

global.populateEntry = (FS, path, entry, data) => {
    console.log('populateEntry called with:', path);
    FS.writeFile(path, data || entry.data);
};

// Mock the execution
global.execMain = (step, module, args) => {
    console.log('execMain called with args:', args);
    // Simulate the actual cc65 execution
    if (args.includes('cc65')) {
        // Simulate cc65 compilation
        console.log('Simulating cc65 compilation...');
        module.FS.writeFile('main.s', new Uint8Array([0x00, 0x00, 0x00]));
    } else if (args.includes('ld65')) {
        // Simulate ld65 linking
        console.log('Simulating ld65 linking...');
        // This is where we'll see the real error
        module.printErr('Warning: bbc.cfg:32: Segment \'STARTUP\' does not exist');
        module.printErr('Error: 1 unresolved external(s) found - cannot create output file');
    }
};

// Mock the stale files check
global.staleFiles = (step, files) => {
    console.log('staleFiles called with:', files);
    return true; // Always consider files stale for testing
};

global.gatherFiles = (step, options) => {
    console.log('gatherFiles called with:', step.path);
    step.files = ['main.c'];
};

global.fixParamsWithDefines = (path, params) => {
    console.log('fixParamsWithDefines called with:', path);
};

global.putWorkFile = (path, data) => {
    console.log('putWorkFile called with:', path, 'data length:', data.length);
};

// Mock the getRootBasePlatform function
global.getRootBasePlatform = (platform) => {
    console.log('getRootBasePlatform called with:', platform);
    return 'none'; // This maps to 65-none filesystem
};

// Mock the processEmbedDirective function
global.processEmbedDirective = (code) => {
    return code;
};

// Now let's test the actual compilation process
async function testBBCCompilation() {
    console.log('=== Testing BBC Compilation with WASM System ===\n');
    
    // Create a mock build step
    const step = {
        path: 'main.c',
        prefix: 'main',
        platform: 'bbc',
        mainfile: true,
        files: ['main.c'],
        args: []
    };
    
    // Mock the parameters
    const params = {
        arch: '6502',
        define: ['__BBC__', '__BBC_MICRO__'],
        cfgfile: 'bbc.cfg',
        libargs: [],
        acmeargs: ['-f', 'bbc'],
        extra_compile_files: ['common.h', 'bbc.cfg']
    };
    
    step.params = params;
    
    console.log('Step:', step);
    console.log('Params:', params);
    console.log('\n--- Starting Compilation ---\n');
    
    try {
        // Test the cc65 compilation step
        console.log('1. Testing cc65 compilation...');
        const { compileCC65 } = require('./src/worker/tools/cc65.ts');
        const cc65Result = await compileCC65(step);
        console.log('cc65 result:', cc65Result);
        
        if (cc65Result.errors && cc65Result.errors.length > 0) {
            console.log('cc65 errors:', cc65Result.errors);
            return;
        }
        
        // Test the ld65 linking step
        console.log('\n2. Testing ld65 linking...');
        const { linkLD65 } = require('./src/worker/tools/cc65.ts');
        const ld65Result = await linkLD65(step);
        console.log('ld65 result:', ld65Result);
        
        if (ld65Result.errors && ld65Result.errors.length > 0) {
            console.log('ld65 errors:', ld65Result.errors);
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testBBCCompilation().catch(console.error);
