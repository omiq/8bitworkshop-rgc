// Hello World using character arrays instead of string literals
void main() {
    char msg[] = {'H', 'e', 'l', 'l', 'o', ' ', 'W', 'o', 'r', 'l', 'd', '!', '\n', '\r', 0};
    
    // Print each character
    int i = 0;
    while (msg[i] != 0) {
        putchar(msg[i]);
        i++;
    }
    
    return;
}
