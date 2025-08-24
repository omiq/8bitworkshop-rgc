; BBC Micro assembly test program
; Pure 6502 assembly using BBC OS calls

        .segment "STARTUP"
        .org $1900

        ; Entry point
        jmp start

        .segment "CODE"
        .org $1900

start:
        ; Simple program that outputs a character and returns
        ; This tests if the program loads and runs at all
        
        ; Output a character to show the program is running
        lda #'X'
        jsr $FFEE          ; OSWRCH - write character
        
        ; Return to BASIC
        rts
