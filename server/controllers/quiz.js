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
