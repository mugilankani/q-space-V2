import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import clsx from "clsx";
import { useNavigate } from "react-router";

import Navbar from "../components/navbar";
import QuestionSettings from "../components/question-settings";

import { useAuth } from "../context/AuthContext";
import {
  QuizSettingsProvider,
  useQuizSettings,
} from "../context/QuizSettingsContext";

import axiosInstance from "../axiosInstance";
import { redirect } from "react-router";

export default function New() {
  return (
    <QuizSettingsProvider>
      <NewContent />
    </QuizSettingsProvider>
  );
}

export function NewContent() {
  const { user } = useAuth();

  const {
    files,
    setFiles,
    isValid,
    totalQuestions,
    selectedTypes,
    mcqCount,
    trueFalseCount,
  } = useQuizSettings();

  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const fileInputRef = useRef(null);

  const MAX_TOTAL_SIZE = 500 * 1024; // 500KB in bytes

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      const currentTotal = files.reduce((sum, file) => sum + file.size, 0);
      const remainingSize = MAX_TOTAL_SIZE - currentTotal;
      const remainingSlots = 5 - files.length;

      const validFiles = Array.from(e.dataTransfer.files).filter((file) => {
        const fileName = file.name.toLowerCase();
        return fileName.endsWith(".txt") || fileName.endsWith(".md");
      });

      let accumulatedSize = 0;
      const newFiles = [];

      for (const file of validFiles) {
        if (newFiles.length >= remainingSlots) break;
        if (accumulatedSize + file.size > remainingSize) break;

        newFiles.push({
          file: new File([file], file.name, { type: file.type }),
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
        });

        accumulatedSize += file.size;
      }

      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const currentTotal = files.reduce((sum, file) => sum + file.size, 0);
      const remainingSize = MAX_TOTAL_SIZE - currentTotal;
      const remainingSlots = 5 - files.length;

      const validFiles = Array.from(e.target.files).filter((file) => {
        const fileName = file.name.toLowerCase();
        return fileName.endsWith(".txt") || fileName.endsWith(".md");
      });

      let accumulatedSize = 0;
      const newFiles = [];

      for (const file of validFiles) {
        if (newFiles.length >= remainingSlots) break;
        if (accumulatedSize + file.size > remainingSize) break;

        newFiles.push({
          file: new File([file], file.name, { type: file.type }),
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
        });

        accumulatedSize += file.size;
      }

      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id) => {
    setFiles(files.filter((file) => file.id !== id));
  };

  const formatFileSize = (bytes) => {
    if (typeof bytes !== "number" || isNaN(bytes)) return "0 bytes";
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleGenerateQuiz = async () => {
    if (isLoading) return;
    setIsLoading(true);

    const formData = new FormData();

    files.forEach((fileObj) => {
      formData.append("files", fileObj.file, fileObj.name);
    });

    const questionConfig = {
      totalQuestions,
      types: {
        mcq: selectedTypes.mcq ? mcqCount : 0,
        trueFalse: selectedTypes.trueFalse ? trueFalseCount : 0,
      },
    };

    formData.append("config", JSON.stringify(questionConfig));

    try {
      const response = await axiosInstance.post("/quiz/new", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      console.log("Quiz creation response:", response.data);
      navigate(`/q/${response.data.quizId}`);
      setFiles([]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to create quiz";
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="px-4 py-6 flex justify-center mb-8 min-h-screen">
        <div className="w-lg flex gap-3 flex-col items-center">
          <h1 className="text-2xl font-semibold mt-12 mb-3">
            Turn content into quizzes!
          </h1>
          <div
            className={clsx(
              "border-2 border-dashed w-lg cursor-pointer rounded-2xl px-6 pt-7 pb-8 transition-all duration-200 text-center",
              isDragging
                ? "border-gray-500 bg-gray-200"
                : "border-gray-200 hover:border-gray-400",
              files.length > 0 && "border-gray-300 bg-gray-50/50",
              files.length >= 5 && "opacity-50 cursor-not-allowed",
            )}
            onDragOver={files.length < 5 ? handleDragOver : undefined}
            onDragLeave={files.length < 5 ? handleDragLeave : undefined}
            onDrop={files.length < 5 ? handleDrop : undefined}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              accept=".txt,.md"
            />

            <div className="flex flex-col items-center justify-center gap-2">
              <div className="rounded-full border !border-gray-200 bg-white p-2.5">
                <Upload className="h-3.5 w-3.5 text-black" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-gray-800">
                  Drop your files here
                </p>
                <p className="text-gray-500">
                  or{" "}
                  <button
                    onClick={files.length < 5 ? triggerFileInput : undefined}
                    className={clsx(
                      "font-medium",
                      files.length < 5
                        ? "text-gray-800 hover:text-black"
                        : "text-gray-400 cursor-not-allowed",
                    )}
                  >
                    browse
                  </button>
                </p>
                {files.length >= 5 && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Maximum 5 files allowed
                  </p>
                )}
                <p className="text-[10px] mt-1 text-gray-500">
                  Supports TXT and MD files (max 500KB total)
                </p>
              </div>
            </div>
          </div>

          <div className="mt-1 w-lg animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-gray-700">
                Uploaded Files
              </div>
              <div className="text-[10px] font-medium text-gray-500">
                {files.length}/5 files
              </div>
            </div>
            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2.5">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="relative rounded-xl border !border-gray-300 bg-white p-2 w-full"
                  >
                    <button
                      onClick={() => removeFile(file.id)}
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border !border-gray-300 hover:bg-gray-100"
                    >
                      <X className="h-2.5 w-2.5 text-black" />
                    </button>
                    <div className="flex flex-col items-center text-center pt-1 pb-0.5">
                      <FileText
                        className="h-5 w-5 text-gray-700 mb-1"
                        strokeWidth={1.5}
                      />
                      <p
                        className="text-[10px] font-medium text-gray-800 truncate w-full px-1"
                        title={file.name}
                      >
                        {file.name}
                      </p>
                      <p className="text-[9px] text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <QuestionSettings />

          <button
            className={clsx(
              "mt-3 w-full py-1.5 text-sm bg-black text-white rounded-full transition-opacity",
              !isValid || isLoading
                ? "bg-black/50 cursor-not-allowed"
                : "active:bg-neutral-800 hover:bg-neutral-950",
            )}
            disabled={!isValid || isLoading}
            onClick={handleGenerateQuiz}
          >
            {isLoading ? "Creating... (may take up to 20s)" : "Generate quiz"}
          </button>
        </div>
      </div>
    </>
  );
}
