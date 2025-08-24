#include <stdio.h>
#include <conio.h>
#include <stdlib.h>

// BBC-specific color definitions
#define COLOR_BLACK     0
#define COLOR_RED       1
#define COLOR_GREEN     2
#define COLOR_YELLOW    3
#define COLOR_BLUE      4
#define COLOR_MAGENTA   5
#define COLOR_CYAN      6
#define COLOR_WHITE     7

void clear_screen() {
    clrscr();
}

void set_color(int color) {
    textcolor(color);
}

void print_centered(const char* text) {
    int len = 0;
    int spaces;
    int i;
    const char* p = text;
    
    while (*p++) len++;
    
    spaces = (40 - len) / 2;  // BBC screen is 40 columns
    for (i = 0; i < spaces; i++) {
        printf(" ");
    }
    printf("%s\n", text);
}

void draw_box(int x, int y, int width, int height, int color) {
    int i;
    
    set_color(color);
    
    // Draw top line
    gotoxy(x, y);
    printf("+");
    for (i = 1; i < width - 1; i++) printf("-");
    printf("+");
    
    // Draw sides
    for (i = 1; i < height - 1; i++) {
        gotoxy(x, y + i);
        printf("|");
        gotoxy(x + width - 1, y + i);
        printf("|");
    }
    
    // Draw bottom line
    gotoxy(x, y + height - 1);
    printf("+");
    for (i = 1; i < width - 1; i++) printf("-");
    printf("+");
}

int main() {
    int i;
    int frame;
    
    // Clear screen and set initial color
    clear_screen();
    set_color(COLOR_WHITE);
    
    // Title
    print_centered("BBC Micro Demo");
    printf("\n");
    
    // Color demo
    printf("Color demonstration:\n");
    for (i = 0; i <= 7; i++) {
        set_color(i);
        printf("Color %d: Hello BBC Micro!\n", i);
    }
    
    printf("\n");
    set_color(COLOR_WHITE);
    printf("Press any key to continue...\n");
    cgetc();
    
    // Clear screen for next demo
    clear_screen();
    
    // Box drawing demo
    set_color(COLOR_CYAN);
    print_centered("Box Drawing Demo");
    printf("\n");
    
    draw_box(5, 3, 30, 8, COLOR_RED);
    draw_box(8, 5, 24, 4, COLOR_GREEN);
    
    set_color(COLOR_YELLOW);
    gotoxy(10, 6);
    printf("BBC Micro with cc65");
    gotoxy(10, 7);
    printf("6502 processor");
    
    printf("\n\n");
    set_color(COLOR_WHITE);
    printf("Press any key for animation...\n");
    cgetc();
    
    // Simple animation
    clear_screen();
    set_color(COLOR_MAGENTA);
    print_centered("Animation Demo");
    printf("\n");
    
    for (frame = 0; frame < 10; frame++) {
        clear_screen();
        set_color(COLOR_MAGENTA);
        print_centered("Animation Demo");
        printf("\n");
        
        set_color(COLOR_CYAN);
        gotoxy(15 + frame, 5);
        printf("O");
        
        set_color(COLOR_RED);
        gotoxy(15 - frame, 7);
        printf("X");
        
        set_color(COLOR_GREEN);
        gotoxy(20, 5 + frame);
        printf("*");
        
        // Small delay
        for (i = 0; i < 10000; i++) {
            // Simple delay loop
        }
    }
    
    // Final screen
    clear_screen();
    set_color(COLOR_WHITE);
    print_centered("BBC Micro Demo Complete!");
    printf("\n");
    print_centered("Thanks for using 8bitworkshop");
    printf("\n\n");
    print_centered("Press any key to exit...");
    
    // Wait for key press
    cgetc();
    
    return 0;
}
