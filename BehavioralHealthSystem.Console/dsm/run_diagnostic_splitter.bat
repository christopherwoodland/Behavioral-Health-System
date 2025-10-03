@echo off
echo DSM5 Single-Page Diagnostic Items Splitter
echo ===========================================
echo.

echo Installing required dependencies...
pip install -r requirements.txt

echo.
echo Running single-page diagnostic items splitter...
echo This will create ONE PAGE per diagnostic item in the 'single-pages' folder.
echo Text will be scaled for computer readability.
echo.
python split_dsm5_single_page.py

echo.
echo Script completed. Check the 'single-pages' folder for output files.
echo Press any key to exit.
pause > nul