import prisma from "../prisma.js";
import fs from "fs/promises";
import { model, fileManager } from "../services/ai.js";
import { YoutubeTranscript } from "youtube-transcript";

const axios = require("axios");
const { convertMarkdownToPlainText } = require("../utils/markdown.js");

import path from "path";
const tempDir = path.join(process.cwd(), "temp");

const ensureTempDir = async () => {
  try {
    await fs.mkdir(tempDir, { recursive: true });
  } catch (err) {
    console.error("Error creating temp directory:", err);
  }
};

/**
 * Uploads a local image file to Gemini and returns the uploaded file info.
 */
async function uploadToGemini(filePath, mimeType) {
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName: path.basename(filePath),
  });
  const file = uploadResult.file;
  console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
  return file;
}

/**
 * Given a temporary image file path and its mime type, uploads the image to Gemini
 * and then calls the model with a prompt that includes the file URI.
 */
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

/**
 * Extract the video ID from a YouTube URL
 */
function extractYouTubeVideoId(url) {
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

/**
 * Get captions for a YouTube video
 */
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
/**
 * Given a YouTube URL, extracts the video ID, fetches captions,
 * and asks Gemini to generate a summary based on the transcript.
 */
async function getYouTubeSummary(youtubeUrl) {
  try {
    console.log("Generating summary for YouTube video:", youtubeUrl);

    // Extract the video ID
    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      return "Unable to extract video ID from the provided YouTube URL.";
    }

    // Get captions/transcript
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

    // Time the Gemini API call
    console.time("Gemini YouTube Summary API Call");
    const response = await model.invoke([["human", prompt]]);
    console.timeEnd("Gemini YouTube Summary API Call");

    return response.content;
  } catch (err) {
    console.error("Error getting YouTube summary:", err);
    return "Unable to get summary for this YouTube video.";
  }
}

