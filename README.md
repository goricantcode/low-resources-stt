---
title: "Low Resources STT API"
emoji: 🎙️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
app_file: app.py
pinned: false
---

# Speech-to-Text API
This is the backend API for the Low Resources Speech-to-Text project, supporting Bhojpuri, Maithili, and Assamese.

### How to use:
- **Endpoint**: `/transcribe` (POST)
- **Parameters**: `file` (audio), `language` (bhojpuri/maithili/assamese)
- **Health Check**: `/health` (GET)

### Deployment:
Deployed using Docker on Hugging Face Spaces for 16GB RAM support.
