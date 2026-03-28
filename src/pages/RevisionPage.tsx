import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import {
  Brain,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  Calendar,
  ChevronRight,
  BookOpen,
  Lightbulb,
  XCircle,
  Loader2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const QUALITY_LABELS = [
  { value: 0, label: "Blackout", color: "bg-red-600" },
  { value: 1, label: "Very Hard", color: "bg-orange-600" },
  { value: 2, label: "Hard", color: "bg-yellow-600" },
  { value: 3, label: "Correct", color: "bg-blue-600" },
  { value: 4, label: "Easy", color: "bg-green-600" },
  { value: 5, label: "Perfect", color: "bg-emerald-600" },
];

type LearnData = {
  lesson: {
    title: string;
    keyPoints: string[];
    explanation: string;
  };
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }>;
};

type LearnPhase = "lesson" | "quiz" | "result";

export default function RevisionPage() {
  const revisionQueue = useQuery(api.revision.getRevisionQueue);
  const allItems = useQuery(api.revision.getAllRevisionItems);
  const reviewItem = useMutation(api.revision.reviewItem);
  const deleteItem = useMutation(api.revision.deleteRevisionItem);
  const quickLearn = useAction(api.ai.quickLearnTopic);

  const [activeItem, setActiveItem] = useState<Id<"revisionItems"> | null>(
    null
  );
  const [tab, setTab] = useState<"due" | "all">("due");

  // Quick Learn state
  const [learnItemId, setLearnItemId] = useState<Id<"revisionItems"> | null>(null);
  const [learnData, setLearnData] = useState<LearnData | null>(null);
  const [learnPhase, setLearnPhase] = useState<LearnPhase>("lesson");
  const [learnLoading, setLearnLoading] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(0);

  const displayItems = tab === "due" ? revisionQueue : allItems;
  const dueCount = revisionQueue?.length ?? 0;

  async function handleReview(itemId: Id<"revisionItems">, quality: number) {
    try {
      await reviewItem({ itemId, quality });
      setActiveItem(null);
      toast.success(
        quality >= 3 ? "Good work! Scheduled for review." : "Keep practicing!"
      );
    } catch {
      toast.error("Failed to record review");
    }
  }

  async function handleDelete(itemId: Id<"revisionItems">) {
    if (!confirm("Remove this revision item?")) return;
    try {
      await deleteItem({ itemId });
      toast.success("Removed from revision queue");
    } catch {
      toast.error("Failed to delete item");
    }
  }

  async function startQuickLearn(
    itemId: Id<"revisionItems">,
    topic: string,
    sourceSessionId: Id<"studySessions">
  ) {
    setLearnItemId(itemId);
    setLearnLoading(true);
    setLearnPhase("lesson");
    setLearnData(null);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizAnswered(0);
    setSelectedOption("");
    setAnswerSubmitted(false);

    try {
      const data = await quickLearn({ topic, sourceSessionId });
      setLearnData(data);
    } catch {
      toast.error("Failed to generate learning content");
      setLearnItemId(null);
    } finally {
      setLearnLoading(false);
    }
  }

  function exitQuickLearn() {
    setLearnItemId(null);
    setLearnData(null);
    setLearnPhase("lesson");
  }

  function handleQuizAnswer() {
    if (!learnData || !selectedOption) return;
    const question = learnData.questions[quizIndex];
    const isCorrect = selectedOption === question.correctAnswer;
    setQuizScore((prev) => prev + (isCorrect ? 1 : 0));
    setQuizAnswered((prev) => prev + 1);
    setAnswerSubmitted(true);
  }

  function handleQuizNext() {
    if (!learnData) return;
    if (quizIndex < learnData.questions.length - 1) {
      setQuizIndex((prev) => prev + 1);
      setSelectedOption("");
      setAnswerSubmitted(false);
    } else {
      setLearnPhase("result");
    }
  }

  async function handleQuickLearnFinish() {
    if (!learnItemId || !learnData) return;
    const total = learnData.questions.length;
    const pct = total > 0 ? quizScore / total : 0;
    // Map quiz performance to SM-2 quality: 0–5
    const quality = pct >= 1 ? 5 : pct >= 0.66 ? 4 : pct >= 0.33 ? 3 : pct > 0 ? 2 : 1;
    try {
      await reviewItem({ itemId: learnItemId, quality });
      toast.success(
        quality >= 3
          ? "Great revision! Scheduled for later review."
          : "Keep at it — this topic will come back sooner."
      );
    } catch {
      toast.error("Failed to record review");
    }
    exitQuickLearn();
  }

  // -------------------------------------------------------------------------
  // Quick Learn full-screen overlay
  // -------------------------------------------------------------------------
  if (learnItemId) {
    const currentItem = displayItems?.find((i) => i._id === learnItemId) ??
      allItems?.find((i) => i._id === learnItemId);

    if (learnLoading) {
      return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 p-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-white">Preparing your lesson...</h2>
          <p className="text-sm text-gray-400">
            Generating a quick lesson on{" "}
            <span className="text-indigo-400 font-medium">
              {currentItem?.topic ?? "this topic"}
            </span>
          </p>
          <Loader2 className="w-5 h-5 animate-spin text-gray-500 mt-2" />
        </div>
      );
    }

    if (!learnData) return null;

    // LESSON PHASE
    if (learnPhase === "lesson") {
      return (
        <div className="min-h-screen bg-gray-950 flex flex-col">
          <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
            <button
              onClick={exitQuickLearn}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white text-sm">
                Quick Learn: {currentItem?.topic}
              </h1>
              <p className="text-xs text-gray-500">Step 1 of 2 — Read the lesson</p>
            </div>
            <BookOpen className="w-5 h-5 text-indigo-400" />
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6">
                {learnData.lesson.title}
              </h2>

              <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-5 mb-6">
                <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Key Points
                </h3>
                <ul className="space-y-2">
                  {learnData.lesson.keyPoints.map((point, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-200">
                      <span className="text-indigo-400 font-bold shrink-0">
                        {i + 1}.
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="prose prose-invert max-w-none">
                {learnData.lesson.explanation.split("\n").map((para, i) => (
                  <p
                    key={i}
                    className="text-gray-300 leading-relaxed mb-4 text-[15px]"
                  >
                    {para}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 p-4">
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => {
                  setLearnPhase("quiz");
                  setQuizIndex(0);
                  setSelectedOption("");
                  setAnswerSubmitted(false);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Brain className="w-4 h-4" />
                Test Your Understanding
              </button>
            </div>
          </div>
        </div>
      );
    }

    // QUIZ PHASE
    if (learnPhase === "quiz") {
      const question = learnData.questions[quizIndex];
      const isLast = quizIndex === learnData.questions.length - 1;
      const isCorrect = answerSubmitted && selectedOption === question.correctAnswer;
      const isWrong = answerSubmitted && selectedOption !== question.correctAnswer;

      return (
        <div className="min-h-screen bg-gray-950 flex flex-col">
          <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setLearnPhase("lesson")}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white text-sm">
                Quick Quiz: {currentItem?.topic}
              </h1>
              <p className="text-xs text-gray-500">
                Question {quizIndex + 1} of {learnData.questions.length}
              </p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: quizAnswered }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full",
                    i < quizScore ? "bg-green-400" : "bg-red-400"
                  )}
                />
              ))}
            </div>
          </header>

          <div className="h-1 bg-gray-800">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{
                width: `${(quizIndex / learnData.questions.length) * 100}%`,
              }}
            />
          </div>

          <div className="flex-1 flex items-start justify-center p-6">
            <div className="w-full max-w-2xl">
              <h2 className="text-xl font-semibold text-white mb-6">
                {question.question}
              </h2>

              <div className="space-y-3">
                {question.options.map((option) => {
                  let style =
                    "border-gray-700 hover:border-gray-600 text-gray-300 hover:bg-gray-800/50";
                  if (answerSubmitted) {
                    if (option === question.correctAnswer) {
                      style =
                        "border-green-500 bg-green-600/10 text-green-300";
                    } else if (option === selectedOption && isWrong) {
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
                      onClick={() => !answerSubmitted && setSelectedOption(option)}
                      disabled={answerSubmitted}
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

              {answerSubmitted && (
                <div className="mt-4 p-4 bg-gray-900 border border-gray-800 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    {isCorrect ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isCorrect ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {isCorrect ? "Correct!" : "Incorrect"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    {question.explanation}
                  </p>
                </div>
              )}

              <div className="mt-6">
                {!answerSubmitted ? (
                  <button
                    onClick={handleQuizAnswer}
                    disabled={!selectedOption}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    Check Answer
                  </button>
                ) : (
                  <button
                    onClick={handleQuizNext}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {isLast ? (
                      <>See Results</>
                    ) : (
                      <>
                        Next Question
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // RESULT PHASE
    if (learnPhase === "result") {
      const total = learnData.questions.length;
      const pct = total > 0 ? Math.round((quizScore / total) * 100) : 0;

      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <div className="max-w-lg w-full">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center">
              <div
                className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
                  pct >= 66
                    ? "bg-green-600/20"
                    : pct >= 33
                      ? "bg-yellow-600/20"
                      : "bg-red-600/20"
                )}
              >
                {pct >= 66 ? (
                  <CheckCircle className="w-10 h-10 text-green-400" />
                ) : pct >= 33 ? (
                  <Brain className="w-10 h-10 text-yellow-400" />
                ) : (
                  <AlertTriangle className="w-10 h-10 text-red-400" />
                )}
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">
                {pct >= 66
                  ? "Great job!"
                  : pct >= 33
                    ? "Getting there!"
                    : "Needs more work"}
              </h2>

              <div
                className={cn(
                  "text-5xl font-extrabold my-4",
                  pct >= 66
                    ? "text-green-400"
                    : pct >= 33
                      ? "text-yellow-400"
                      : "text-red-400"
                )}
              >
                {quizScore}/{total}
              </div>

              <p className="text-gray-400 mb-2 text-sm">
                on <span className="text-white font-medium">{currentItem?.topic}</span>
              </p>

              <p className="text-gray-500 text-xs mb-6">
                {pct >= 66
                  ? "Your review will be scheduled further out. Keep it up!"
                  : "This topic will come back sooner so you can practice again."}
              </p>

              <div className="grid grid-cols-3 gap-2 mb-6">
                {learnData.questions.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-2 rounded-full",
                      i < quizScore ? "bg-green-500" : "bg-red-500"
                    )}
                  />
                ))}
              </div>

              <button
                onClick={handleQuickLearnFinish}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Save & Return to Queue
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Main revision list view
  // ---------------------------------------------------------------------------
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Revision Queue</h1>
        <p className="text-gray-400">
          Review topics based on spaced repetition to lock in your knowledge.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white">{dueCount}</div>
          <div className="text-xs text-gray-400 mt-0.5">Due today</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {allItems?.filter((i) => i.isCritical).length ?? 0}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Critical items</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {allItems?.length ?? 0}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Total topics</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 w-fit">
        {(["due", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === t
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            )}
          >
            {t === "due" ? `Due (${dueCount})` : "All Topics"}
          </button>
        ))}
      </div>

      {/* Items */}
      {!displayItems || displayItems.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">
            {tab === "due" ? "All caught up!" : "No revision items yet"}
          </h2>
          <p className="text-gray-400 text-sm">
            {tab === "due"
              ? "No items due for review today. Great work!"
              : "Complete quizzes after study sessions to build your revision queue."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayItems.map((item) => {
            const isActive = activeItem === item._id;
            const isDue = item.nextReviewAt <= Date.now();

            return (
              <div
                key={item._id}
                className={cn(
                  "bg-gray-900 border rounded-2xl overflow-hidden transition-all",
                  item.isCritical
                    ? "border-red-700/50"
                    : isDue
                      ? "border-yellow-700/30"
                      : "border-gray-800"
                )}
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                  onClick={() =>
                    setActiveItem(isActive ? null : item._id)
                  }
                >
                  {item.isCritical ? (
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  ) : isDue ? (
                    <Clock className="w-5 h-5 text-yellow-400 shrink-0" />
                  ) : (
                    <Brain className="w-5 h-5 text-indigo-400 shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate">
                      {item.topic}
                    </h3>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Next review:{" "}
                        {isDue
                          ? "Now"
                          : formatDate(item.nextReviewAt)}
                      </span>
                      <span className="text-xs text-gray-600">
                        Interval: {item.interval}d
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.isCritical && (
                      <span className="text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full">
                        Critical
                      </span>
                    )}
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 text-gray-600 transition-transform",
                        isActive && "rotate-90"
                      )}
                    />
                  </div>
                </div>

                {/* Review panel */}
                {isActive && (
                  <div className="border-t border-gray-800 p-4">
                    {item.notes && (
                      <p className="text-sm text-gray-400 mb-4 p-3 bg-gray-800 rounded-xl">
                        {item.notes}
                      </p>
                    )}

                    {/* Quick Learn button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startQuickLearn(item._id, item.topic, item.sourceSessionId);
                      }}
                      className="w-full mb-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 text-indigo-300 hover:from-indigo-600/30 hover:to-purple-600/30 hover:border-indigo-500/50 transition-all text-sm font-medium"
                    >
                      <Sparkles className="w-4 h-4" />
                      Quick Learn & Revise
                    </button>

                    <p className="text-sm text-gray-300 mb-3 font-medium">
                      Or rate your recall directly:
                    </p>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {QUALITY_LABELS.map(({ value, label, color }) => (
                        <button
                          key={value}
                          onClick={() =>
                            handleReview(item._id, value)
                          }
                          className={`py-2.5 px-3 rounded-xl text-xs font-medium text-white transition-opacity hover:opacity-90 ${color}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleDelete(item._id)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove from queue
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
