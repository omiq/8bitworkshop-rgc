#!/usr/bin/env python3
"""
BBC Micro SSD disc creation script for 8bitworkshop
This creates proper BBC Micro SSD discs from compiled binaries
"""

import sys
import json
import base64
from math import floor
import tempfile
import os

# Constants from the working makedisk.py
BYTES_PER_SECTOR = 256
SECTORS_PER_TRACK = 10
TRACK_COUNT = 80
START_SECTOR = 2

def create_ssd_disc(binary_data, filename="PROGRAM", title="8BITWORKSHOP", boot_option="run"):
    """
    Create a BBC Micro SSD disc image from binary data
    
    Args:
        binary_data: Base64 encoded binary data
        filename: Name of the program file
        title: Disc title
        boot_option: "load", "run", or "exec"
    
    Returns:
        Base64 encoded SSD disc image
    """
    
    # Decode the binary data
    program_data = base64.b64decode(binary_data)
    
    # Create temporary files
    with tempfile.NamedTemporaryFile(suffix='.bin', delete=False) as temp_bin:
        temp_bin.write(program_data)
        temp_bin_path = temp_bin.name
    
    with tempfile.NamedTemporaryFile(suffix='.ssd', delete=False) as temp_ssd:
        temp_ssd_path = temp_ssd.name
    
    try:
        # Create the SSD disc using the working makedisk.py logic
        create_ssd_from_binary(temp_bin_path, temp_ssd_path, filename, title, boot_option)
        
        # Read the created SSD file
        with open(temp_ssd_path, 'rb') as f:
            ssd_data = f.read()
        
        # Return as base64
        return base64.b64encode(ssd_data).decode('utf-8')
        
    finally:
        # Clean up temporary files
        os.unlink(temp_bin_path)
        os.unlink(temp_ssd_path)

def create_ssd_from_binary(binary_file, output_file, filename, title, boot_option):
    """
    Create SSD disc using the logic from the working makedisk.py
    """
    
    # Read the binary file
    with open(binary_file, 'rb') as f:
        program_data = f.read()
    
    # Create file specification
    file_spec = {
        "directory": "$",
        "file": binary_file,
        "name": filename,
        "load_addr": 0x2000,  # Standard BBC load address
        "exec_addr": 0x2000,  # Standard BBC exec address
        "length": len(program_data)
    }
    
    # Create catalog entry
    catalog = [FileEntry(file_spec, START_SECTOR, program_data)]
    
    # Create boot file if needed
    if boot_option in ["load", "run", "exec"]:
        boot_file = create_boot_file(catalog[0], boot_option)
        if boot_file:
            catalog.insert(0, boot_file)
            # Adjust start sectors
            for f in catalog[1:]:
                f.start_sector = boot_file.start_sector + boot_file.sectors
    
    # Write the SSD disc
    surface = SSDSurface(output_file, title, boot_option)
    surface.write_catalog(catalog)
    surface.write_files(catalog)

class FileEntry:
    def __init__(self, spec, start_sector, content=None):
        self.spec = spec
        self.start_sector = start_sector
        self.content = content or bytearray()
        self.length = len(self.content)
        self.sectors = int(floor((self.length + BYTES_PER_SECTOR - 1) / BYTES_PER_SECTOR))

def create_boot_file(main_file, boot_option):
    """Create a !BOOT file for auto-boot functionality"""
    
    # Create boot command based on option
    if boot_option == "load":
        boot_content = "*LOAD " + main_file.spec["name"] + "\r"
    elif boot_option in ["run", "exec"]:
        boot_content = "*RUN " + main_file.spec["name"] + "\r"
    else:
        return None
    
    # Create boot file specification
    boot_spec = {
        "directory": "$",
        "file": "!BOOT",
        "name": "!BOOT",
        "load_addr": 0x1900,
        "exec_addr": 0x1900,
        "length": len(boot_content)
    }
    
    # Set auto-boot flag (bit 7)
    boot_spec["directory"] = chr(ord("$") | 0x80)
    
    # Create boot file entry
    boot_file = FileEntry(boot_spec, START_SECTOR, bytearray(boot_content, 'latin-1'))
    return boot_file

