import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Brain,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Clock,
  Target,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Answer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export default function QuizPage() {
  const { sessionId, quizId } = useParams<{
    sessionId: string;
    quizId: string;
  }>();
  const navigate = useNavigate();

  const quiz = useQuery(api.quizzes.getQuiz, {
    quizId: quizId as Id<"quizzes">,
  });
  const submitAttempt = useMutation(api.quizzes.submitQuizAttempt);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [shortAnswer, setShortAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionStart, setQuestionStart] = useState(Date.now());
  const [finalResult, setFinalResult] = useState<{
    score: number;
    weakTopics: string[];
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const questions = quiz?.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  useEffect(() => {
    setQuestionStart(Date.now());
    setSelectedOption("");
    setShortAnswer("");
    setSubmitted(false);
    setShowExplanation(false);
  }, [currentIndex]);

  if (!quiz) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (quiz.status === "generating") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
        <p className="text-gray-400">Generating your quiz questions...</p>
      </div>
    );
  }

  if (quiz.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-8">
        <XCircle className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-bold text-white">Quiz Generation Failed</h2>
        <p className="text-gray-400">
          We couldn't generate quiz questions. Make sure your materials have
          readable text content.
        </p>
        <button
          onClick={() => navigate(`/sessions/${sessionId}`)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          Back to Session
        </button>
      </div>
    );
  }

  if (finalResult) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-indigo-600/20 flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-10 h-10 text-indigo-400" />
            </div>

            <h2 className="text-3xl font-bold text-white mb-2">
              {finalResult.score >= 80
                ? "Excellent!"
                : finalResult.score >= 60
                  ? "Good job!"
                  : "Keep practicing!"}
            </h2>

            <div className="text-6xl font-extrabold text-indigo-400 my-4">
              {finalResult.score}%
            </div>

            <p className="text-gray-400 mb-6">
              You answered{" "}
              {answers.filter((a) => a.isCorrect).length} out of{" "}
              {answers.length} questions correctly.
            </p>

            {finalResult.weakTopics.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm font-medium text-yellow-400 mb-2">
                  Topics to review:
                </p>
                <div className="flex flex-wrap gap-2">
                  {finalResult.weakTopics.map((topic) => (
                    <span
                      key={topic}
                      className="text-xs bg-yellow-700/20 text-yellow-300 px-3 py-1 rounded-full"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Question summary */}
            <div className="grid grid-cols-5 gap-2 mb-6">
              {answers.map((a, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 rounded-full",
                    a.isCorrect ? "bg-green-500" : "bg-red-500"
                  )}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/sessions/${sessionId}`)}
                className="flex-1 border border-gray-700 hover:border-gray-600 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Back to Session
              </button>
              <button
                onClick={() => navigate("/revision")}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                View Revision Queue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function checkAnswer() {
    if (!currentQuestion) return;
    const userAnswer =
      currentQuestion.type === "mcq" ? selectedOption : shortAnswer;
    if (!userAnswer.trim()) return;

    const timeSpent = Math.round((Date.now() - questionStart) / 1000);
    let isCorrect = false;

    if (currentQuestion.type === "mcq") {
      isCorrect = userAnswer === currentQuestion.correctAnswer;
    } else {
      // Fuzzy match for short answer
      isCorrect =
        userAnswer.toLowerCase().trim() ===
        currentQuestion.correctAnswer.toLowerCase().trim();
    }

    const newAnswers = [
      ...answers,
      {
        questionId: currentQuestion.id,
        userAnswer,
        isCorrect,
        timeSpentSeconds: timeSpent,
      },
    ];
    setAnswers(newAnswers);
    setSubmitted(true);
    setShowExplanation(true);
  }

  async function handleNext() {
    if (isLast) {
      setIsSubmitting(true);
      try {
        const result = await submitAttempt({
          quizId: quizId as Id<"quizzes">,
          sessionId: sessionId as Id<"studySessions">,
          answers,
        });
        setFinalResult({ score: result.score, weakTopics: result.weakTopics });
      } catch (err: any) {
        toast.error("Failed to submit quiz");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  const userAnswer =
    currentQuestion?.type === "mcq" ? selectedOption : shortAnswer;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-4">
        <button
          onClick={() => navigate(`/sessions/${sessionId}`)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-white">
            {quiz.topic ?? "Session Quiz"}
          </h1>
          <p className="text-xs text-gray-400">
            Question {currentIndex + 1} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {answers.slice(-5).map((a, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full",
                  a.isCorrect ? "bg-green-400" : "bg-red-400"
                )}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="h-1 bg-gray-800">
        <div
          className="h-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="flex-1 flex items-start justify-center p-6">
        <div className="w-full max-w-2xl">
          {currentQuestion && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full font-medium",
                    currentQuestion.difficulty === "easy"
                      ? "bg-green-600/20 text-green-400"
                      : currentQuestion.difficulty === "medium"
                        ? "bg-yellow-600/20 text-yellow-400"
                        : "bg-red-600/20 text-red-400"
                  )}
                >
                  {currentQuestion.difficulty}
                </span>
                <span className="text-xs text-gray-500">
                  {currentQuestion.topic}
                </span>
              </div>

              <h2 className="text-xl font-semibold text-white mb-6">
                {currentQuestion.question}
              </h2>

              {currentQuestion.type === "mcq" ? (
                <div className="space-y-3">
                  {currentQuestion.options?.map((option) => {
                    let style =
                      "border-gray-700 hover:border-gray-600 text-gray-300 hover:bg-gray-800/50";
                    if (submitted) {
                      if (option === currentQuestion.correctAnswer) {
                        style =
                          "border-green-500 bg-green-600/10 text-green-300";
                      } else if (
                        option === selectedOption &&
                        !answers[answers.length - 1]?.isCorrect
                      ) {
                        style = "border-red-500 bg-red-600/10 text-red-300";
                      } else {
                        style = "border-gray-800 text-gray-500";
                      }
                    } else if (selectedOption === option) {
                      style =
                        "border-indigo-500 bg-indigo-600/10 text-white";
                    }

                    return (
                      <button
                        key={option}
                        onClick={() => !submitted && setSelectedOption(option)}
                        disabled={submitted}
                        className={cn(
                          "w-full text-left p-4 rounded-xl border transition-all",
                          style
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <textarea
                    value={shortAnswer}
                    onChange={(e) => setShortAnswer(e.target.value)}
                    disabled={submitted}
                    placeholder="Type your answer here..."
                    rows={4}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none disabled:opacity-60"
                  />
                  {submitted && (
                    <div
                      className={cn(
                        "mt-3 p-3 rounded-xl",
                        answers[answers.length - 1]?.isCorrect
                          ? "bg-green-900/20 border border-green-700/30"
                          : "bg-red-900/20 border border-red-700/30"
                      )}
                    >
                      <p className="text-sm text-gray-400">
                        Expected:{" "}
                        <span className="text-white font-medium">
                          {currentQuestion.correctAnswer}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Explanation */}
              {showExplanation && (
                <div className="mt-4 p-4 bg-gray-900 border border-gray-800 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    {answers[answers.length - 1]?.isCorrect ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span
                      className={cn(
                        "text-sm font-medium",
                        answers[answers.length - 1]?.isCorrect
                          ? "text-green-400"
                          : "text-red-400"
                      )}
                    >
                      {answers[answers.length - 1]?.isCorrect
                        ? "Correct!"
                        : "Incorrect"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                {!submitted ? (
                  <button
                    onClick={checkAnswer}
                    disabled={!userAnswer.trim()}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    Check Answer
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={isSubmitting}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isLast ? (
                      <>
                        <Trophy className="w-4 h-4" />
                        Finish Quiz
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
