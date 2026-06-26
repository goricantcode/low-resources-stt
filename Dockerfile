FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for soundfile and audio processing
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Create a directory for uploads
RUN mkdir -p uploads && chmod 777 uploads

# Expose the port Hugging Face expects (7860)
EXPOSE 7860

# Run the application
# We use 7860 as the port because that is the default for HF Spaces
CMD ["gunicorn", "--bind", "0.0.0.0:7860", "--timeout", "120", "app:app"]
