import { YoutubeTranscript } from "youtube-transcript";
import path from "path";

import { model, fileManager } from "../services/ai";

// utilities for helpers in this file
async function uploadToGemini(filePath, mimeType) {
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName: path.basename(filePath),
  });
  const file = uploadResult.file;
  console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
  return file;
}

function extractYouTubeVideoId(url) {
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// ai helpers
async function getGeminiCaption(tempImagePath, mimeType) {
  try {
    const file = await uploadToGemini(tempImagePath, mimeType);

    // Time the Gemini API call
    console.time("Gemini Image Analysis API Call");
    const response = await model.invoke([
      [
        "human",
        `This image is from a learning unit. Please analyze it and provide a detailed explanation of its overall context, including the content and concepts conveyed in the image. Image URI: ${file.uri}
          output:
          "explination: {content} with in 50 words"
          `,
      ],
    ]);
    console.timeEnd("Gemini Image Analysis API Call");

    // Extract just the text content from the response
    return response.content;
  } catch (err) {
    console.error("Error getting Gemini caption:", err);
    return "Unable to get description from Gemini.";
  }
}

async function getYouTubeCaptions(videoId, startTime = null, endTime = null) {
  try {
    // Time transcript fetching
    console.time("YouTube Transcript Fetch");
    const captions = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: "en",
    });
    console.timeEnd("YouTube Transcript Fetch");

    // If start time and end time are specified, filter the captions
    if (startTime !== null && endTime !== null) {
      // Convert start and end times from seconds to milliseconds
      const startMs = parseFloat(startTime) * 1000;
      const endMs = parseFloat(endTime) * 1000;

      // Filter captions that fall within the specified time range
      const filteredCaptions = captions.filter((caption) => {
        const captionStart = parseFloat(caption.offset) * 1000;
        const captionDuration = parseFloat(caption.duration) * 1000;
        const captionEnd = captionStart + captionDuration;

        // Include captions that overlap with the specified range
        return (
          (captionStart >= startMs && captionStart <= endMs) ||
          (captionEnd >= startMs && captionEnd <= endMs) ||
          (captionStart <= startMs && captionEnd >= endMs)
        );
      });

      // Convert the filtered captions array to a transcript string
      return filteredCaptions.map((caption) => caption.text).join(" ");
    }

    // If no time range specified, return the full transcript
    return captions.map((caption) => caption.text).join(" ");
  } catch (error) {
    console.error("Error fetching YouTube captions:", error);
    return null;
  }
}

async function getYouTubeSummary(youtubeUrl) {
  try {
    console.log("Generating summary for YouTube video:", youtubeUrl);

    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      return "Unable to extract video ID from the provided YouTube URL.";
    }

    const transcript = await getYouTubeCaptions(videoId);

    // Define the prompt based on whether we have a transcript
    let prompt;
    if (transcript) {
      prompt = `I have a transcript from a YouTube video (ID: ${videoId}). Please provide a detailed textbook content that converts it into professional content, not the conversational human speech.
      
      TRANSCRIPT:
      ${transcript.substring(
        0,
        25000,
      )} // Limit to 25K chars in case of very long videos
      
      Please give the paragraph of contents.
      
      Output:
      "TextBook Content: {content}"`;
    } else {
      prompt = `I have a YouTube video with ID: ${videoId} at URL: ${youtubeUrl}. Please provide a detailed textbook-style content description of the video. If you don't have access to the video's detailed content, please clearly state that and then offer a general, formal description of what the video might cover based on its URL and context.
      
      Output:
      "TextBook Content: {content}"`;
    }

    console.time("Gemini YouTube Summary API Call");
    const response = await model.invoke([["human", prompt]]);
    console.timeEnd("Gemini YouTube Summary API Call");

    return response.content;
  } catch (err) {
    console.error("Error getting YouTube summary:", err);
    return "Unable to get summary for this YouTube video.";
  }
}

export { getGeminiCaption, getYouTubeSummary };
