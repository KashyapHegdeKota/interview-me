"use client";
import { useState } from "react";
import InterviewSetupForm from "./InterviewSetupForm";
import InterviewUI from "./InterviewUI";

export default function InterviewManager() {
  const [interviewState, setInterviewState] = useState("setup"); // "setup" or "interview"
  const [setupData, setSetupData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleInterviewStart = (formData) => {
    console.log("Starting interview with data:", formData);
    setSetupData(formData);
    setInterviewState("interview");
  };

  const handleGoBack = () => {
    setInterviewState("setup");
    setSetupData(null);
  };

  const handleLoadingChange = (loading) => {
    setIsLoading(loading);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <div className="flex items-center space-x-4">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
              <p className="text-lg">
                Processing your resume and generating questions...
              </p>
            </div>
          </div>
        </div>
      )}

      {interviewState === "setup" && (
        <InterviewSetupForm
          onInterviewStart={handleInterviewStart}
          onLoadingChange={handleLoadingChange}
        />
      )}

      {interviewState === "interview" && setupData && (
        <InterviewUI setupData={setupData} goBack={handleGoBack} />
      )}
    </div>
  );
}
