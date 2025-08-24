#!/usr/bin/env python3
"""
Create BBC filesystem for 8bitworkshop
This script creates a proper filesystem data file with BBC-specific files
"""

import os
import json
import struct
from pathlib import Path

CC65_PATH = "/Users/chrisg/cc65"
FS_DIR = "src/worker/fs"
BBC_FS_NAME = "fs65-bbc"

def create_bbc_filesystem():
    """Create BBC filesystem with proper structure"""
    
    print("Creating BBC filesystem...")
    
    # Create temporary directory
    temp_dir = Path("/tmp/bbc_fs_proper")
    temp_dir.mkdir(exist_ok=True)
    
    # Create the directory structure
    (temp_dir / "cfg").mkdir(exist_ok=True)
    (temp_dir / "lib").mkdir(exist_ok=True)
    (temp_dir / "include").mkdir(exist_ok=True)
    (temp_dir / "asminc").mkdir(exist_ok=True)
    
    # Copy BBC-specific files
    files_to_copy = [
        ("cfg/bbc.cfg", "cfg/bbc.cfg"),
        ("lib/bbc.lib", "lib/bbc.lib"),
        ("include/bbc.h", "include/bbc.h"),
        ("asminc/bbc.inc", "asminc/bbc.inc"),
    ]
    
    # Copy common include files (essential ones)
    common_includes = [
        "stdio.h", "stdlib.h", "string.h", "ctype.h", "stddef.h",
        "stdarg.h", "stdbool.h", "stdint.h", "limits.h", "errno.h",
        "assert.h", "time.h", "setjmp.h", "signal.h", "unistd.h"
    ]
    
    for include_file in common_includes:
        src_path = Path(CC65_PATH) / "include" / include_file
        if src_path.exists():
            files_to_copy.append((f"include/{include_file}", f"include/{include_file}"))
    
    # Copy files
    file_data = {}
    current_offset = 0
    
    for src_rel, dst_rel in files_to_copy:
        src_path = Path(CC65_PATH) / src_rel
        dst_path = temp_dir / dst_rel
        
        if src_path.exists():
            # Create parent directory
            dst_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Copy file
            with open(src_path, 'rb') as f:
                data = f.read()
            
            with open(dst_path, 'wb') as f:
                f.write(data)
            
            # Record file info
            file_data[f"/{dst_rel}"] = {
                "start": current_offset,
                "end": current_offset + len(data)
            }
            current_offset += len(data)
            
            print(f"  Added: {dst_rel} ({len(data)} bytes)")
        else:
            print(f"  Warning: {src_path} not found")
    
    # Create the data file
    data_file = Path(FS_DIR) / f"{BBC_FS_NAME}.data"
    data_file.parent.mkdir(exist_ok=True)
    
    with open(data_file, 'wb') as f:
        for src_rel, dst_rel in files_to_copy:
            src_path = Path(CC65_PATH) / src_rel
            if src_path.exists():
                with open(src_path, 'rb') as src_f:
                    f.write(src_f.read())
    
    # Create metadata file
    metadata = {
        "files": [
            {"filename": filename, "start": info["start"], "end": info["end"]}
            for filename, info in file_data.items()
        ],
        "remote_package_size": current_offset,
        "package_uuid": f"bbc-micro-fs-{int(os.path.getmtime(data_file))}"
    }
    
    metadata_file = Path(FS_DIR) / f"{BBC_FS_NAME}.js.metadata"
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\nBBC filesystem created:")
    print(f"  Data file: {data_file} ({current_offset} bytes)")
    print(f"  Metadata: {metadata_file}")
    print(f"  Files: {len(file_data)}")
    
    # Clean up
    import shutil
    shutil.rmtree(temp_dir)
    
    return data_file, metadata_file

if __name__ == "__main__":
    create_bbc_filesystem()
