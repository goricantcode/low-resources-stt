import os
import sys
import logging
import io
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
import librosa
import soundfile as sf

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Gemini Setup
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logging.warning("GEMINI_API_KEY not found in .env file!")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

SYSTEM_PROMPT = """
You are an expert multilingual STT assistant for the Pravatha automation suite.
Your task is to transcribe the provided audio in Bhojpuri, Maithili, or Assamese.
Additionally, you must identify if the user is giving a browser command.

Commands to identify:
- NEW_TAB: Opening a new tab
- OPEN_TWITTER: Going to Twitter/X
- OPEN_GMAIL: Going to Gmail
- SCROLL_DOWN: Scrolling down
- SCROLL_UP: Scrolling up
- CLOSE_TAB: Closing the current tab

Return your response ONLY as a JSON object:
{
  "transcription": "The native text",
  "command": "COMMAND_KEY or null",
  "language": "Detected Language"
}
"""

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "engine": "Gemini 1.5 Flash"})

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    
    file = request.files['file']
    lang_hint = request.form.get('language', 'Bhojpuri')
    
    try:
        # 1. Save and Pre-process (Optional but good for quality)
        temp_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(temp_path)
        
        # 2. Upload to Gemini
        logging.info(f"Uploading {file.filename} to Gemini...")
        sample_file = genai.upload_file(path=temp_path, display_name="User Recording")
        
        # 3. Generate Content
        response = model.generate_content([
            SYSTEM_PROMPT,
            f"The user is likely speaking {lang_hint}.",
            sample_file
        ])
        
        # 4. Parse Response (Expect JSON)
        # Gemini sometimes wraps JSON in ```json blocks
        response_text = response.text
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            result = json_match.group(0)
            import json
            result_data = json.loads(result)
        else:
            result_data = {
                "transcription": response_text,
                "command": None,
                "language": lang_hint
            }
        
        # Clean up
        os.remove(temp_path)
        genai.delete_file(sample_file.name)
        
        logging.info(f"Transcription: {result_data.get('transcription')}")
        return jsonify(result_data)

    except Exception as e:
        logging.error(f"Gemini Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
