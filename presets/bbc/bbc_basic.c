// BBC Micro basic program using inline assembly
// This avoids library dependencies that might cause issues

int main() {
    const char* message;
    
    // Use inline assembly for BBC-specific operations
    
    // Clear screen using BBC OS call
    __asm__("LDA #12");      // Clear screen character
    __asm__("JSR $FFEE");    // OSWRCH call
    
    // Print "Hello BBC!" using inline assembly
    message = "Hello BBC!";
    while (*message) {
        __asm__("LDA %0" : : "r"(*message));
        __asm__("JSR $FFEE");  // OSWRCH call
        message++;
    }
    
    // Print new line
    __asm__("LDA #13");      // Carriage return
    __asm__("JSR $FFEE");    // OSWRCH call
    __asm__("LDA #10");      // Line feed
    __asm__("JSR $FFEE");    // OSWRCH call
    
    // Infinite loop
    while (1) {
        // Wait for key press
        __asm__("JSR $FFE0");  // OSRDCH call
    }
    
    return 0;
}
