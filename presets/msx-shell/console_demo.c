#include <stdio.h>
#include "msxbios.h"

int main() {
    char *msg;
    char key;
    
    CLS();
    POSIT(1, 1);  // Row 1, Column 1
    
    // Print welcome message
    msg = "MSX Console I/O Demo";
    while (*msg) {
        CHPUT(*msg++);
    }
    
    POSIT(3, 1);  // Row 3, Column 1
    msg = "Press any key to continue...";
    while (*msg) {
        CHPUT(*msg++);
    }
    
    // Wait for key press
    key = CHGET();
    
    POSIT(5, 1);  // Row 5, Column 1
    msg = "You pressed: ";
    while (*msg) {
        CHPUT(*msg++);
    }
    CHPUT(key);
    
    POSIT(7, 1);  // Row 7, Column 1
    msg = "Press any key to exit...";
    while (*msg) {
        CHPUT(*msg++);
    }
    
    CHGET();
    return 0;
}
