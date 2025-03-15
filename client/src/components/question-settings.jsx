import { useQuizSettings } from "../context/QuizSettingsContext";
import { useState, useEffect } from "react";
import clsx from "clsx";
import SelectDropdown from "./select-dropdown";
import { Check } from "lucide-react";

export default function QuestionSettings() {
  const {
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
  } = useQuizSettings();

  const settingsOptions = {
    totalQuestions: {
      label: "Total Questions",
      options: [
        { value: 10, label: "10" },
        { value: 15, label: "15" },
        { value: 20, label: "20" },
      ],
    },
    mcqOptions: {
      label: "MCQ Count",
      options: [5, 10, 15, 20].map((n) => ({ value: n, label: n.toString() })),
    },
    trueFalseOptions: {
      label: "True/False Count",
      options: [5, 10, 15, 20].map((n) => ({ value: n, label: n.toString() })),
    },
  };

  // Simplified getMaxAllowed
  const getMaxAllowed = (type) => {
    const otherTypeCount = type === "mcq" ? trueFalseCount : mcqCount;
    return (
      totalQuestions -
      (selectedTypes[type === "mcq" ? "trueFalse" : "mcq"] ? otherTypeCount : 0)
    );
  };

  // Simplified validation effect
  useEffect(() => {
    const totalAllocated =
      (selectedTypes.mcq ? mcqCount : 0) +
      (selectedTypes.trueFalse ? trueFalseCount : 0);
    const remaining = totalQuestions - totalAllocated;

    let newError = "";

    if (remaining !== 0 && (selectedTypes.mcq || selectedTypes.trueFalse)) {
      newError =
        remaining > 0
          ? `There are ${remaining} unallocated question(s)`
          : `Allocated questions exceed the total by ${-remaining}`;
    }

    setError(newError);
  }, [totalQuestions, selectedTypes, mcqCount, trueFalseCount]);

  // Modified total questions handler
  const handleTotalQuestionsChange = (e) => {
    const newTotal = Number(e.target.value);
    setTotalQuestions(newTotal);

    // Clamp both counts to new total if they exceed it
    if (selectedTypes.mcq && mcqCount > newTotal) {
      setMcqCount(newTotal);
    }
    if (selectedTypes.trueFalse && trueFalseCount > newTotal) {
      setTrueFalseCount(newTotal);
    }
  };

  // Improved type change handler
  const handleTypeChange = (type) => {
    const wasActive = selectedTypes[type];
    const otherType = type === "mcq" ? "trueFalse" : "mcq";

    if (!wasActive) {
      const maxAllowed = getMaxAllowed(type);
      const recommendedCount = Math.min(maxAllowed, totalQuestions);

      setSelectedTypes((prev) => ({ ...prev, [type]: true }));
      if (type === "mcq") {
        setMcqCount(recommendedCount);
      } else {
        setTrueFalseCount(recommendedCount);
      }
    } else {
      setSelectedTypes((prev) => ({ ...prev, [type]: false }));
      if (type === "mcq") setMcqCount(0);
      else setTrueFalseCount(0);
    }
    setError("");
  };

  return (
    <>
      <div className="w-full flex flex-col gap-4 mx-auto p-5 border-2 border-gray-200 rounded-2xl">
        <div className="grid grid-cols-3 gap-6">
          <SelectDropdown
            label={settingsOptions.totalQuestions.label}
            value={totalQuestions}
            onChange={handleTotalQuestionsChange}
            options={settingsOptions.totalQuestions.options}
          />

          <div className="col-span-2">
            <p className="text-sm font-medium text-gray-700 mb-1.5">
              Question Types
            </p>
            <div className="flex flex-col ml-1 gap-1.5">
              {[
                { id: "mcq", label: "MCQ" },
                { id: "trueFalse", label: "True/False" },
              ].map((type) => (
                <div
                  key={type.id}
                  className="flex h-7 justify-between items-center"
                >
                  {/* Checkbox Container */}
                  <div
                    className="flex-1 flex gap-2 rounded-lg items-center cursor-pointer transition-colors"
                    onClick={() => handleTypeChange(type.id)}
                  >
                    <div
                      className={clsx(
                        "w-5 h-5 rounded-full border flex items-center justify-center",
                        selectedTypes[type.id]
                          ? "bg-black border-black"
                          : "bg-white border-gray-400",
                      )}
                    >
                      {selectedTypes[type.id] && (
                        <Check className="w-3 h-3 text-white" strokeWidth={2} />
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-800">
                      {type.label}
                    </span>
                  </div>

                  {/* Dropdown Container for allocated count */}
                  {selectedTypes[type.id] && (
                    <div className="w-24">
                      <SelectDropdown
                        label=""
                        value={Math.min(
                          type.id === "mcq" ? mcqCount : trueFalseCount,
                          getMaxAllowed(type.id),
                        )}
                        onChange={(e) =>
                          type.id === "mcq"
                            ? setMcqCount(Number(e.target.value))
                            : setTrueFalseCount(Number(e.target.value))
                        }
                        options={settingsOptions[
                          `${type.id}Options`
                        ].options.filter(
                          (opt) => opt.value <= getMaxAllowed(type.id),
                        )}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {error && (
        <div
          className={clsx(
            "px-4 text-xs w-full rounded-sm font-medium",
            error.startsWith("Cannot add") ? "text-red-600" : "text-yellow-600",
          )}
        >
          {error}
        </div>
      )}
    </>
  );
}
