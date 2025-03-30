// src/app/api/process-resume/route.js
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Google AI
const API_KEY = "AIzaSyA6dqvFYb2MRYAxB3MmVC7KyTqLEQeY1KU"; // Using the key from your original code
const genAI = new GoogleGenerativeAI(API_KEY);

export async function POST(request) {
  try {
    const { jobDescription } = await request.json();

    // Generate interview questions with Google Generative AI
    const questions = await generateQuestionsWithAI(jobDescription);

    return NextResponse.json({
      statusCode: 200,
      body: {
        interview_questions: questions,
      },
    });
  } catch (error) {
    console.error("API error:", error);
    // Return default questions even if there's an error
    return NextResponse.json({
      statusCode: 200,
      body: {
        interview_questions: generateDefaultQuestions(),
        error: error.message,
      },
    });
  }
}

async function generateQuestionsWithAI(jobDescription) {
  try {
    // Initialize the model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Create the prompt
    const prompt = `Based on the following job description, generate 5 relevant interview questions that will help assess a candidate's fit for the role. Format the response as an array of questions.

Job Description:
${jobDescription}

Please generate 5 interview questions specifically tailored to this role. Return ONLY the array of 5 questions without any additional text.`;

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Try to extract an array from the response
    try {
      // First, try to parse JSON directly if it looks like JSON
      if (text.includes("[") && text.includes("]")) {
        const match = text.match(/\[([\s\S]*?)\]/);
        if (match) {
          // Try to parse as proper JSON array
          try {
            return JSON.parse(`[${match[1]}]`);
          } catch (e) {
            // If parsing fails, split by newlines or quoted strings
            return match[1]
              .split(/\n|","|','/g)
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
              .map((line) => line.replace(/^["'\s]+|["'\s]+$/g, ""));
          }
        }
      }

      // If not in JSON format, split by numbered items or newlines
      return text
        .split(/\d+\.\s|\n+/g)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 5);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      // Fallback to splitting by newlines
      return text
        .split("\n")
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.length > 0 &&
            !line.startsWith("Here are") &&
            !line.includes("questions")
        )
        .slice(0, 5);
    }
  } catch (aiError) {
    console.error("AI generation error:", aiError);
    return generateDefaultQuestions();
  }
}

function generateDefaultQuestions() {
  return [
    "Tell me about your background and experience.",
    "Why are you interested in this position?",
    "Describe a challenging situation you faced at work and how you handled it.",
    "What are your greatest professional strengths?",
    "Do you have any questions about the role or company?",
  ];
}
