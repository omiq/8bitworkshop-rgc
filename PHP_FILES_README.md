# PHP Files for BBC BASIC Program Loading

This directory contains PHP files that enable large BBC BASIC programs to be loaded via jsbeeb's `loadBasic` parameter.

## Files

### `savefile.php`
- **Purpose**: Saves user BASIC files to the server
- **Method**: POST
- **Parameters**:
  - `content`: The BASIC program content
  - `session`: Unique session ID
  - `file`: Filename (e.g., "program.bas")
- **Response**: JSON with success status and file path

### `userfile.php`
- **Purpose**: Serves saved BASIC files via URL
- **Method**: GET
- **Parameters**:
  - `session`: Session ID
  - `file`: Filename
- **Response**: Plain text BASIC program content

## How It Works

1. **Large BASIC programs** (> 1500 characters) are too big for URL parameters
2. **BBC platform** saves the program to the PHP server using `savefile.php`
3. **jsbeeb** loads the program via `loadBasic` URL parameter pointing to `userfile.php`
4. **No disk interference** - the program loads directly without blank disk issues

## Security

- Session IDs and filenames are validated with regex patterns
- Only alphanumeric characters, underscores, hyphens, and dots are allowed
- Files are stored in `/tmp/userfiles/{sessionID}/{filename}`

## Deployment

These files should be deployed to your web server (e.g., `https://ide.retrogamecoders.com/`) to enable the BBC BASIC loading functionality.

## Usage Example

```javascript
// Save a BASIC program
const formData = new FormData();
formData.append('content', basicProgramText);
formData.append('session', 'user_1234567890_abc123');
formData.append('file', 'program.bas');

fetch('https://ide.retrogamecoders.com/savefile.php', {
    method: 'POST',
    body: formData
});

// Load the program in jsbeeb
const loadBasicURL = 'https://ide.retrogamecoders.com/userfile.php?session=user_1234567890_abc123&file=program.bas';
// Use this URL with jsbeeb's loadBasic parameter
```
