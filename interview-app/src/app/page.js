// src/app/page.js
"use client";

import { useState } from "react";
import InterviewSetupForm from "@/components/InterviewSetupForm";
import InterviewUI from "@/components/InterviewUI";

export default function Home() {
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartInterview = (data) => {
    // If we have resume processing data, show it
    console.log("Interview setup data:", data);
    setSetupData(data);
    setInterviewStarted(true);
    setIsLoading(false);
  };

  const handleGoBack = () => {
    setInterviewStarted(false);
    setSetupData(null);
  };

  // Set loading state for child components
  const handleLoadingState = (isLoading) => {
    setIsLoading(isLoading);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      {!interviewStarted ? (
        <InterviewSetupForm
          onInterviewStart={handleStartInterview}
          onLoadingChange={handleLoadingState}
        />
      ) : (
        <InterviewUI setupData={setupData} goBack={handleGoBack} />
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <p className="text-lg">Processing your interview setup...</p>
            <p className="text-sm text-gray-500 mt-2">
              This may take a moment as we analyze your resume and prepare
              custom interview questions.
            </p>
            <div className="mt-4 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="bg-indigo-600 h-full animate-pulse"></div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
