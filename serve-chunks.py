#!/usr/bin/env python3
"""
Simple HTTP server to serve MS-DOS 6.22 disk image chunks
This mimics how copy.sh serves the chunked disk images
"""

import http.server
import socketserver
import os
import re
from urllib.parse import urlparse, parse_qs

class ChunkedDiskHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Handle chunked disk image requests
        if self.path.startswith('/msdos622/'):
            # Extract the chunk range from the URL
            # Format: /msdos622/start-end.img
            match = re.match(r'/msdos622/(\d+)-(\d+)\.img', self.path)
            if match:
                start = int(match.group(1))
                end = int(match.group(2))
                chunk_size = end - start
                
                # Find the corresponding chunk file
                chunk_file = f"res/{start}-{end}.img"
                if os.path.exists(chunk_file):
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/octet-stream')
                    self.send_header('Content-Length', str(chunk_size))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    
                    with open(chunk_file, 'rb') as f:
                        self.wfile.write(f.read())
                    return
        
        # Fall back to default file serving
        super().do_GET()

if __name__ == "__main__":
    PORT = 8080
    
    with socketserver.TCPServer(("", PORT), ChunkedDiskHandler) as httpd:
        print(f"Serving chunked disk images at http://localhost:{PORT}")
        print("Available chunks:")
        for file in sorted(os.listdir("res")):
            if file.endswith('.img') and '-' in file:
                print(f"  /msdos622/{file}")
        print("\nPress Ctrl+C to stop")
        httpd.serve_forever()
