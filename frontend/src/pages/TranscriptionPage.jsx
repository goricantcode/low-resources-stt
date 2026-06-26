import React, { useState, useEffect, useRef } from "react";
import {
  DocumentArrowUpIcon,
  PlayIcon,
  PauseIcon,
  MicrophoneIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import axios from "axios";

function TranscriptionPage() {
  const [transcribedText, setTranscribedText] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(null); // "bhojpuri", "maithili", "assamese"
  const [elapsedTime, setElapsedTime] = useState(0); // in milliseconds
  const [transcriptionTime, setTranscriptionTime] = useState(null); // final time in milliseconds
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0); // in milliseconds
  const [audioChunks, setAudioChunks] = useState([]);
  const [audioData, setAudioData] = useState(null); // For visualization
  const [isDragging, setIsDragging] = useState(false);
  const audioRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const canvasRef = useRef(null);
  const rawAudioChunksRef = useRef([]); // To store raw PCM data for WAV encoding

  // API configuration
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/transcribe";

  useEffect(() => {
    console.log("Current API URL:", API_URL);
  }, [API_URL]);

  // Clean up audio URL when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);


  // Timer effect - updates elapsed time every 100ms while loading
  useEffect(() => {
    if (isLoading) {
      startTimeRef.current = Date.now();
      setElapsedTime(0);
      setTranscriptionTime(null);

      timerIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Date.now() - startTimeRef.current;
          setElapsedTime(elapsed);
        }
      }, 100);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isLoading]);

  const mergeBuffers = (chunks) => {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  };

  const bufferToWav = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup Analyser for visualization
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      // Add a processor to capture raw PCM for WAV encoding
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      rawAudioChunksRef.current = [];
      
      processor.onaudioprocess = (e) => {
        if (mediaRecorderRef.current?.state === 'recording') {
          const inputData = e.inputBuffer.getChannelData(0);
          rawAudioChunksRef.current.push(new Float32Array(inputData));
        }
      };

      source.connect(analyser);
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      audioContextRef.current = audioContext;

      // Ensure context is active
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.onstop = () => {
        // Encode raw PCM to WAV
        const fullBuffer = mergeBuffers(rawAudioChunksRef.current);
        const audioBlob = bufferToWav(fullBuffer, audioContext.sampleRate);
        const file = new File([audioBlob], "recording.wav", { type: "audio/wav" });
        processFile(file);
        
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        setAudioData(0);
      };

      // Function to draw scrolling waveform (Oscillogram style)
      const visualize = () => {
        if (!analyserRef.current || !canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const barWidth = 4;
        const barGap = 1;
        const barsCount = Math.floor(canvas.width / (barWidth + barGap));
        const levels = new Array(barsCount).fill(0);
        
        const draw = () => {
          // Check hardware state to avoid React stale closure bugs
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
          animationFrameRef.current = requestAnimationFrame(draw);
          
          analyser.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          // Boosted average for better visibility
          const avg = (sum / bufferLength) * 1.5; 
          
          levels.push(avg);
          if (levels.length > barsCount) levels.shift();
          
          // Clear canvas (transparent)
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw bars
          const centerY = canvas.height / 2;
          ctx.fillStyle = "rgb(220, 38, 38)"; // red-600
          
          levels.forEach((level, i) => {
            const x = i * (barWidth + barGap);
            // Minimum height of 4px to ensure it's always visible
            const barHeight = Math.max(4, (level / 128) * canvas.height * 0.8); 
            ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
          });
        };
        
        draw();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      visualize();

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 100);
      }, 100);

    } catch (err) {
      console.error("Microphone error:", err);
      setError("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const processFile = async (file) => {
    if (!file) return;

    // Validate language selection
    if (!selectedLanguage) {
      setError("Please select a language first before uploading.");
      return;
    }

    // Reset states
    setTranscribedText("");
    setDetectedLanguage(null);
    setError(null);
    setTranscriptionTime(null);
    setElapsedTime(0);
    setAudioFile(file);

    // Create object URL for audio playback
    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    setIsLoading(true);

    try {
      // Create FormData to send file
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", selectedLanguage);

      // Send file to API
      const response = await axios.post(API_URL, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 120000,
      });

      // Calculate final transcription time
      if (startTimeRef.current) {
        const finalTime = Date.now() - startTimeRef.current;
        setTranscriptionTime(finalTime);
      }

      setTranscribedText(response.data.transcription);
      setDetectedLanguage(response.data.language || selectedLanguage);
    } catch (err) {
      console.error("Full error details:", err);
      if (err.response) {
        setError(`Server Error: ${err.response.data.error || "Unknown server error"}`);
      } else if (err.request) {
        setError("No response from server. Please check the API is running.");
      } else {
        setError(`Request setup error: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      processFile(file);
      event.target.value = ""; // Reset file input
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading && selectedLanguage) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isLoading || !selectedLanguage) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatTime = (milliseconds) => {
    // Always show milliseconds
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }
    const seconds = Math.floor(milliseconds / 1000);
    const ms = milliseconds % 1000;
    if (seconds < 60) {
      // Show seconds with full milliseconds (e.g., "5.234s")
      return `${seconds}.${String(ms).padStart(3, "0")}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    // For times over a minute, show minutes, seconds, and milliseconds
    if (ms > 0) {
      return `${mins}m ${secs}.${String(ms).padStart(3, "0")}s`;
    }
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };


  const transcribeAudio = async (file) => {
    setIsLoading(true);
    startTimeRef.current = Date.now();

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", selectedLanguage);

      const response = await axios.post(API_URL, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 120000,
      });

      if (startTimeRef.current) {
        const finalTime = Date.now() - startTimeRef.current;
        setTranscriptionTime(finalTime);
      }

      setTranscribedText(response.data.transcription);
      setDetectedLanguage(response.data.language || selectedLanguage);
    } catch (err) {
      console.error("Full error details:", err);
      if (err.response) {
        setError(
          `Server Error: ${err.response.data.error || "Unknown server error"}`
        );
      } else if (err.request) {
        setError("No response from server. Please check the API is running.");
      } else {
        setError(`Request setup error: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl max-w-4xl w-full border border-gray-200">
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
            Multi-Lingual Speech-to-Text
          </h1>
          <p className="text-gray-600 text-lg max-w-xl mx-auto">
            Transform your Bhojpuri, Maithili, or Assamese audio into clear,
            readable text.
          </p>
        </div>

        {/* Language Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Select Language: <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="language"
                value="bhojpuri"
                checked={selectedLanguage === "bhojpuri"}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                disabled={isLoading || isRecording}
              />
              <span className="ml-2 text-gray-700 font-medium">Bhojpuri</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="language"
                value="maithili"
                checked={selectedLanguage === "maithili"}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                disabled={isLoading || isRecording}
              />
              <span className="ml-2 text-gray-700 font-medium">Maithili</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="language"
                value="assamese"
                checked={selectedLanguage === "assamese"}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                disabled={isLoading || isRecording}
              />
              <span className="ml-2 text-gray-700 font-medium">Assamese</span>
            </label>
          </div>
        </div>


        {/* Recording Section */}
        <div className="mb-8 flex flex-col items-center">
          {/* Always render canvas so ref is never null, just hide it */}
          <div className={`${!isRecording ? 'hidden' : 'w-full flex flex-col items-center py-4'}`}>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
              <span className="text-red-600 font-bold text-xs tracking-widest">REC</span>
            </div>
            
            {/* Minimal Waveform */}
            <div className="w-full h-16 mb-6">
              <canvas 
                ref={canvasRef} 
                width="400" 
                height="64" 
                className="w-full h-full"
              />
            </div>

            <button
              onClick={stopRecording}
              className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-red-500 text-red-600 hover:bg-red-50 transition-colors duration-200"
              title="Stop Recording"
            >
              <div className="w-4 h-4 bg-red-600 rounded-sm"></div>
            </button>
          </div>

          {!isRecording && (
            <button
              onClick={startRecording}
              disabled={isLoading || !selectedLanguage}
              className={`flex items-center justify-center space-x-3 px-8 py-4 rounded-full font-bold text-lg ${
                !selectedLanguage || isLoading
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              <MicrophoneIcon className="w-7 h-7" />
              <span>Start Recording</span>
            </button>
          )}
          <p className="mt-4 text-sm text-gray-500 font-medium">
            {isRecording && "Capturing your voice..."}
          </p>
        </div>

        {/* Upload Section */}
        <div className="mb-8">
          <label
            htmlFor="audio-upload"
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl group ${
              !selectedLanguage || isLoading
                ? "border-gray-300 bg-gray-50 cursor-not-allowed opacity-60"
                : isDragging
                ? "border-blue-500 bg-blue-100 cursor-pointer shadow-inner"
                : "border-blue-300 bg-blue-50 hover:bg-blue-100 cursor-pointer"
            }`}
            onClick={(e) => {
              if (!selectedLanguage || isLoading) {
                e.preventDefault();
                setError("Please select a language first before uploading.");
              }
            }}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <DocumentArrowUpIcon
                className={`w-10 h-10 mb-2 ${
                  !selectedLanguage || isLoading
                    ? "text-gray-400"
                    : isDragging
                    ? "text-blue-600 animate-bounce"
                    : "text-blue-500 group-hover:text-blue-600"
                }`}
              />
              <p className="mb-2 text-sm font-semibold text-gray-700">
                {!selectedLanguage ? (
                  <span className="text-gray-500">
                    Please select a language first
                  </span>
                ) : (
                  <>
                    <span className="text-blue-600">Click to upload</span> or
                    drag and drop
                  </>
                )}
              </p>
              <p className="text-xs text-gray-500">
                WAV, MP3, OGG, or FLAC (MAX. 10MB)
              </p>
            </div>
            <input
              id="audio-upload"
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isLoading || !selectedLanguage || isRecording}
            />
          </label>
        </div>

        {/* Audio Player Section */}
        {audioFile && audioUrl && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {audioFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(audioFile.size)}
                </p>
              </div>
              <button
                onClick={togglePlayPause}
                className="ml-4 flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={isLoading}
              >
                {isPlaying ? (
                  <PauseIcon className="w-6 h-6" />
                ) : (
                  <PlayIcon className="w-6 h-6 ml-1" />
                )}
              </button>
            </div>
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              className="w-full"
              controls
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mb-6 p-6 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center justify-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <div className="flex-1">
                <p className="text-blue-800 font-semibold">
                  Transcribing audio...
                </p>
                <p className="text-blue-600 text-sm">
                  Please wait while we process your audio file
                </p>
              </div>
              <div className="flex items-center space-x-2 bg-blue-100 px-3 py-1 rounded-lg">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-blue-800 font-semibold text-sm">
                  {formatTime(elapsedTime)}
                </span>
              </div>
            </div>
            <div className="mt-4 w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full animate-pulse"
                style={{ width: "60%" }}
              ></div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start">
              <div className="shrink-0">
                <svg
                  className="h-5 w-5 text-red-600"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-semibold text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <p className="text-xs text-red-600 mt-2">
                  Ensure the Bhojpuri STT API is running on {API_URL}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Transcription Result */}
        {transcribedText && !isLoading && (
          <div className="mt-6 p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                  <svg
                    className="w-6 h-6 mr-2 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Transcription Result
                </h2>
                {detectedLanguage && (
                  <span className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                    {detectedLanguage}
                  </span>
                )}
                {transcriptionTime !== null && (
                  <span className="px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full flex items-center gap-1">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Completed in {formatTime(transcriptionTime)}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(transcribedText);
                  alert("Transcription copied to clipboard!");
                }}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Copy
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-lg">
                {transcribedText}
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-4 italic flex items-center">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Transcribed using {detectedLanguage || selectedLanguage}{" "}
              Speech-to-Text model
            </p>
          </div>
        )}

        {/* Empty State */}
        {!transcribedText && !isLoading && !audioFile && !isRecording && (
          <div className="text-center py-8">
            <p className="text-gray-500 text-lg">
              {!selectedLanguage
                ? "Please select a language first, then upload an audio file or start recording"
                : "Upload an audio file or start recording to get started"}
            </p>
          </div>
        )}
      </div>

      <p className="text-gray-500 text-sm mt-6 text-center">
        Supported formats: WAV, MP3, OGG, FLAC | Record audio directly in your
        browser
      </p>
    </div>
  );
}

// WAV Encoding Helpers
function mergeBuffers(bufferList) {
  const totalLength = bufferList.reduce((acc, buf) => acc + buf.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const buffer of bufferList) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}

function bufferToWav(buffer, sampleRate) {
  const numChannels = 1;
  const length = buffer.length * numChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);

  // Write WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, length - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, 'data');
  view.setUint32(40, length - 44, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export default TranscriptionPage;
