import prisma from "../prisma.js";
import fs from "fs/promises";
import path from "path";

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

    // Move files from temp to permanent location
    await Promise.all(
      req.files.map(async (file) => {
        const newPath = path.join(quizDir, path.basename(file.path));
        await fs.rename(file.path, newPath);
      }),
    );

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
      ...(process.env.NODE_ENV === "development" && { details: error.message }),
    });
  }
};
