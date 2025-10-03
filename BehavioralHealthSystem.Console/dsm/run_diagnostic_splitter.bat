@echo off
echo DSM5 Diagnostic Items Splitter Setup and Execution
echo ==================================================
echo.

echo Installing required dependencies...
pip install -r requirements.txt

echo.
echo Running diagnostic items splitter...
echo This will create separate PDF files for each diagnostic item.
echo.
python split_dsm5_diagnostic.py

echo.
echo Script completed. Check the output files.
echo Press any key to exit.
pause > nul