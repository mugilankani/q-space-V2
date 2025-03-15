import { createContext, useContext, useState, useEffect } from "react";

const QuizSettingsContext = createContext();

export function QuizSettingsProvider({ children }) {
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [selectedTypes, setSelectedTypes] = useState({
    mcq: false,
    trueFalse: false,
  });
  const [mcqCount, setMcqCount] = useState(0);
  const [trueFalseCount, setTrueFalseCount] = useState(0);
  const [error, setError] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const totalAllocated =
      (selectedTypes.mcq ? mcqCount : 0) +
      (selectedTypes.trueFalse ? trueFalseCount : 0);
    const valid =
      !error &&
      (selectedTypes.mcq || selectedTypes.trueFalse) &&
      totalAllocated <= totalQuestions &&
      files.length > 0;
    setIsValid(valid);
  }, [totalQuestions, selectedTypes, mcqCount, trueFalseCount, error, files]);

  return (
    <QuizSettingsContext.Provider
      value={{
        totalQuestions,
        setTotalQuestions,
        selectedTypes,
        setSelectedTypes,
        mcqCount,
        setMcqCount,
        trueFalseCount,
        setTrueFalseCount,
        error,
        setError,
        isValid,
        files,
        setFiles,
      }}
    >
      {children}
    </QuizSettingsContext.Provider>
  );
}

export const useQuizSettings = () => useContext(QuizSettingsContext);
