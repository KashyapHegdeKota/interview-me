"use client";

import React, { useState } from "react";
import { S3, PutObjectCommand } from "@aws-sdk/client-s3";

export default function InterviewSetupForm({
  onInterviewStart,
  onLoadingChange = () => {},
}) {
  // State for the form fields
  const [jobDescription, setJobDescription] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [isBehavioral, setIsBehavioral] = useState(false);
  const [isTechnical, setIsTechnical] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [fileName, setFileName] = useState("No file chosen");
  const [isUploading, setIsUploading] = useState(false);

  // handleFileChange
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setResumeFile(file);
      setFileName(file.name);
    } else {
      setResumeFile(null);
      setFileName("No file chosen");
    }
  };

  // Process resume via API route instead of direct Lambda invocation
  const processResumeViaAPI = async (bucket, key, jobDesc) => {
    try {
      const response = await fetch("/api/process-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bucket,
          key,
          jobDescription: jobDesc,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Resume processing error:", error);
      throw error;
    }
  };

  // Improved function to extract questions from API response
  const extractQuestionsFromResponse = (apiResponse) => {
    if (
      !apiResponse ||
      !apiResponse.body ||
      !apiResponse.body.interview_questions
    ) {
      return [];
    }

    let questionsData = apiResponse.body.interview_questions;

    // Case 1: If it's already an array
    if (Array.isArray(questionsData)) {
      console.log("Questions already in array format:", questionsData);
      return questionsData;
    }

    // Case 2: If it's a string that might contain JSON
    if (typeof questionsData === "string") {
      // Try parsing as JSON first
      try {
        const parsed = JSON.parse(questionsData);
        if (Array.isArray(parsed)) {
          console.log("Parsed questions from JSON string:", parsed);
          return parsed;
        }
      } catch (e) {
        // Not valid JSON, continue with other extraction methods
        console.log("Not valid JSON, trying other methods");
      }

      // Try extracting array content using regex
      if (questionsData.includes("[") && questionsData.includes("]")) {
        try {
          // Find content between brackets
          const arrayMatch = questionsData.match(/\[(.*)\]/s);
          if (arrayMatch && arrayMatch[1]) {
            // Parse the array content
            const items = arrayMatch[1]
              .split('"')
              .filter((_, i) => i % 2 === 1) // Get quoted strings
              .map((item) => item.trim());

            if (items.length > 0) {
              console.log("Extracted questions using regex:", items);
              return items;
            }
          }
        } catch (e) {
          console.error("Regex extraction failed:", e);
        }
      }

      // If all else fails, split by newlines or commas
      const lines = questionsData
        .split(/[\n,]/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length > 0) {
        console.log("Split questions by newlines/commas:", lines);
        return lines;
      }
    }

    // Fallback to default
    console.log("Could not extract questions, returning empty array");
    return [];
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Show loading state
    setIsUploading(true);
    onLoadingChange(true);

    // Create unique folder for this interview session
    const folderName = `interview-${Date.now()}`;

    const formData = {
      jobDescription,
      company,
      position,
      interviewType: {
        behavioral: isBehavioral,
        technical: isTechnical,
      },
      resumeFileName: "None",
    };

    const s3client = new S3({
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
      },
    });

    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET;

    try {
      // 1. Upload form data as JSON
      const formDataKey = `${folderName}/setup.json`;
      await s3client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: formDataKey,
          Body: JSON.stringify(formData, null, 2),
          ContentType: "application/json",
        })
      );

      // 2. Upload resume file if present
      let resumeKey = "None";
      let customQuestions = [];

      if (resumeFile) {
        resumeKey = `${folderName}/${resumeFile.name}`;
        const fileContent = await resumeFile.arrayBuffer();

        await s3client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: resumeKey,
            Body: fileContent,
            ContentType: resumeFile.type,
          })
        );

        // 3. Process the resume with API route instead of direct Lambda
        try {
          console.log("Processing resume via API...");

          const apiResponse = await processResumeViaAPI(
            bucket,
            resumeKey,
            jobDescription
          );

          console.log("API response:", apiResponse);

          if (apiResponse.statusCode === 200) {
            customQuestions = extractQuestionsFromResponse(apiResponse);
          }
        } catch (apiError) {
          console.error("API processing error:", apiError);
          // Continue with default questions if API fails
        }
      }

      // Update form data with S3 references and custom questions
      formData.s3Location = {
        folder: folderName,
        formData: formDataKey,
        resume: resumeKey,
      };

      // Add the questions to the form data
      formData.customQuestions =
        customQuestions.length > 0 ? customQuestions : null;

      console.log("Final form data with custom questions:", formData);

      // Hide loading state
      setIsUploading(false);
      onLoadingChange(false);

      // Trigger next step with complete data
      onInterviewStart(formData);
    } catch (error) {
      setIsUploading(false);
      onLoadingChange(false);
      console.error("Upload failed:", error);
      alert("Error uploading files to S3. Please try again.");
    }
  };

  // --- Render the form
  return (
    <div className="max-w-2xl mx-auto my-12 p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-2xl border border-indigo-100">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2 bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
          Interview Setup
        </h2>
        <p className="text-gray-500 mt-2">
          Let&apos;s prepare your perfect interview
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Job Description */}
        <div className="relative group">
          <label
            htmlFor="jobDescription"
            className="block text-sm font-medium text-gray-600 mb-2 ml-1"
          >
            Job Description
          </label>
          <textarea
            id="jobDescription"
            name="jobDescription"
            rows="4"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className="w-full px-4 py-3 border-2 border-indigo-100 rounded-xl shadow-sm focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all duration-200 bg-white text-gray-700 placeholder-gray-400"
            placeholder="Paste the job description here..."
            required
          />
          <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 opacity-20 group-hover:opacity-30 transition-opacity duration-300 -z-10" />
        </div>

        {/* Company & Position */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative group">
            <label
              htmlFor="company"
              className="block text-sm font-medium text-gray-600 mb-2 ml-1"
            >
              Company
            </label>
            <input
              type="text"
              id="company"
              name="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-4 py-3 border-2 border-indigo-100 rounded-xl shadow-sm focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all duration-200 bg-white text-gray-700 placeholder-gray-400"
              placeholder="Google, Microsoft, etc."
              required
            />
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 opacity-20 group-hover:opacity-30 transition-opacity duration-300 -z-10" />
          </div>

          <div className="relative group">
            <label
              htmlFor="position"
              className="block text-sm font-medium text-gray-600 mb-2 ml-1"
            >
              Position
            </label>
            <input
              type="text"
              id="position"
              name="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-4 py-3 border-2 border-indigo-100 rounded-xl shadow-sm focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all duration-200 bg-white text-gray-700 placeholder-gray-400"
              placeholder="Software Engineer, etc."
              required
            />
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 opacity-20 group-hover:opacity-30 transition-opacity duration-300 -z-10" />
          </div>
        </div>

        {/* Interview Type */}
        <fieldset className="space-y-4">
          <legend className="block text-sm font-medium text-gray-600 mb-2 ml-1">
            Interview Type
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label
              className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                isBehavioral
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-gray-200 hover:border-indigo-100"
              }`}
            >
              <input
                type="checkbox"
                checked={isBehavioral}
                onChange={(e) => setIsBehavioral(e.target.checked)}
                className="h-5 w-5 text-indigo-600 border-2 border-gray-300 rounded-md focus:ring-indigo-500"
              />
              <span className="ml-3 block text-sm font-medium text-gray-700">
                Behavioral Interview
                <span className="block text-xs text-gray-500 mt-1">
                  Communication &amp; soft skills
                </span>
              </span>
            </label>

            <label
              className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                isTechnical
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-gray-200 hover:border-indigo-100"
              }`}
            >
              <input
                type="checkbox"
                checked={isTechnical}
                onChange={(e) => setIsTechnical(e.target.checked)}
                className="h-5 w-5 text-indigo-600 border-2 border-gray-300 rounded-md focus:ring-indigo-500"
              />
              <span className="ml-3 block text-sm font-medium text-gray-700">
                Technical Interview
                <span className="block text-xs text-gray-500 mt-1">
                  Coding &amp; problem solving
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {/* Resume Upload */}
        <div className="relative group">
          <label className="block text-sm font-medium text-gray-600 mb-2 ml-1">
            Upload Resume (Optional)
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-indigo-100 rounded-xl hover:border-indigo-200 transition-colors duration-200 bg-white">
            <div className="space-y-1 text-center">
              <svg
                className="mx-auto h-12 w-12 text-indigo-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex flex-col items-center text-sm text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                >
                  <span>Upload a file</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx"
                  />
                </label>
                <p className="pl-1 mt-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {fileName}{" "}
                {resumeFile && `(${(resumeFile.size / 1024).toFixed(1)}KB)`}
              </p>
            </div>
          </div>
          <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 opacity-20 group-hover:opacity-30 transition-opacity duration-300 -z-10" />
        </div>

        {/* Start Interview Button */}
        <div className="mt-10">
          <button
            type="submit"
            disabled={isUploading}
            className={`w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              isUploading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {isUploading ? (
              <>
                <span className="inline-block animate-spin mr-2">⏳</span>{" "}
                Processing...
              </>
            ) : (
              <>🚀 Start Interview</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
