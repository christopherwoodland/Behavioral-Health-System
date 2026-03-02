@echo off
echo DSM5 PDF Splitter Setup and Execution
echo =====================================
echo.

echo Installing required dependencies...
pip install -r requirements.txt

echo.
echo Running PDF splitter...
python split_dsm5.py

echo.
echo Script completed. Press any key to exit.
pause > nul