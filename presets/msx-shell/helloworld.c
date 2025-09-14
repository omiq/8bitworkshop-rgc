#include <stdio.h>
#include "msxbios.h"

int main() {
    CLS();
    POSIT(0x0101);  // Row 1, Column 1
    CHPUT('H');
    CHPUT('e');
    CHPUT('l');
    CHPUT('l');
    CHPUT('o');
    CHPUT(',');
    CHPUT(' ');
    CHPUT('M');
    CHPUT('S');
    CHPUT('X');
    CHPUT('!');
    CHPUT(13);  // Carriage return
    CHPUT(10);  // Line feed
    
    // Wait for key press
    CHGET();
    return 0;
}
