#include <stdio.h>
#include "msxbios.h"

int main() {
    CLS();
    POSIT(1, 1);  // Row 1, Column 1
    
    // Print title
    const char* msg = "MSX Graphics Demo";
    while (*msg) {
        CHPUT(*msg++);
    }
    
    // Draw some simple graphics using characters
    POSIT(3, 1);  // Row 3, Column 1
    msg = "Drawing a box:";
    while (*msg) {
        CHPUT(*msg++);
    }
    
    // Draw a simple box
    for (int row = 5; row <= 10; row++) {
        POSIT(row, 5);  // Row, Column
        for (int col = 5; col <= 20; col++) {
            if (row == 5 || row == 10 || col == 5 || col == 20) {
                CHPUT('*');
            } else {
                CHPUT(' ');
            }
        }
    }
    
    POSIT(18, 1);  // Row 18, Column 1
    msg = "Press any key to exit...";
    while (*msg) {
        CHPUT(*msg++);
    }
    
    CHGET();
    return 0;
}
