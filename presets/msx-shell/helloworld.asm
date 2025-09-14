; MSX Hello World Assembly Program
; Simple Z80 assembly program for MSX

        .org    0x100

start:
        ; Clear screen
        call    CLS
        
        ; Position cursor at row 1, column 1
        ld      a, 1
        ld      h, 1
        call    POSIT
        
        ; Print "Hello, MSX!"
        ld      hl, message
print_loop:
        ld      a, (hl)
        or      a
        jr      z, wait_key
        call    CHPUT
        inc     hl
        jr      print_loop
        
wait_key:
        ; Wait for key press
        call    CHGET
        
        ; Exit
        ret

message:
        .db     "Hello, MSX!", 13, 10, 0

; MSX BIOS function addresses
CLS     equ     0x00C3
POSIT   equ     0x00C6
CHPUT   equ     0x00A2
CHGET   equ     0x009F
