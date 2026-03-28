import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Play,
  Pause,
  Square,
  Users,
  MessageSquare,
  BookOpen,
  Upload,
  Copy,
  Check,
  Brain,
  ChevronLeft,
  Settings,
  FileText,
  Image,
  Loader2,
  X,
  Link2,
  Hash,
  BarChart3,
} from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { formatTime, formatDate, formatDuration } from "@/lib/utils";
import MaterialViewer from "@/components/materials/MaterialViewer";
import ChatPanel from "@/components/chat/ChatPanel";
import MembersPanel from "@/components/session/MembersPanel";
import MaterialUpload from "@/components/materials/MaterialUpload";
import CheckInModal from "@/components/session/CheckInModal";
import ProgressTimeline from "@/components/session/ProgressTimeline";
import AITutorPanel from "@/components/ai/AITutorPanel";
import { cn } from "@/lib/utils";

function HeaderAvatarStack({
  members,
  onClickMembers,
}: {
  members: Array<{
    _id: string;
    userName: string;
    userImage?: string;
    avatarColor?: string;
    status: "active" | "idle" | "away" | "offline";
  }>;
  onClickMembers: () => void;
}) {
  const display = members.slice(0, 5);
  const overflow = members.length - display.length;
  const onlineCount = members.filter((m) => m.status === "active").length;

  const STATUS_DOT: Record<string, string> = {
    active: "bg-emerald-400",
    idle: "bg-amber-400",
    away: "bg-orange-400",
    offline: "bg-gray-500",
  };

  return (
    <button
      onClick={onClickMembers}
      className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors"
      title={`${onlineCount} of ${members.length} online`}
    >
      <div className="flex -space-x-2">
        {display.map((m) => {
          const color = m.avatarColor ?? "#6366F1";
          const initials = m.userName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <div key={m._id} className="relative">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-gray-900"
                style={{
                  background: m.userImage
                    ? undefined
                    : `linear-gradient(135deg, ${color}, ${color}dd)`,
                }}
              >
                {m.userImage ? (
                  <img
                    src={m.userImage}
                    alt={m.userName}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-gray-900",
                  STATUS_DOT[m.status]
                )}
              />
            </div>
          );
        })}
        {overflow > 0 && (
          <div className="w-7 h-7 rounded-full bg-gray-700 ring-2 ring-gray-900 flex items-center justify-center text-[10px] font-medium text-gray-300">
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-xs text-gray-400 tabular-nums">
        {onlineCount}/{members.length}
      </span>
    </button>
  );
}

type Tab = "materials" | "chat" | "members" | "progress";

export default function SessionActivePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthSession();

  const sessionData = useQuery(api.sessions.getMySession, {
    sessionId: sessionId as Id<"studySessions">,
  });
  const sessionMembers = useQuery(api.sessions.getSessionMembers, {
    sessionId: sessionId as Id<"studySessions">,
  });
  const materials = useQuery(api.materials.getMaterials, {
    sessionId: sessionId as Id<"studySessions">,
  });
  const pendingCheckIn = useQuery(api.checkIns.getPendingCheckIn, {
    sessionId: sessionId as Id<"studySessions">,
  });
  const quizzes = useQuery(api.quizzes.getSessionQuizzes, {
    sessionId: sessionId as Id<"studySessions">,
  });
  const sessionProgress = useQuery(api.progress.getSessionProgress, {
    sessionId: sessionId as Id<"studySessions">,
  });

  const startSession = useMutation(api.sessions.startSession);
  const endSession = useMutation(api.sessions.endSession);
  const pauseSession = useMutation(api.sessions.pauseSession);
  const resumeSession = useMutation(api.sessions.resumeSession);
  const heartbeat = useMutation(api.sessions.heartbeat);
  const generateQuiz = useAction(api.quizzes.generateQuiz);

  const [activeTab, setActiveTab] = useState<Tab>("materials");
  const [selectedMaterialId, setSelectedMaterialId] = useState<
    Id<"materials"> | undefined
  >();
  const [copiedType, setCopiedType] = useState<"link" | "code" | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const session = sessionData?.session;
  const member = sessionData?.member;
  const isHost = member?.role === "host";

  // Heartbeat
  useEffect(() => {
    if (!sessionId || session?.status !== "active") return;
    const interval = setInterval(() => {
      heartbeat({ sessionId: sessionId as Id<"studySessions"> }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [sessionId, session?.status, heartbeat]);

  // Select first material if none selected
  useEffect(() => {
    if (!selectedMaterialId && materials && materials.length > 0) {
      setSelectedMaterialId(materials[0]._id);
    }
  }, [materials, selectedMaterialId]);

  async function handleStart() {
    if (!sessionId) return;
    setIsStarting(true);
    try {
      await startSession({ sessionId: sessionId as Id<"studySessions"> });
      toast.success("Session started!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsStarting(false);
    }
  }

  async function handleEnd() {
    if (!sessionId) return;
    if (!confirm("End this study session for everyone?")) return;
    setIsEnding(true);
    try {
      await endSession({ sessionId: sessionId as Id<"studySessions"> });
      toast.success("Session ended. Great studying!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsEnding(false);
    }
  }

  async function handlePause() {
    if (!sessionId) return;
    setIsPausing(true);
    try {
      await pauseSession({ sessionId: sessionId as Id<"studySessions"> });
      toast.success("Session paused");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsPausing(false);
    }
  }

  async function handleResume() {
    if (!sessionId) return;
    setIsResuming(true);
    try {
      await resumeSession({ sessionId: sessionId as Id<"studySessions"> });
      toast.success("Session resumed!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsResuming(false);
    }
  }

  async function handleGenerateQuiz() {
    if (!sessionId) return;
    setGeneratingQuiz(true);
    try {
      const quizId = await generateQuiz({
        sessionId: sessionId as Id<"studySessions">,
      });
      toast.success("Quiz generated!");
      navigate(`/sessions/${sessionId}/quiz/${quizId}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to generate quiz");
    } finally {
      setGeneratingQuiz(false);
    }
  }

  function copyInviteLink() {
    if (!session?.inviteCode) return;
    const joinUrl = `${window.location.origin}/join/${session.inviteCode}`;
    navigator.clipboard.writeText(joinUrl);
    setCopiedType("link");
    setTimeout(() => setCopiedType(null), 2000);
    setShowShareMenu(false);
    toast.success("Invite link copied!");
  }

  function copyInviteCode() {
    if (!session?.inviteCode) return;
    navigator.clipboard.writeText(session.inviteCode);
    setCopiedType("code");
    setTimeout(() => setCopiedType(null), 2000);
    setShowShareMenu(false);
    toast.success("Invite code copied!");
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    }
    if (showShareMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showShareMenu]);

  if (!sessionData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-400">Session not found</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-gray-400 hover:text-white transition-colors shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white truncate">{session.title}</h1>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span
              className={cn(
                "px-2 py-0.5 rounded-full",
                session.status === "active"
                  ? "bg-green-600/20 text-green-400"
                  : session.status === "scheduled"
                    ? "bg-blue-600/20 text-blue-400"
                    : session.status === "paused"
                      ? "bg-yellow-600/20 text-yellow-400"
                      : "bg-gray-700 text-gray-400"
              )}
            >
              {session.status}
            </span>
            <span>{formatDate(session.scheduledStart)}</span>
            {sessionProgress && sessionProgress.totalPages > 0 && (
              <span>
                {Math.round(sessionProgress.percentage)}% complete
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Avatar stack */}
          {sessionMembers && sessionMembers.length > 0 && (
            <HeaderAvatarStack
              members={sessionMembers.map((m) => ({
                _id: m._id,
                userName: m.userName,
                userImage: m.userImage,
                avatarColor: m.avatarColor,
                status: m.status,
              }))}
              onClickMembers={() => setActiveTab("members")}
            />
          )}

          {/* Invite code with share dropdown */}
          {session.inviteCode && (
            <div className="relative" ref={shareMenuRef}>
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="hidden sm:flex items-center gap-1.5 text-xs bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                {copiedType ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {session.inviteCode}
              </button>
              {showShareMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-gray-800 border border-gray-700 rounded-xl shadow-xl shadow-black/40 overflow-hidden z-50">
                  <button
                    onClick={copyInviteLink}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-300 hover:bg-gray-700/60 hover:text-white transition-colors"
                  >
                    <Link2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="text-left">
                      <span className="block font-medium">Copy invite link</span>
                      <span className="block text-xs text-gray-500">Full URL to share</span>
                    </div>
                  </button>
                  <button
                    onClick={copyInviteCode}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-300 hover:bg-gray-700/60 hover:text-white transition-colors"
                  >
                    <Hash className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="text-left">
                      <span className="block font-medium">Copy code only</span>
                      <span className="block text-xs text-gray-500">{session.inviteCode}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quiz button */}
          {session.status === "active" || session.status === "paused" || session.status === "completed" ? (
            <button
              onClick={handleGenerateQuiz}
              disabled={generatingQuiz}
              className="flex items-center gap-1.5 text-xs bg-purple-600/20 border border-purple-600/30 hover:bg-purple-600/30 text-purple-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              {generatingQuiz ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Brain className="w-3.5 h-3.5" />
              )}
              {generatingQuiz ? "Generating..." : "Quiz Me"}
            </button>
          ) : null}

          {/* Start/End session */}
          {isHost && session.status === "scheduled" && (
            <button
              onClick={handleStart}
              disabled={isStarting}
              className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {isStarting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Start
            </button>
          )}
          {isHost && session.status === "active" && (
            <>
              <button
                onClick={handlePause}
                disabled={isPausing}
                className="flex items-center gap-1.5 text-xs bg-yellow-600/20 border border-yellow-600/30 hover:bg-yellow-600/30 text-yellow-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                {isPausing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
                Pause
              </button>
              <button
                onClick={handleEnd}
                disabled={isEnding}
                className="flex items-center gap-1.5 text-xs bg-red-600/20 border border-red-600/30 hover:bg-red-600/30 text-red-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                {isEnding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                End
              </button>
            </>
          )}
          {isHost && session.status === "paused" && (
            <>
              <button
                onClick={handleResume}
                disabled={isResuming}
                className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                {isResuming ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                Resume
              </button>
              <button
                onClick={handleEnd}
                disabled={isEnding}
                className="flex items-center gap-1.5 text-xs bg-red-600/20 border border-red-600/30 hover:bg-red-600/30 text-red-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                {isEnding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                End
              </button>
            </>
          )}
        </div>
      </header>

      {/* Progress bar */}
      {sessionProgress && sessionProgress.totalPages > 0 && (
        <div className="h-1 bg-gray-800 shrink-0">
          <div
            className="h-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${sessionProgress.percentage}%` }}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Material viewer */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Material tabs */}
          {materials && materials.length > 0 && (
            <div className="flex items-center gap-1 px-4 py-2 bg-gray-900 border-b border-gray-800 overflow-x-auto shrink-0">
              {materials.map((m) => (
                <button
                  key={m._id}
                  onClick={() => setSelectedMaterialId(m._id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                    selectedMaterialId === m._id
                      ? "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  )}
                >
                  {m.type === "image" ? (
                    <Image className="w-3.5 h-3.5" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  {m.title}
                </button>
              ))}
              {(session.status === "active" || session.status === "scheduled" || session.status === "paused") && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </button>
              )}
            </div>
          )}

          {/* Viewer area */}
          <div className="flex-1 overflow-hidden">
            {selectedMaterialId ? (
              <MaterialViewer
                materialId={selectedMaterialId}
                sessionId={sessionId as Id<"studySessions">}
                defaultSpeed={member?.speedMinPerPage ?? 3}
                sessionStatus={session.status}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <BookOpen className="w-12 h-12 text-gray-700 mb-4" />
                <p className="text-gray-400 mb-2">No materials yet</p>
                <p className="text-gray-600 text-sm mb-6">
                  Upload documents or images to start studying
                </p>
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload Materials
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 hidden lg:flex">
          {/* Panel tabs */}
          <div className="flex border-b border-gray-800 shrink-0">
            {(
              [
                { id: "materials", icon: BookOpen, label: "Files" },
                { id: "progress", icon: BarChart3, label: "Progress" },
                { id: "members", icon: Users, label: "Members" },
                { id: "chat", icon: MessageSquare, label: "Chat" },
              ] as const
            ).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors",
                  activeTab === id
                    ? "text-indigo-400 border-b-2 border-indigo-500"
                    : "text-gray-400 hover:text-white"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "progress" && (
              <ProgressTimeline
                sessionId={sessionId as Id<"studySessions">}
              />
            )}
            {activeTab === "chat" && (
              <ChatPanel sessionId={sessionId as Id<"studySessions">} />
            )}
            {activeTab === "members" && (
              <MembersPanel
                sessionId={sessionId as Id<"studySessions">}
                currentUserId={user?.id ?? ""}
                defaultSpeed={member?.speedMinPerPage ?? 3}
              />
            )}
            {activeTab === "materials" && (
              <div className="p-4 space-y-2 overflow-y-auto h-full">
                {materials && materials.length > 0 ? (
                  materials.map((m) => {
                    const hasRange = m.startPage != null && m.endPage != null;
                    const effectivePages = hasRange
                      ? Math.max(1, m.endPage! - m.startPage! + 1)
                      : (m.totalPages ?? 1);
                    return (
                      <button
                        key={m._id}
                        onClick={() => setSelectedMaterialId(m._id)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border transition-colors",
                          selectedMaterialId === m._id
                            ? "border-indigo-500/50 bg-indigo-600/10"
                            : "border-gray-800 hover:border-gray-700 bg-gray-800/50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {m.type === "image" ? (
                            <Image className="w-4 h-4 text-indigo-400 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                          )}
                          <span className="text-sm font-medium text-white truncate">
                            {m.title}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 mt-1 block">
                          {hasRange
                            ? `pp. ${m.startPage}–${m.endPage} (${effectivePages} pg)`
                            : `${effectivePages} page${effectivePages > 1 ? "s" : ""}`}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No materials uploaded yet
                  </div>
                )}

                <button
                  onClick={() => setShowUpload(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-700 hover:border-indigo-600/50 text-gray-400 hover:text-indigo-400 rounded-xl transition-colors text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Upload Material
                </button>

                {/* Existing quizzes */}
                {quizzes && quizzes.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">
                      Quizzes
                    </p>
                    {quizzes.map((q) => (
                      <button
                        key={q._id}
                        onClick={() =>
                          navigate(`/sessions/${sessionId}/quiz/${q._id}`)
                        }
                        disabled={q.status !== "ready"}
                        className="w-full text-left p-3 rounded-xl border border-gray-800 hover:border-gray-700 bg-gray-800/50 mb-2 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-purple-400" />
                          <span className="text-sm text-white">
                            {q.topic ?? "General Quiz"}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "text-xs mt-1 block",
                            q.status === "ready"
                              ? "text-green-400"
                              : q.status === "generating"
                                ? "text-yellow-400"
                                : "text-red-400"
                          )}
                        >
                          {q.status === "ready"
                            ? `${q.questions.length} questions`
                            : q.status === "generating"
                              ? "Generating..."
                              : "Failed"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-semibold text-white">Upload Materials</h2>
              <button
                onClick={() => setShowUpload(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <MaterialUpload
                sessionId={sessionId as Id<"studySessions">}
                onSuccess={() => {
                  setShowUpload(false);
                  toast.success("Material uploaded!");
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Check-in modal */}
      {pendingCheckIn && (
        <CheckInModal
          sessionId={sessionId as Id<"studySessions">}
          checkIn={pendingCheckIn}
        />
      )}

      {/* AI Tutor floating panel */}
      <AITutorPanel
        sessionId={sessionId as Id<"studySessions">}
        materialId={selectedMaterialId}
        materialTitle={materials?.find((m) => m._id === selectedMaterialId)?.title}
      />
    </div>
  );
}
