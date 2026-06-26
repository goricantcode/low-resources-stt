@echo off
echo Starting Bhojpuri STT API...

REM Activate virtual environment
call venv\Scripts\activate

REM Set environment variables if needed
set FLASK_APP=app.py
set FLASK_ENV=development
set FLASK_RUN_HOST=0.0.0.0
set FLASK_RUN_PORT=5000

REM Run the Flask application
flask run

pause