export const createQuiz = async (req, res) => {
  try {
    // Parse the config from form data
    const config = JSON.parse(req.body.config);

    // Extract user ID from the nested JWT payload
    const userId = req.user.userId;
    const { totalQuestions, types } = config;

    // Validation
    if (!req.files?.length || !totalQuestions || !userId) {
      return res.status(400).json({
        error:
          "Missing required fields: " +
          (!req.files?.length ? "files, " : "") +
          (!totalQuestions ? "totalQuestions, " : "") +
          (!userId ? "userId" : ""),
      });
    }

    // Add user existence check
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // Create quiz record
    const quiz = await prisma.quiz.create({
      data: {
        userId: String(userId),
        maxNos: parseInt(totalQuestions),
        status: "STARTING",
        config: {
          totalQuestions,
          types,
        },
      },
    });

    // Create permanent storage directory
    const quizDir = path.join(process.cwd(), "uploads/files", quiz.id);
    await fs.mkdir(quizDir, { recursive: true });
    await ensureTempDir(); // Ensure temp directory exists for image processing

    // Process files based on type
    const processedFiles = [];

    for (const file of req.files) {
      // Get file extension and determine if it's markdown by checking the extension
      const fileExt = path.extname(file.originalname).toLowerCase();
      const isMarkdown = fileExt === ".md";
      const newFilePath = path.join(quizDir, path.basename(file.path));

      if (isMarkdown) {
        console.log(`Processing markdown file: ${file.originalname}`);
        try {
          // Read the markdown content
          let mdContent = await fs.readFile(file.path, "utf8");

          // Process Images
          const imageRegex = /!\[.*?\]\((https?:\/\/.*?)\)/g;
          const imageMatches = [...mdContent.matchAll(imageRegex)];

          // Array to store details for each image
          let imagesArray = [];
          for (const match of imageMatches) {
            const fullMatch = match[0];
            const imageUrl = match[1];
            console.log("Found image URL:", imageUrl);
            try {
              const response = await axios.get(imageUrl, {
                responseType: "arraybuffer",
              });
              const imageData = response.data; // Buffer
              // Create a unique temporary file name in tempDir
              const filename = `${Date.now()}-${path.basename(
                new URL(imageUrl).pathname,
              )}`;
              const tempImagePath = path.join(tempDir, filename);
              await fs.writeFile(tempImagePath, imageData);
              console.log("Saved temporary image:", tempImagePath);
              // Determine mime type (simple heuristic)
              let mimeType = "image/jpeg";
              if (imageUrl.endsWith(".png")) mimeType = "image/png";
              else if (imageUrl.endsWith(".gif")) mimeType = "image/gif";
              imagesArray.push({
                markdown: fullMatch,
                imageUrl,
                tempImagePath,
                mimeType,
              });
            } catch (err) {
              console.error("Error downloading image:", imageUrl, err);
            }
          }

          // Process Images with timing
          for (const img of imagesArray) {
            console.time(`Image Processing: ${img.imageUrl}`);
            const caption = await getGeminiCaption(
              img.tempImagePath,
              img.mimeType,
            );
            console.timeEnd(`Image Processing: ${img.imageUrl}`);
            console.log("Gemini caption:", caption);
            mdContent = mdContent.replace(
              img.markdown,
              `image to text: ${caption}`,
            );
            try {
              await fs.unlink(img.tempImagePath);
            } catch (err) {
              console.error(
                "Error deleting temporary image file:",
                img.tempImagePath,
                err,
              );
            }
          }

          // Process YouTube Links (standard links)
          const youtubeRegex =
            /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
          const youtubeMatches = [...mdContent.matchAll(youtubeRegex)];

          // Process each YouTube link with timing
          for (const match of youtubeMatches) {
            console.time(`YouTube Processing: ${match[0]}`);
            const fullMatch = match[0];
            console.log("Found YouTube URL:", fullMatch);

            // Get summary for the YouTube video
            const summary = await getYouTubeSummary(fullMatch);
            console.log("YouTube TextBook:", summary);

            // Replace the YouTube link with the summary
            mdContent = mdContent.replace(
              fullMatch,
              `Video TextBook: ${summary}`,
            );
            console.timeEnd(`YouTube Processing: ${match[0]}`);
          }

          // Process custom YouTube components
          const customYoutubeRegex =
            /<Youtube\s+videoId=['"]([^'"]+)['"](?:\s+start=['"]([^'"]+)['"])?(?:\s+end=['"]([^'"]+)['"])?.*?\/>/g;
          const customYoutubeMatches = [
            ...mdContent.matchAll(customYoutubeRegex),
          ];

          // Process each custom YouTube component with timing
          for (const match of customYoutubeMatches) {
            console.time(`Custom YouTube Processing: ${match[1]}`);
            const fullMatch = match[0];
            const videoId = match[1]; // This captures the videoId value
            const startTime = match[2] || null; // Start time or null if not specified
            const endTime = match[3] || null; // End time or null if not specified

            console.log(
              `Found Custom YouTube Component, videoId: ${videoId}, start: ${startTime}, end: ${endTime}`,
            );

            // Construct a standard YouTube URL to use with your existing function
            const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

            // Get transcript with time restrictions
            const transcript = await getYouTubeCaptions(
              videoId,
              startTime,
              endTime,
            );

            // Define the prompt based on whether we have a transcript
            let prompt;
            if (transcript) {
              prompt = `I have a partial transcript from a YouTube video (ID: ${videoId}). Please provide a detailed textbook-style of the content.
              
            TRANSCRIPT:
            ${transcript.substring(
              0,
              25000,
            )} // Limit to 25K chars in case of very long videos
              
            Please Text Book the key points, main ideas, and important details from this video segment in formal, textbook-like language. Make the comprehensive but concise.
            
            Output:
            "TextBook Content: {content} "`;
            } else {
              prompt = `Please provide a summary of the YouTube video segment with ID: ${videoId} at URL: ${youtubeUrl} from timestamp ${
                startTime || "start"
              } to ${endTime || "end"}.
              Focus on the main topics, key points, and overall content of this video segment.
              If you don't have access to the video's content, please state that and provide a general description of what the video might be about based on its URL.
              
              output:
              "TextBook Content: {content} "`;
            }

            // Time the Gemini API call
            console.time("Gemini Custom YouTube API Call");
            const response = await model.invoke([["human", prompt]]);
            console.timeEnd("Gemini Custom YouTube API Call");

            // Replace the YouTube component with the summary
            mdContent = mdContent.replace(
              fullMatch,
              `Video summary (${startTime || "start"} to ${endTime || "end"}): ${
                response.content
              }`,
            );
            console.timeEnd(`Custom YouTube Processing: ${videoId}`);
          }

          // Convert markdown to plain text
          const plainTextContent = convertMarkdownToPlainText(mdContent);

          // Save the processed content to the quiz directory
          const processedFilePath = path.join(
            quizDir,
            `${path.basename(file.path, fileExt)}.txt`,
          );
          await fs.writeFile(processedFilePath, plainTextContent);

          // Add to processed files
          processedFiles.push({
            originalPath: file.path,
            processedPath: processedFilePath,
            isMarkdown: true,
            plainText: plainTextContent,
          });
        } catch (err) {
          console.error(
            `Error processing markdown file ${file.originalname}:`,
            err,
          );
          // If processing fails, just move the original file
          await fs.rename(file.path, newFilePath);
          processedFiles.push({
            originalPath: file.path,
            processedPath: newFilePath,
            isMarkdown: true,
            error: err.message,
          });
        }
      } else {
        // For non-markdown files, just move them to the quiz directory
        console.log(`Moving non-markdown file: ${file.originalname}`);
        await fs.rename(file.path, newFilePath);

        // Check if it's a text file by extension
        const textFileExtensions = [".txt"];
        const isTextFile = textFileExtensions.includes(fileExt);

        if (isTextFile) {
          try {
            const textContent = await fs.readFile(file.path, "utf8");
            console.log(
              `Text content of ${file.originalname}:`,
              textContent.substring(0, 200) + "...",
            );
            processedFiles.push({
              originalPath: file.path,
              processedPath: newFilePath,
              isMarkdown: false,
              contentPreview: textContent.substring(0, 200) + "...",
            });
          } catch (err) {
            console.error(`Error reading text file ${file.originalname}:`, err);
            processedFiles.push({
              originalPath: file.path,
              processedPath: newFilePath,
              isMarkdown: false,
              error: err.message,
            });
          }
        } else {
          processedFiles.push({
            originalPath: file.path,
            processedPath: newFilePath,
            isMarkdown: false,
            fileExtension: fileExt,
          });
        }
      }
    }

    return res.status(201).json({
      success: true,
      quizId: quiz.id,
      config: quiz.config,
    });
  } catch (error) {
    console.error("Quiz creation error:", error);

    // Cleanup uploaded files on error
    if (req.files) {
      await Promise.all(
        req.files.map(async (file) => {
          try {
            await fs.unlink(file.path);
          } catch (err) {
            console.error("Error cleaning up file:", err);
          }
        }),
      );
    }

    return res.status(500).json({
      success: false,
      error: "Failed to create quiz",
      ...(process.env.NODE_ENV === "development" && {
        details: error.message,
      }),
    });
  }
};

export const getQuiz = async (req, res) => {
  try {
    const quizId = req.params.id;

    // First, make sure the quiz exists
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: "Quiz does not exist",
      });
    }

    // Group quizQuestions by questionId to get the max version per question
    const groups = await prisma.quizQuestion.groupBy({
      by: ["questionId"],
      where: { quizId },
      _max: { version: true },
    });

    // Build conditions to fetch only the quizQuestion record with max version for each question
    const conditions = groups.map((g) => ({
      questionId: g.questionId,
      version: g._max.version,
    }));

    // Get only those quizQuestions that match these conditions
    const latestQuizQuestions = await prisma.quizQuestion.findMany({
      where: {
        quizId,
        OR: conditions,
      },
      include: { question: true },
      orderBy: { createdAt: "asc" },
    });

    // Return quiz details along with only the latest quiz questions
    return res.status(200).json({
      success: true,
      quiz: { ...quiz, quizQuestions: latestQuizQuestions },
    });
  } catch (error) {
    console.error("Error fetching quiz:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch quiz",
      ...(process.env.NODE_ENV === "development" && {
        details: error.message,
      }),
    });
  }
};
