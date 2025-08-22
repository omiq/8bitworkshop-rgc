# C64 BASIC Tokenizer Documentation

## Overview

The C64 BASIC Tokenizer is a JavaScript implementation that converts C64 BASIC source code into Commodore 64 `.prg` files. It handles tokenization, label resolution, and generates the proper binary format that the C64 emulator can execute.

## Features

- ✅ **C64 BASIC V2 Tokenization**: Converts BASIC keywords to single-byte tokens
- ✅ **Case-Insensitive Commands**: Accepts both uppercase and lowercase BASIC commands (e.g., `print`, `PRINT`, `Print`)
- ✅ **Label Resolution**: Supports symbolic labels (e.g., `START:`, `MENU:`) with automatic line numbering
- ✅ **Reserved Keyword Handling**: Properly handles reserved keywords when used as labels (e.g., `GOTO END`)
- ✅ **Control Codes**: Supports PETSCII control codes like `{CLR}`, `{HOME}`, color codes
- ✅ **Auto-numbering**: Automatically assigns line numbers when not specified
- ✅ **PRG File Generation**: Outputs valid C64 executable `.prg` files

## Architecture

### Core Components

1. **C64BasicTokenizer** - Main tokenizer class
2. **Token Definitions** - C64 BASIC keyword mappings
3. **Label Resolution System** - Two-pass compilation for label handling
4. **PRG File Generator** - Binary output formatter

### File Structure

```
src/common/basic/
├── c64tokenizer.ts      # Main tokenizer implementation
├── compiler.ts          # Token definitions and dialect options
└── workertools.ts       # Build system integration
```

## Usage

### Basic Example

```javascript
import { C64BasicTokenizer } from './src/common/basic/c64tokenizer.js';

// Create tokenizer instance
const tokenizer = new C64BasicTokenizer();

// BASIC source code
const sourceCode = `
10 PRINT "HELLO WORLD"
20 GOSUB START
30 END

START:
40 PRINT "FROM SUBROUTINE"
50 RETURN
`;

// Compile to PRG file
const prgData = tokenizer.compile(sourceCode);

// Save to file
fs.writeFileSync('output.prg', prgData);
```

### Advanced Example with Labels and Case-Insensitive Commands

```javascript
const sourceCode = `
10 rem game menu
20 print "{CLR}"
30 print "1. play game"
40 print "2. high scores"
50 print "3. exit"
60 input "choose (1-3)"; choice
70 if choice=1 then gosub play
80 if choice=2 then gosub scores
90 if choice=3 then goto end
100 goto menu

play:
110 print "playing game..."
120 return

scores:
130 print "high scores:"
140 print "1000 points"
150 return

end:
160 print "goodbye!"
170 end
`;

const prgData = tokenizer.compile(sourceCode);
```

## API Reference

### C64BasicTokenizer Class

#### Constructor
```javascript
const tokenizer = new C64BasicTokenizer();
```

#### Methods

##### `compile(source: string): Uint8Array`
Compiles BASIC source code to a C64 PRG file.

**Parameters:**
- `source` (string): BASIC source code

**Returns:**
- `Uint8Array`: Binary PRG file data

**Example:**
```javascript
const prgData = tokenizer.compile(sourceCode);
console.log('PRG size:', prgData.length, 'bytes');
```

## Token System

### Case-Insensitive Token Matching

The tokenizer automatically converts all BASIC commands to uppercase during tokenization. This means you can write commands in any case:

```basic
10 print "hello"     # Works
20 PRINT "world"     # Works  
30 Print "test"      # Works
40 pRiNt "mixed"     # Works
```

### C64 BASIC Tokens

The tokenizer uses the official C64 BASIC V2 token set:

