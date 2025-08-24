#include <stdio.h>

int main() {
    printf("Testing different BBC input methods...\n");
    
    // Method 1: Direct OS call
    printf("Method 1: Direct OSRDCH call\n");
    printf("Press a key: ");
    __asm__("JSR $FFE0");  // OSRDCH
    printf("OSRDCH called\n");
    
    // Method 2: Try OSBYTE call for input
    printf("Method 2: OSBYTE call for input\n");
    printf("Press a key: ");
    __asm__("LDA #$81");   // OSBYTE function 81 - read character
    __asm__("JSR $FFF4");  // OSBYTE
    printf("OSBYTE called\n");
    
    // Method 3: Try polling for key press
    printf("Method 3: Polling for key press\n");
    printf("Press a key: ");
    __asm__("LDA #$81");   // OSBYTE function 81
    __asm__("LDX #$00");   // X=0 for immediate return
    __asm__("JSR $FFF4");  // OSBYTE
    printf("Polling complete\n");
    
    printf("All methods tested\n");
    return 0;
}
