10 REM BBC BASIC: Text formatting, colours, and control codes
20 MODE 7:CLS
30 PRINT "BBC BASIC Text Formatting"
40 PRINT STRING$(30,"=")
50 PRINT
60 PRINT "Normal text"
70 PRINT CHR$(129);"Red text ";CHR$(135);"/ White again"
80 PRINT CHR$(132);"Green ";CHR$(135);" ";CHR$(131);"Yellow"
90 PRINT
100 PRINT "Tabbed:";TAB(20);"Aligned at column 20"
110 PRINT "Mixed";TAB(10);"columns";TAB(30);"demo"
120 PRINT
130 PRINT "Box with CHR$ codes:"
140 PRINT CHR$(141);STRING$(30,45);CHR$(141)
150 FOR R=1 TO 3: PRINT "|";SPC(28);"|": NEXT
160 PRINT CHR$(141);STRING$(30,45);CHR$(141)
170 PRINT
180 PRINT "Press any key to continue...";:A$=GET$