```javascript
const C64_TOKENS = {
    "END": 0x80,      "FOR": 0x81,      "NEXT": 0x82,
    "DATA": 0x83,     "INPUT#": 0x84,   "INPUT": 0x85,
    "DIM": 0x86,      "READ": 0x87,     "LET": 0x88,
    "GOTO": 0x89,     "RUN": 0x8A,      "IF": 0x8B,
    "RESTORE": 0x8C,  "GOSUB": 0x8D,    "RETURN": 0x8E,
    "REM": 0x8F,      "STOP": 0x90,     "ON": 0x91,
    "WAIT": 0x92,     "LOAD": 0x93,     "SAVE": 0x94,
    "VERIFY": 0x95,   "DEF": 0x96,      "POKE": 0x97,
    "PRINT#": 0x98,   "PRINT": 0x99,    "CONT": 0x9A,
    "LIST": 0x9B,     "CLR": 0x9C,      "CMD": 0x9D,
    "SYS": 0x9E,      "OPEN": 0x9F,     "CLOSE": 0xA0,
    "GET": 0xA1,      "NEW": 0xA2,      "TAB(": 0xA3,
    "TO": 0xA4,       "FN": 0xA5,       "SPC(": 0xA6,
    "THEN": 0xA7,     "NOT": 0xA8,      "STEP": 0xA9,
    "+": 0xAA,        "-": 0xAB,        "*": 0xAC,
    "/": 0xAD,        "^": 0xAE,        "AND": 0xAF,
    "OR": 0xB0,       ">": 0xB1,        "=": 0xB2,
    "<": 0xB3,        "SGN": 0xB4,      "INT": 0xB5,
    "ABS": 0xB6,      "USR": 0xB7,      "FRE": 0xB8,
    "POS": 0xB9,      "SQR": 0xBA,      "RND": 0xBB,
    "LOG": 0xBC,      "EXP": 0xBD,      "COS": 0xBE,
    "SIN": 0xBF,      "TAN": 0xC0,      "ATN": 0xC1,
    "PEEK": 0xC2,     "LEN": 0xC3,      "STR$": 0xC4,
    "VAL": 0xC5,      "ASC": 0xC6,      "CHR$": 0xC7,
    "LEFT$": 0xC8,    "RIGHT$": 0xC9,   "MID$": 0xCA,
    "GO": 0xCB,       "PI": 0xFF
};
```

## Label System

### Label Types

#### 1. Standalone Labels
```basic
START:
PRINT "HELLO"
RETURN
```

#### 2. Inline Labels
```basic
10 START: PRINT "HELLO"
20 GOTO START
```

### Label Resolution Process

The tokenizer uses a **two-pass compilation** system:

1. **First Pass**: Collect all labels and determine line numbers
2. **Second Pass**: Resolve labels to line numbers during tokenization

```javascript
// First pass: collect labels
const labels = {};
const pendingLabels = [];

// Process each line
for (const line of sourceLines) {
    if (line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*$/)) {
        // Standalone label
        const label = RegExp.$1.toLowerCase();
        pendingLabels.push({ label, nextLineNumber: currentLineNumber + 10 });
    }
}

// Second pass: resolve labels
for (const pending of pendingLabels) {
    labels[pending.label] = pending.nextLineNumber;
}
```

## PRG File Format

The generated PRG file follows the C64 BASIC format:

```
[Load Address: 2 bytes]     # 0x0801 for BASIC programs
[Line 1 Address: 2 bytes]   # Next line address
[Line 1 Number: 2 bytes]    # BASIC line number
[Line 1 Tokens: N bytes]    # Tokenized BASIC code
[Line 1 Terminator: 1 byte] # 0x00
[Line 2 Address: 2 bytes]   # Next line address
[Line 2 Number: 2 bytes]    # BASIC line number
[Line 2 Tokens: N bytes]    # Tokenized BASIC code
[Line 2 Terminator: 1 byte] # 0x00
...
[Program End: 2 bytes]      # 0x0000
```

### Example PRG Structure

```javascript
// Load address (0x0801)
prg.push(0x01, 0x08);

// Line 10: PRINT "HELLO"
prg.push(0x0B, 0x08);  // Next line address
prg.push(0x0A, 0x00);  // Line number 10
prg.push(0x99, 0x22, 0x48, 0x45, 0x4C, 0x4C, 0x4F, 0x22); // PRINT "HELLO"
prg.push(0x00);        // Line terminator

// Program end
prg.push(0x00, 0x00);
```

## Control Codes

The tokenizer supports PETSCII control codes:

```basic
PRINT "{CLR}"    # Clear screen
PRINT "{HOME}"   # Move cursor to home position
PRINT "{DEL}"    # Delete character
PRINT "{RED}"    # Red text color
PRINT "{GREEN}"  # Green text color
PRINT "{BLUE}"   # Blue text color
```

### Control Code Mappings

```javascript
const controlMap = {
    'CLR': 0x93,   // Clear screen
    'HOME': 0x13,  // Home cursor
    'DEL': 0x14,   // Delete character
    'RED': 0x1C,   // Red color
    'GREEN': 0x1E, // Green color
    'BLUE': 0x1F,  // Blue color
    'PURPLE': 0x9C, // Purple color
    'YELLOW': 0x9E, // Yellow color
    'CYAN': 0x9F,   // Cyan color
    'WHITE': 0x05,  // White color
    'BLACK': 0x90,  // Black color
    'REVERSE': 0x12, // Reverse video
    'NORMAL': 0x92   // Normal video
};
```

## Integration Examples

### Node.js Integration

