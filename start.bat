@echo off
echo Starting Bhojpuri Audio Processing API...

REM Install dependencies
pip install flask flask-cors soundfile numpy scipy librosa scikit-learn

REM Run the Flask application
python app.py

pause
