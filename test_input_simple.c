#include <stdio.h>
#include <conio.h>

int main() {
    printf("Input test starting...\n");
    printf("First getchar() call: ");
    int c1 = getchar();
    printf("Result: %d\n", c1);
    
    printf("Second getchar() call: ");
    int c2 = getchar();
    printf("Result: %d\n", c2);
    
    printf("Third getchar() call: ");
    int c3 = getchar();
    printf("Result: %d\n", c3);
    
    printf("Test complete!\n");
    return 0;
}
