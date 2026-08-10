@echo off
setlocal enabledelayedexpansion

if not exist "archive" mkdir archive

REM Month to numeric conversion
set "Jan=01" & set "Feb=02" & set "Mar=03" & set "Apr=04"
set "May=05" & set "Jun=06" & set "Jul=07" & set "Aug=08"
set "Sep=09" & set "Oct=10" & set "Nov=11" & set "Dec=12"

for /f "delims=" %%F in ('dir /b *.csv 2^>nul') do (
    set "file=%%F"
    
    REM Extract base name, date, version
    for /f "tokens=1-3 delims=_v" %%A in ("!file!") do (
        set "base=%%A"
        set "datestr=%%B"
        set "verstr=%%C"
    )
    
    REM Remove (1) suffix from base for grouping
    set "groupkey=!base: (1)=!"
    
    REM Convert MonDD to numeric MMDD
    set "mon=!datestr:~0,3!"
    set "day=!datestr:~3,2!"
    set "numdate=!%mon%!!day!"
    
    REM Remove .csv and extract version number
    set "version=!verstr:.csv=!"
    
    if not defined latest_!groupkey! (
        set "latest_!groupkey!=!file!"
        set "numdate_!groupkey!=!numdate!"
        set "version_!groupkey!=!version!"
    ) else (
        REM Compare: date first, then version
        if "!numdate!" gtr "!numdate_!groupkey!" (
            move "!latest_!groupkey!" "archive\" >nul 2>&1
            set "latest_!groupkey!=!file!"
            set "numdate_!groupkey!=!numdate!"
            set "version_!groupkey!=!version!"
        ) else if "!numdate!" equ "!numdate_!groupkey!" (
            if "!version!" gtr "!version_!groupkey!" (
                move "!latest_!groupkey!" "archive\" >nul 2>&1
                set "latest_!groupkey!=!file!"
                set "version_!groupkey!=!version!"
            ) else (
                move "!file!" "archive\" >nul 2>&1
            )
        ) else (
            move "!file!" "archive\" >nul 2>&1
        )
    )
)

echo Done. Archived duplicates. Latest files remain.
endlocal
