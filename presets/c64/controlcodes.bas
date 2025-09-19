10 REM C64 BASIC Control Codes Demo
20 PRINT CHR$(147);CHR$(14)
30 PRINT "control codes demo"
40 PRINT "-------------------"
50 PRINT
60 PRINT "screen controls:"
70 PRINT "{HOME}";"home";:PRINT
80 PRINT "{DOWN}";"down";"  {UP}";"up";:PRINT
90 PRINT "{LEFT}";"left";"  {RIGHT}";"right";:PRINT
100 PRINT "{DEL}";"del  {INS}";"ins";:PRINT
110 PRINT
120 PRINT "reverse video: {RVS}on{RVS OFF} and {RVS}off{RVS OFF}"
130 PRINT
140 PRINT "colors:" : PRINT
150 PRINT "{BLACK}";"black  ";"{WHITE}";"white  ";"{RED}";"red  ";"{CYAN}";"cyan"
160 PRINT "{PURPLE}";"purple ";"{GREEN}";"green ";"{BLUE}";"blue  ";"{YELLOW}";"yellow"
170 PRINT "{ORANGE}";"orange ";"{BROWN}";"brown ";"{PINK}";"pink  ";"{GRAY1}";"gray1"
180 PRINT "{GRAY2}";"gray2 ";"{GRAY3}";"gray3 ";"{LIGHTGREEN}";"lightgreen"
190 PRINT "{LIGHTBLUE}";"lightblue"
200 PRINT
210 PRINT "mixed text: ";"{YELLOW}";"yellow ";"{GREEN}";"green ";"{BLUE}";"blue";"{WHITE}"
220 PRINT
230 PRINT
240 PRINT CHR$(142);"Press any key...";
245 A$="":IF A$="" THEN GET A$:IF A$="" THEN 245
250 PRINT "{CLR}";"DONE"
260 END

