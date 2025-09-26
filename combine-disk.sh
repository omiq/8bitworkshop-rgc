#!/bin/bash

# Combine MS-DOS 6.22 disk image chunks into a complete disk image
# Based on the copy.sh/v86 MS-DOS 6.22 example

echo "Combining MS-DOS 6.22 disk image chunks..."

# Sort the files by their starting byte position and combine them
cat res/0-262144.img \
    res/262144-524288.img \
    res/524288-786432.img \
    res/1572864-1835008.img \
    res/1835008-2097152.img \
    res/2883584-3145728.img \
    res/3407872-3670016.img \
    res/3670016-3932160.img \
    res/6291456-6553600.img \
    res/6553600-6815744.img \
    res/7602176-7864320.img \
    res/7864320-8126464.img \
    res/8650752-8912896.img \
    res/8912896-9175040.img \
    res/9175040-9437184.img \
    res/10485760-10747904.img \
    res/47710208-47972352.img > res/msdos622.img

echo "Disk image combination complete!"
echo "Created: msdos622.img"
echo "Size: $(ls -lh msdos622.img | awk '{print $5}')"
