// BBC Micro Hello World using inline assembly
// This avoids the _write dependency by using BBC OS calls directly

int main(void) {
    // BBC Micro OS call to write character
    // OSWRCH - Write character to current output stream
    __asm__("LDA #'H'"); __asm__("JSR $FFEE");  // OSWRCH
    __asm__("LDA #'e'"); __asm__("JSR $FFEE");  // OSWRCH
    __asm__("LDA #'l'"); __asm__("JSR $FFEE");  // OSWRCH
    __asm__("LDA #'l'"); __asm__("JSR $FFEE");  // OSWRCH
    __asm__("LDA #'o'"); __asm__("JSR $FFEE");  // OSWRCH
    __asm__("LDA #' '"); __asm__("JSR $FFEE");  // OSWRCH
    __asm__("LDA #'W'"); __asm__("JSR $FFEE");  // OSWRCH
    __asm__("LDA #'o'"); __asm__("JSR $FFEE");  // OSWRCH
    __asm__("LDA #'r'"); __asm__("JSR $FFEE");  // OSWRCH
    __asm__("LDA #'l'"); __asm__("JSR $FFEE");  // OSWRCH
    __asm__("LDA #'d'"); __asm__("JSR $FFEE");  // OSWRCH
    __asm__("LDA #'!'"); __asm__("JSR $FFEE");  // OSWRCH
    __asm__("LDA #13"); __asm__("JSR $FFEE");   // OSWRCH (carriage return)
    __asm__("LDA #10"); __asm__("JSR $FFEE");   // OSWRCH (line feed)
    
    // Wait for key press
    __asm__("JSR $FFE0");  // OSRDCH - Read character from input stream
    
    return 0;
}
