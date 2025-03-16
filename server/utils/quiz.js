import { model } from "../services/ai";
import prisma from "../prisma";

const BATCH_SIZE = 5;

export async function generateAndStoreQuestions(
	quizId,
	fullcontext,
	questionConfig
) {
	const { totalQuestions, types } = questionConfig;

	const totalToGenerate = types.mcq + types.trueFalse;
	const batches = Math.ceil(totalToGenerate / BATCH_SIZE);
	let allQuestions = [];
	let questionCounts = { mcq: 0, trueFalse: 0 };

	for (let i = 0; i < batches; i++) {
		const questionsToGenerate = Math.min(
			BATCH_SIZE,
			totalToGenerate - allQuestions.length
		);

		// Calculate remaining questions for each type
		const remainingMCQ = types.mcq - questionCounts.mcq;
		const remainingTF = types.trueFalse - questionCounts.trueFalse;

		const prompt = `Generate ${questionsToGenerate} quiz questions from the following educational content.
Ensure that questions cover different types: multiple-choice (${Math.min(questionsToGenerate, remainingMCQ)}), true/false (${Math.min(questionsToGenerate, remainingTF)}) 
and align with Bloom's Taxonomy.

Each question must:
- Be 100% original and unambiguous
- Test critical thinking skills appropriate for the level
- Cover key concepts without being overly simplistic
- Be challenging but fair for students
- Avoid trick questions or ambiguous wording
- Be grammatically correct and clearly written

**Question Structure:**
- Multiple-choice questions (MCQs) should have 4 answer options (A, B, C, D)
- True/False questions should have "True" and "False" as answer choices
- Only one option should be the correct answer
- Indicate the correct answer using an index (0=A, 1=B, 2=C, 3=D for MCQs, 0=True, 1=False for True/False)
- Include the type of question (e.g., factual, conceptual, analytical, trueFalse)

### Content:
${fullcontext} // Limiting input size for efficiency

### Output Format (Valid JSON Array):
[
  {
    "question": "What is X?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctOption": 0,
    "questionType": "MULTIPLE_CHOICE",
  },
  {
    "question": "Is Y true?",
    "options": ["True", "False"],
    "correctOption": 0,
    "questionType": "TRUE_FALSE",
  }
]
`;
		try {
			const response = await model.invoke([["human", prompt]]);
			console.log(response);

			// Ensure the response content is valid JSON
			let generatedQuestions;
			try {
				const jsonString = response.content.trim();
				if (
					jsonString.startsWith("```json") &&
					jsonString.endsWith("```")
				) {
					generatedQuestions = JSON.parse(jsonString.slice(7, -3));
				} else {
					generatedQuestions = JSON.parse(jsonString);
				}
			} catch (parseError) {
				console.error("Error parsing JSON response:", parseError);
				continue; // Skip this batch and continue with the next one
			}

			if (Array.isArray(generatedQuestions)) {
				// Track question counts by type
				generatedQuestions.forEach((q) => {
					if (q.questionType === "MULTIPLE_CHOICE") {
						questionCounts.mcq++;
					} else if (q.questionType === "TRUE_FALSE") {
						questionCounts.trueFalse++;
					}
				});
				allQuestions.push(...generatedQuestions);

				// Save questions in batches
				await prisma.quizQuestion.createMany({
					data: generatedQuestions.map((q) => ({
						quizId,
						question: q.question,
						options: q.options,
						correctOption: q.correctOption,
						questionType: q.questionType,
					})),
				});
			}
		} catch (error) {
			console.error("Error generating questions:", error);
		}
	}

	console.log(questionCounts);

	// Update quiz status to completed
	await prisma.quiz.update({
		where: { id: quizId },
		data: {
			status: "COMPLETED",
			currentNos: questionCounts.mcq + questionCounts.trueFalse,
		},
	});

	console.log(
		`Quiz ${quizId} completed with ${allQuestions.length} questions (MCQ: ${questionCounts.mcq}, True/False: ${questionCounts.trueFalse}).`
	);
}
