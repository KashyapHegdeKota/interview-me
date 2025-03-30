// src/app/page.js
"use client";

import { useState } from "react";
import dynamic from "next/dynamic"; // Import dynamic

import InterviewSetupForm from "@/components/InterviewSetupForm";
// Remove the direct import of InterviewUI
// import InterviewUI from "@/components/InterviewUI";

// Dynamically import InterviewUI, disabling SSR for it
const InterviewUI = dynamic(() => import("@/components/InterviewUI"), {
  ssr: false, // <-- This prevents the component from rendering on the server
  // Optional: Add a loading state while the component is fetched on the client
  loading: () => (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center p-6 bg-white shadow-lg rounded-lg">
        <div className="animate-spin mb-4 mx-auto h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <p>Loading Interview Interface...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // Keep your loading state

  const handleStartInterview = (data) => {
    console.log("Interview setup data:", data);
    setSetupData(data);
    setInterviewStarted(true);
    setIsLoading(false); // Turn off general loading once setup is done
  };

  const handleGoBack = () => {
    setInterviewStarted(false);
    setSetupData(null);
  };

  const handleLoadingState = (loading) => {
    setIsLoading(loading);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      {/* Your loading overlay (optional, keep if you like it) */}
      {isLoading &&
        !interviewStarted && ( // Only show overlay during setup loading
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl text-center">
              <div className="animate-spin mb-4 mx-auto h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
              <p className="text-lg">Processing your interview setup...</p>
              <p className="text-sm text-gray-500 mt-2">
                Analyzing resume and preparing questions...
              </p>
            </div>
          </div>
        )}

      {!interviewStarted ? (
        <InterviewSetupForm
          onInterviewStart={handleStartInterview}
          onLoadingChange={handleLoadingState} // Pass the handler
        />
      ) : (
        // Render the dynamically imported component
        // It will automatically show the loading state defined above until ready
        <InterviewUI setupData={setupData} goBack={handleGoBack} />
      )}
    </main>
  );
}
