import prisma from "../prisma.js";

/**
 * Adds a question to a quiz.
 *
 * If quizDetails contains an id, it assumes the quiz exists.
 * If questionBaseId is provided, a new version of an existing question is created.
 * Otherwise, a new question is created with version 1.
 *
 * @param {Object} quizDetails - Quiz details (if no id, a new quiz is created)
 * @param {Object} questionData - The question details { question, options, correctOption }
 * @param {string} [questionBaseId] - Optional base id for versioning an existing question
 * @returns {Object} - Object containing the quiz and the newly added/updated question
 */

async function addQuiz(quizDetails, questionData, questionBaseId) {
  // Create a new quiz if no id is provided; otherwise, retrieve the existing quiz.
  let quiz;
  if (quizDetails.id) {
    quiz = await prisma.quiz.findUnique({ where: { id: quizDetails.id } });
    if (!quiz) {
      throw new Error(`Quiz with id ${quizDetails.id} not found.`);
    }
  } else {
    quiz = await prisma.quiz.create({ data: quizDetails });
  }

  let question;
  if (questionBaseId) {
    // Retrieve the latest version of the question with the given base id.
    const existing = await prisma.question.findFirst({
      where: { baseId: questionBaseId },
      orderBy: { version: "desc" },
    });
    if (!existing) {
      throw new Error(`No question found with baseId ${questionBaseId}.`);
    }
    const newVersion = existing.version + 1;
    question = await prisma.question.create({
      data: {
        baseId: questionBaseId,
        version: newVersion,
        question: questionData.question,
        options: questionData.options,
        correctOption: questionData.correctOption,
      },
    });
  } else {
    // Create a new question and set its baseId to its own id.
    question = await prisma.question.create({
      data: {
        version: 1,
        question: questionData.question,
        options: questionData.options,
        correctOption: questionData.correctOption,
      },
    });
    await prisma.question.update({
      where: { id: question.id },
      data: { baseId: question.id },
    });
  }

  // Link the question with the quiz.
  await prisma.quizQuestion.create({
    data: {
      quizId: quiz.id,
      questionId: question.id,
      version: question.version,
    },
  });

  return { quiz, question };
}

async function boilerPlate() {
  const newQuizDetails = {
    userId: "user123",
    maxNos: 5,
    currentNos: 1,
    status: "active",
  };

  const newQuestionData = {
    question: "What is 2+2?",
    options: ["3", "4", "5", "6"],
    correctOption: 1,
  };

  const result1 = await addQuiz(newQuizDetails, newQuestionData);
  console.log("New quiz and question created:", result1);

  // Scenario 2: Add an updated version (v2) of an existing question
  // to the existing quiz using the baseId from the previous question.
  const updatedQuestionData = {
    question: "What is 2+2? (Updated)",
    options: ["3", "4", "5", "6"],
    correctOption: 1,
  };

  const result2 = await addQuiz(
    { id: result1.quiz.id }, // Existing quiz id is passed.
    updatedQuestionData,
    result1.question.baseId, // Existing question base id is passed.
  );

  console.log("Updated question added to existing quiz:", result2);
}
