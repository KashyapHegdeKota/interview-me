"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useReactMediaRecorder } from "react-media-recorder";
import { S3, PutObjectCommand } from "@aws-sdk/client-s3";

const defaultQuestions = [
  "Tell us about yourself.",
  "Why do you want this job?",
  "Describe a challenge you faced and how you handled it.",
];

export default function InterviewUI({ setupData, goBack }) {
  // Use custom questions from setupData if available, otherwise use defaults
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});

  const videoRef = useRef(null);
  const synthRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const audioRef = useRef(null);

  // Initialize questions from setupData when component mounts
  useEffect(() => {
    console.log("Setup data received:", setupData);

    // Check if we have customQuestions from AI in the setupData
    if (
      setupData?.customQuestions &&
      Array.isArray(setupData.customQuestions) &&
      setupData.customQuestions.length > 0
    ) {
      console.log("Using custom questions:", setupData.customQuestions);
      setQuestions(setupData.customQuestions);
    } else {
      console.log("Using default questions");
      setQuestions(defaultQuestions);
    }
  }, [setupData]);

  // S3 Client
  const s3Client = useMemo(
    () =>
      new S3({
        region: process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
        },
      }),
    []
  );

  // Media Recorder
  const {
    status: recorderStatus,
    startRecording,
    stopRecording,
    mediaBlobUrl,
    clearBlobUrl,
  } = useReactMediaRecorder({
    audio: true,
    video: false,
    onStart: () => setIsRecording(true),
    onStop: (blobUrl, blob) => {
      setIsRecording(false);
      if (blobUrl) {
        setRecordings((prev) => ({
          ...prev,
          [currentQuestion]: { blob, blobUrl },
        }));
        playAudio(blobUrl);
        uploadAudioToS3(currentQuestion, blob);
      }
    },
  });

  // Request microphone permissions
  const requestMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicrophoneEnabled(true);
      return true;
    } catch (error) {
      alert("Microphone access required for recording");
      return false;
    }
  };

  // Set up camera and fix ref issue
  const setupCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      } else {
        console.warn("Video reference not available yet, retrying...");
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        }, 500);
      }

      cameraStreamRef.current = stream;
      setCameraEnabled(true);
    } catch (error) {
      console.error("Camera access error:", error);
      setCameraError("Camera access denied. Please enable permissions.");
    }
  };

  // Upload to S3
  const uploadAudioToS3 = async (questionIndex, blob) => {
    if (!setupData?.s3Location?.folder) return;

    setUploadStatus((prev) => ({ ...prev, [questionIndex]: "uploading" }));

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: "kuchbhidaal",
          Key: `${setupData.s3Location.folder}/audio/Q${questionIndex}.webm`,
          Body: blob,
          ContentType: "audio/webm",
        })
      );
      setUploadStatus((prev) => ({ ...prev, [questionIndex]: "success" }));
    } catch (error) {
      setUploadStatus((prev) => ({ ...prev, [questionIndex]: "error" }));
    }
  };

  // Play recorded audio
  const playAudio = (url) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current
        .play()
        .catch((error) => console.error("Playback error:", error));
    }
  };

  // Effects
  useEffect(() => {
    setupCamera();
    requestMicrophone();
    synthRef.current = window.speechSynthesis;

    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      synthRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (synthRef.current && questions[currentQuestion]) {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(
        questions[currentQuestion]
      );
      synthRef.current.speak(utterance);
    }
  }, [currentQuestion, questions]);

  // Handlers
  const handleStartRecording = async () => {
    if (!microphoneEnabled && !(await requestMicrophone())) return;

    clearBlobUrl();
    setRecordings((prev) => ({ ...prev, [currentQuestion]: undefined }));
    startRecording();
  };

  const handleNextQuestion = () => {
    if (!isRecording)
      setCurrentQuestion((prev) => (prev + 1) % questions.length);
  };

  // Render a message when no questions are available yet
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center p-4 w-full max-w-5xl mx-auto">
        <button
          className="self-start mb-4 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
          onClick={goBack}
        >
          ← Back to Setup
        </button>
        <div className="flex items-center justify-center h-64 w-full">
          <div className="text-center p-6 bg-white shadow-lg rounded-lg">
            <div className="animate-spin mb-4 mx-auto h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <p>Loading interview questions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-4 w-full max-w-5xl mx-auto">
      <button
        className="self-start mb-4 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
        onClick={goBack}
      >
        ← Back to Setup
      </button>

      <div className="flex w-full justify-center gap-6 mt-4">
        <div className="w-1/2 aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg shadow-lg border">
          <img
            src="/ai_interviewer.gif"
            alt="AI Interviewer"
            className="object-contain w-full h-full"
          />
        </div>

        <div className="w-1/2 aspect-video bg-black rounded-lg shadow-lg border-2 border-gray-700">
          {cameraEnabled ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white p-4">
              <p className="text-center mb-3 text-gray-300">
                {cameraError || "Camera access needed"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 p-5 bg-white shadow-xl rounded-lg w-full text-center border">
        <h2 className="text-sm font-semibold text-indigo-600">
          Question {currentQuestion + 1} of {questions.length}
        </h2>
        <p className="text-xl mt-2 font-medium">{questions[currentQuestion]}</p>

        {/* Status indicator for recording and upload */}
        {recordings[currentQuestion] && (
          <div className="mt-2 text-sm">
            <span
              className={`inline-block px-2 py-1 rounded ${
                uploadStatus[currentQuestion] === "success"
                  ? "bg-green-100 text-green-800"
                  : uploadStatus[currentQuestion] === "error"
                  ? "bg-red-100 text-red-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {uploadStatus[currentQuestion] === "success"
                ? "✓ Response saved"
                : uploadStatus[currentQuestion] === "error"
                ? "✗ Upload failed"
                : "⟳ Saving response..."}
            </span>
          </div>
        )}

        <button
          className={`mt-3 text-sm ${
            currentQuestion < questions.length - 1
              ? "text-blue-600 hover:text-blue-800"
              : "text-green-600 hover:text-green-800"
          } transition`}
          onClick={handleNextQuestion}
          disabled={isRecording}
        >
          {currentQuestion < questions.length - 1
            ? "Next Question →"
            : "Finish Interview"}
        </button>
      </div>

      <div className="mt-6 p-5 bg-gray-50 shadow-md rounded-lg w-full flex flex-col items-center">
        {isRecording ? (
          <button
            className="bg-red-500 text-white px-5 py-2 rounded-lg shadow hover:bg-red-600 flex items-center gap-2"
            onClick={stopRecording}
          >
            <span className="h-3 w-3 bg-red-200 rounded-full animate-pulse"></span>
            Stop Recording
          </button>
        ) : (
          <button
            className="bg-green-500 text-white px-5 py-2 rounded-lg shadow hover:bg-green-600"
            onClick={handleStartRecording}
          >
            🎤 Start Recording
          </button>
        )}
      </div>

      {/* Hidden Audio Player for Playback */}
      <audio ref={audioRef} controls className="hidden" />
    </div>
  );
}