class SSDSector:
    def __init__(self, disk):
        self.written = 0
        self.disk = disk
    
    def write(self, num, data):
        self.disk.write(data[0:num])
        self.written += num
        if self.written > BYTES_PER_SECTOR:
            raise RuntimeError("Too many bytes in sector")
    
    def byte(self, byte):
        self.write(1, bytearray([byte]))
    
    def bitpairs(self, p3, p2, p1, p0):
        self.byte((((((p3 << 2) | p2) << 2) | p1) << 2) | p0)
    
    def word(self, word):  # 16 bits
        self.byte(word & 0xff)
        self.byte((word >> 8) & 0xff)
    
    def string(self, num, data, pad="\0"):
        chars = len(data)
        payload = data + (pad * (num-chars))
        self.write(num, bytearray(payload, 'latin-1'))
    
    def close(self):
        remaining = BYTES_PER_SECTOR - self.written
        self.write(remaining, bytearray([0]) * remaining)

class SSDSurface:
    def __init__(self, disk_path, title, opt):
        self.title = title
        self.opt = opt
        self.disk = open(disk_path, "wb")
    
    def _sector00(self, catalog):
        """Write sector 00 (catalogue part 1)"""
        s = SSDSector(self.disk)
        
        s.string(8, self.title)
        
        for entry in catalog:
            s.string(7, entry.spec["name"], pad=" ")
            s.write(1, bytearray([ord(entry.spec["directory"])]))
        
        s.close()
    
    def _sector01(self, catalog):
        """Write sector 01 (catalogue part 2)"""
        s = SSDSector(self.disk)
        
        s.string(4, self.title[8:])
        s.byte(0)
        s.byte(len(catalog)*8)
        
        sector_count = TRACK_COUNT * SECTORS_PER_TRACK
        boot_opts = {None: 0, "load": 1, "run": 2, "exec": 3}
        
        # Set boot option
        if self.opt in ["run", "exec"]:
            boot_option = 3  # Use exec mode for auto-boot
        else:
            boot_option = boot_opts.get(self.opt, 0)
        
        s.bitpairs(0, boot_option, 0, sector_count >> 8)
        s.byte(sector_count & 0xff)
        
        for entry in catalog:
            s.word(entry.spec["load_addr"])
            s.word(entry.spec["exec_addr"])
            s.word(entry.length)
            s.bitpairs(entry.spec["exec_addr"] >> 16, entry.length >> 16,
                      entry.spec["load_addr"] >> 16, entry.start_sector >> 8)
            s.byte(entry.start_sector & 0xff)
        
        s.close()
    
    def _sector(self, block):
        s = SSDSector(self.disk)
        s.write(len(block), block)
        s.close()
    
    def write_catalog(self, catalog):
        self._sector00(catalog)
        self._sector01(catalog)
    
    def write_files(self, catalog):
        for f in catalog:
            remaining_content = f.content
            while len(remaining_content) > 0:
                chunk_size = min(len(remaining_content), BYTES_PER_SECTOR)
                self._sector(remaining_content[0:chunk_size])
                remaining_content = remaining_content[chunk_size:]

def main():
    """Handle command line interface for the script"""
    if len(sys.argv) != 2:
        print("Usage: python3 bbc_makedisk.py <json_input>")
        sys.exit(1)
    
    try:
        # Parse JSON input
        input_data = json.loads(sys.argv[1])
        
        # Create SSD disc
        ssd_data = create_ssd_disc(
            input_data['binary_data'],
            input_data.get('filename', 'PROGRAM'),
            input_data.get('title', 'RETROIDE'),
            input_data.get('boot_option', 'run')
        )
        
        # Return result as JSON
        result = {
            'success': True,
            'ssd_data': ssd_data
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(result))
        sys.exit(1)

if __name__ == "__main__":
    main()
