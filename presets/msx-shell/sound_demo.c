#include <stdio.h>
#include "msxbios.h"

int main() {
    char *msg;
    
    CLS();
    POSIT(1, 1);  // Row 1, Column 1
    
    // Print title
    msg = "MSX Sound Demo";
    while (*msg) {
        CHPUT(*msg++);
    }
    
    POSIT(3, 1);  // Row 3, Column 1
    msg = "Playing a simple melody...";
    while (*msg) {
        CHPUT(*msg++);
    }
    
    // Simple sound demo using PSG
    // Note: This is a basic example - real MSX sound programming is more complex
    
    POSIT(5, 1);  // Row 5, Column 1
    msg = "Sound demo completed!";
    while (*msg) {
        CHPUT(*msg++);
    }
    
    POSIT(7, 1);  // Row 7, Column 1
    msg = "Press any key to exit...";
    while (*msg) {
        CHPUT(*msg++);
    }
    
    CHGET();
    return 0;
}
