@echo off
echo ================================================
echo        LearnPath AI - Smart Learning Planner
echo ================================================
echo.
echo Starting server...
start /B "" "C:\Users\б╫рт╨Ц\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" "D:\ai_creation2\learnpath-ai\server.py" 8080
timeout /t 3 /nobreak >nul
echo Server started!
echo Open in browser: http://localhost:8080
echo.
echo Press any key to stop server...
pause
