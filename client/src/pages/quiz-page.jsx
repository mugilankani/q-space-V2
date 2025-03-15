import { useState, useEffect } from "react";
import { useParams } from "react-router";
import Navbar from "../components/navbar";
import axiosInstance from "../axiosInstance";

export default function QuizPage() {
  const { id } = useParams();

  const [mode, setMode] = useState("Workout"); // "Workout" or "Prepare"
  const [visibleQuestions, setVisibleQuestions] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const response = await axiosInstance.get(`/quiz/${id}`);
        const quiz = response.data.quiz;

        // Extract questions from quiz data
        const questions = quiz.quizQuestions.map((qq) => ({
          ...qq.question,
          id: qq.questionId,
        }));

        // Show first question immediately
        setVisibleQuestions([questions[0]]);

        // Show remaining questions gradually
        let index = 0;
        const interval = setInterval(() => {
          index++;
          if (index < questions.length) {
            setVisibleQuestions((prev) => [...prev, questions[index]]);
          } else {
            clearInterval(interval);
          }
        }, 2000);

        setLoading(false);
        return () => clearInterval(interval);
      } catch (error) {
        console.error("Error fetching quiz:", error);
        setError(error.response?.data?.error || "Failed to load quiz");
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [id]);

  const handleAnswerClick = (qIdx, optionIdx) => {
    if (mode !== "Workout") return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optionIdx }));
  };

  const getOptionClass = (q, qIdx, optionIdx) => {
    const base = "border rounded-md px-4 py-2 text-sm cursor-pointer";
    if (mode === "Prepare") {
      return q.correctOption === optionIdx
        ? `${base} border border-blue-400 bg-blue-50`
        : `${base} border-gray-300`;
    }
    if (selectedAnswers[qIdx] !== undefined) {
      if (selectedAnswers[qIdx] === optionIdx) {
        return q.correctOption === optionIdx
          ? `${base} border border-green-400 bg-green-50`
          : `${base} border border-red-400 bg-red-50`;
      } else if (q.correctOption === optionIdx) {
        return `${base} border border-green-400 bg-green-50`;
      }
    }
    return `${base} border-gray-300`;
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-96px)]">
          <div className="text-sm text-gray-500">Loading quiz...</div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-96px)]">
          <div className="text-sm text-red-500">{error}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="flex flex-col items-center min-h-[calc(100vh-64px)] gap-6">
        <div className="max-w-xl w-full items-center mt-16 flex">
          <span className="font-medium text-xs ml-auto">Mode</span>
          <div className="flex ml-3 items-center text-xs">
            <button
              onClick={() => setMode("Workout")}
              className={`px-4 pr-3 py-1 rounded-l-full ${mode === "Workout" ? "bg-blue-500 border border-blue-500 text-white" : "bg-white border border-r-0 border-gray-300"}`}
            >
              Workout
            </button>
            <button
              onClick={() => setMode("Prepare")}
              className={`px-4 pl-3 py-1 rounded-r-full ${mode === "Prepare" ? "bg-blue-500 border border-blue-500 text-white" : "bg-white border border-l-0 border-gray-300"}`}
            >
              Prepare
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-6 w-full mt-4 max-w-xl">
          {visibleQuestions.map((q, qIdx) => (
            <div key={q.id}>
              <div className="flex flex-col gap-4">
                <p className="font-medium text-xl">{q.question}</p>
                <div className="grid grid-cols-2 gap-3">
                  {q.options.map((option, i) => (
                    <div
                      className={getOptionClass(q, qIdx, i)}
                      key={i}
                      onClick={() => handleAnswerClick(qIdx, i)}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              </div>
              <hr className="border-gray-200 border-2 last:mb-12 last:border-none mt-6" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