```javascript
const fs = require('fs');
const { C64BasicTokenizer } = require('./c64tokenizer.js');

class C64BasicCompiler {
    constructor() {
        this.tokenizer = new C64BasicTokenizer();
    }

    compileFile(inputFile, outputFile) {
        const sourceCode = fs.readFileSync(inputFile, 'utf8');
        const prgData = this.tokenizer.compile(sourceCode);
        fs.writeFileSync(outputFile, prgData);
        console.log(`Compiled ${inputFile} to ${outputFile}`);
    }

    compileString(sourceCode) {
        return this.tokenizer.compile(sourceCode);
    }
}

// Usage
const compiler = new C64BasicCompiler();
compiler.compileFile('game.bas', 'game.prg');
```

### Web Integration

```javascript
// Browser-based compilation
class WebC64Compiler {
    constructor() {
        this.tokenizer = new C64BasicTokenizer();
    }

    compileAndDownload(sourceCode, filename = 'program.prg') {
        const prgData = this.tokenizer.compile(sourceCode);
        
        // Create download link
        const blob = new Blob([prgData], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    compileForEmulator(sourceCode) {
        const prgData = this.tokenizer.compile(sourceCode);
        return btoa(String.fromCharCode(...prgData)); // Base64 encode
    }
}

// Usage in web app
const webCompiler = new WebC64Compiler();

// Download PRG file
webCompiler.compileAndDownload(sourceCode, 'mygame.prg');

// For emulator integration
const base64Data = webCompiler.compileForEmulator(sourceCode);
emulator.loadProgram(base64Data);
```

### Build System Integration

```javascript
// Webpack/Gulp integration
const { C64BasicTokenizer } = require('./c64tokenizer.js');

function c64BasicLoader(source) {
    const tokenizer = new C64BasicTokenizer();
    const prgData = tokenizer.compile(source);
    
    return `module.exports = new Uint8Array([${Array.from(prgData).join(',')}]);`;
}

// Gulp task
const gulp = require('gulp');
const through = require('through2');

gulp.task('compile-basic', () => {
    return gulp.src('src/**/*.bas')
        .pipe(through.obj((file, enc, cb) => {
            const tokenizer = new C64BasicTokenizer();
            const prgData = tokenizer.compile(file.contents.toString());
            
            file.contents = prgData;
            file.extname = '.prg';
            
            cb(null, file);
        }))
        .pipe(gulp.dest('dist/'));
});
```

## Error Handling

The tokenizer provides error handling for common issues:

```javascript
try {
    const prgData = tokenizer.compile(sourceCode);
} catch (error) {
    if (error.message.includes('Label not found')) {
        console.error('Undefined label:', error.label);
    } else if (error.message.includes('Syntax error')) {
        console.error('Syntax error at line:', error.line);
    } else {
        console.error('Compilation error:', error.message);
    }
}
```

## Performance Considerations

- **Large Programs**: The tokenizer is optimized for programs up to 64KB
- **Memory Usage**: Minimal memory footprint, processes line by line
- **Speed**: Fast compilation, suitable for real-time web applications

## Limitations

- **C64 BASIC V2 Only**: Supports Commodore 64 BASIC V2 dialect
- **No Extensions**: Doesn't support C64 BASIC extensions or machine code
- **Line Numbers**: Maximum line number is 65535
- **Memory**: Programs must fit within C64 memory constraints

## Testing

```javascript
// Unit test example
const assert = require('assert');
const { C64BasicTokenizer } = require('./c64tokenizer.js');

describe('C64BasicTokenizer', () => {
    let tokenizer;

    beforeEach(() => {
        tokenizer = new C64BasicTokenizer();
    });

    test('should compile simple PRINT statement', () => {
        const source = '10 PRINT "HELLO"';
        const prgData = tokenizer.compile(source);
        
        assert(prgData.length > 0);
        assert(prgData[0] === 0x01); // Load address low byte
        assert(prgData[1] === 0x08); // Load address high byte
    });

    test('should resolve labels correctly', () => {
        const source = `
10 GOTO START
START:
20 PRINT "HELLO"
30 END
`;
        const prgData = tokenizer.compile(source);
        
        // Verify GOTO START resolves to line 20
        // (implementation specific verification)
    });
});
```

## Contributing

When extending the tokenizer:

1. **Add New Tokens**: Update `C64_TOKENS` in `compiler.ts`
2. **Add Control Codes**: Update `parseControlCode()` method
3. **Modify Label Logic**: Update the two-pass compilation system
4. **Test Thoroughly**: Ensure compatibility with C64 emulators

## License

This tokenizer is part of the 8bitworkshop project and follows the same licensing terms.

---

For more information, see the main project documentation or contact the development team.
