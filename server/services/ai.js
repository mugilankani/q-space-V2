import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("GOOGLE_API_KEY not set in environment");
}

export const model = new ChatGoogleGenerativeAI({
  apiKey: GEMINI_API_KEY,
  model: "gemini-2.0-flash",
  maxOutputTokens: 1000000,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
  ],
});

export const fileManager = new GoogleAIFileManager(GEMINI_API_KEY);
