#include <stdio.h>
#include <conio.h>

int main() {
    printf("Testing input buffer...\n");
    printf("Press a key: ");
    
    // Clear any existing input buffer
    while (getchar() != EOF) {
        // Read and discard any existing characters
    }
    
    printf("Buffer cleared. Now press a key: ");
    int c = getchar();
    printf("You pressed: %c (ASCII %d)\n", c, c);
    
    printf("Press another key: ");
    c = getchar();
    printf("You pressed: %c (ASCII %d)\n", c, c);
    
    printf("Test complete!\n");
    return 0;
}
