#include "common.h"

// Simple BBC Micro hello world program
// This demonstrates basic BBC Micro programming

int main() {
    // Set screen mode 7 (teletext - 40x25 characters)
    __asm__("LDA #7");
    __asm__("JSR BBC_OSBYTE");
    
    // Print hello world message
    const char* message = "Hello BBC Micro!";
    while (*message) {
        __asm__("LDA %0" : : "r"(*message));
        __asm__("JSR BBC_OSWRCH");
        message++;
    }
    
    // Print new line
    __asm__("JSR BBC_OSCRLF");
    
    // Infinite loop
    while (1) {
        // Wait for key press
        __asm__("JSR BBC_OSRDCH");
    }
    
    return 0;
} 