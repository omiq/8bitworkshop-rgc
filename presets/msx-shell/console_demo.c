#include <stdio.h>
#include "msxbios.h"

int main() {
    CLS();
    POSIT(0x0101);  // Row 1, Column 1
    
    // Print welcome message
    const char* msg = "MSX Console I/O Demo";
    while (*msg) {
        CHPUT(*msg++);
    }
    
    POSIT(0x0301);  // Row 3, Column 1
    msg = "Press any key to continue...";
    while (*msg) {
        CHPUT(*msg++);
    }
    
    // Wait for key press
    char key = CHGET();
    
    POSIT(0x0501);  // Row 5, Column 1
    msg = "You pressed: ";
    while (*msg) {
        CHPUT(*msg++);
    }
    CHPUT(key);
    
    POSIT(0x0701);  // Row 7, Column 1
    msg = "Press any key to exit...";
    while (*msg) {
        CHPUT(*msg++);
    }
    
    CHGET();
    return 0;
}
