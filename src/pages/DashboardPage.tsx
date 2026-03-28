import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Plus,
  Clock,
  BookOpen,
  Brain,
  TrendingUp,
  Flame,
  Target,
  ChevronRight,
  Calendar,
  Users,
  LogIn,
  Loader2,
  Pause,
  Globe,
  ArrowRight,
  Play,
  FileText,
  Timer,
  Zap,
} from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { formatDuration, formatDate } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "indigo",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-600/10 text-indigo-400",
    green: "bg-green-600/10 text-green-400",
    yellow: "bg-yellow-600/10 text-yellow-400",
    purple: "bg-purple-600/10 text-purple-400",
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color]}`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function LiveElapsed({ startMs }: { startMs: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - startMs) / 1000));
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="font-mono tabular-nums text-white">
      {h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`}
    </span>
  );
}

export default function DashboardPage() {
  const { user } = useAuthSession();
  const navigate = useNavigate();
  const stats = useQuery(api.stats.getMyStats);
  const sessions = useQuery(api.sessions.getMySessions);
  const revisionQueue = useQuery(api.revision.getRevisionQueue);
  const activityLog = useQuery(api.stats.getActivityLog, { days: 14 });
  const publicSessions = useQuery(api.sessions.getPublicSessions);
  const myActiveCreatedSession = useQuery(
    api.sessions.getMyActiveCreatedSession
  );
  const todayStats = useQuery(api.stats.getTodayStats);
  const activeStudying = useQuery(api.stats.getActiveStudyingSummary);

  const joinByInviteCode = useMutation(api.sessions.joinByInviteCode);
  const joinPublicSession = useMutation(api.sessions.joinPublicSession);
  const pauseSession = useMutation(api.sessions.pauseSession);

  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pendingJoinAction, setPendingJoinAction] = useState<
    (() => Promise<void>) | null
  >(null);

  const recentSessions = (sessions?.slice(0, 5) ?? []).filter(
    (s): s is NonNullable<typeof s> => s !== null
  );
  const dueRevisions = revisionQueue?.length ?? 0;

  const chartData =
    activityLog?.map((log) => ({
      date: log.date.slice(5),
      minutes: Math.round(log.minutesStudied),
      pages: log.pagesRead,
    })) ?? [];

  const weeklyProgress = stats
    ? Math.min(
        100,
        ((stats.weeklyMinutesThisWeek ?? 0) /
          (stats.weeklyGoalMinutes || 300)) *
          100
      )
    : 0;

  async function executeJoin(joinFn: () => Promise<void>) {
    if (myActiveCreatedSession) {
      setPendingJoinAction(() => joinFn);
      setShowPauseModal(true);
      return;
    }
    await joinFn();
  }

  async function handleJoinByCode() {
    const code = inviteCodeInput.trim().toUpperCase();
    if (!code) return;

    const joinFn = async () => {
      setIsJoining(true);
      try {
        const { sessionId } = await joinByInviteCode({ inviteCode: code });
        toast.success("Joined study session!");
        setInviteCodeInput("");
        navigate(`/sessions/${sessionId}`);
      } catch (err: any) {
        toast.error(err.message ?? "Invalid invite code");
      } finally {
        setIsJoining(false);
      }
    };

    await executeJoin(joinFn);
  }

  async function handleJoinPublic(sessionId: string) {
    const joinFn = async () => {
      setIsJoining(true);
      try {
        await joinPublicSession({ sessionId: sessionId as any });
        toast.success("Joined study session!");
        navigate(`/sessions/${sessionId}`);
      } catch (err: any) {
        toast.error(err.message ?? "Failed to join session");
      } finally {
        setIsJoining(false);
      }
    };

    await executeJoin(joinFn);
  }

  async function handlePauseAndJoin() {
    if (!myActiveCreatedSession || !pendingJoinAction) return;
    setIsJoining(true);
    try {
      await pauseSession({ sessionId: myActiveCreatedSession._id });
      toast.success("Your session has been paused");
      setShowPauseModal(false);
      await pendingJoinAction();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to pause session");
      setIsJoining(false);
    }
    setPendingJoinAction(null);
  }

  function handleCancelJoin() {
    setShowPauseModal(false);
    setPendingJoinAction(null);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Good{" "}
            {new Date().getHours() < 12
              ? "morning"
              : new Date().getHours() < 17
                ? "afternoon"
                : "evening"}
            , {user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-gray-400 mt-1">
            Here's your learning overview for today.
          </p>
        </div>
        <Link
          to="/sessions/new"
          className="hidden sm:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-medium transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          New Session
        </Link>
      </div>

      {/* Active Session Banner */}
      {activeStudying && (
        <Link
          to={`/sessions/${activeStudying.sessionId}`}
          className="block mb-6 bg-gradient-to-r from-indigo-600/20 via-purple-600/15 to-indigo-600/20 border border-indigo-500/30 rounded-2xl p-5 hover:border-indigo-500/50 transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">
                  <Play className="w-4 h-4 text-indigo-400" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-950 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white">
                    {activeStudying.title}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-600/20 text-green-400">
                    live
                  </span>
                </div>
                {activeStudying.currentMaterialTitle && (
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {activeStudying.currentMaterialTitle} — page{" "}
                    {activeStudying.currentPage}
                  </p>
                )}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-indigo-400 transition-colors" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Pages Read</p>
              <p className="text-lg font-bold text-white">
                {activeStudying.totalPagesRead}
                {activeStudying.sessionTotalPages > 0 && (
                  <span className="text-sm font-normal text-gray-500">
                    /{activeStudying.sessionTotalPages}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Time Spent</p>
              <p className="text-lg font-bold text-white">
                {formatDuration(activeStudying.totalTimeSpentMinutes)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Progress</p>
              <p className="text-lg font-bold text-white">
                {Math.round(activeStudying.percentage)}%
              </p>
            </div>
          </div>

          {activeStudying.sessionTotalPages > 0 && (
            <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${activeStudying.percentage}%` }}
              />
            </div>
          )}
        </Link>
      )}

      {/* Today's Activity Bar */}
      {todayStats && (todayStats.pagesRead > 0 || todayStats.minutesStudied > 0) && (
        <div className="mb-6 bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-yellow-400" />
            <h3 className="font-semibold text-white text-sm">Today</h3>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Timer className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-sm text-gray-300">
                {formatDuration(todayStats.minutesStudied)}{" "}
                <span className="text-gray-500">studied</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-green-400" />
              <span className="text-sm text-gray-300">
                {todayStats.pagesRead}{" "}
                <span className="text-gray-500">pages</span>
              </span>
            </div>
            {todayStats.sessionsCompleted > 0 && (
              <div className="flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-sm text-gray-300">
                  {todayStats.sessionsCompleted}{" "}
                  <span className="text-gray-500">
                    session{todayStats.sessionsCompleted !== 1 ? "s" : ""}{" "}
                    completed
                  </span>
                </span>
              </div>
            )}
            {todayStats.quizzesTaken > 0 && (
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-sm text-gray-300">
                  {todayStats.quizzesTaken}{" "}
                  <span className="text-gray-500">
                    quiz{todayStats.quizzesTaken !== 1 ? "zes" : ""}
                  </span>
                  {todayStats.averageScore != null && (
                    <span className="text-gray-500">
                      {" "}
                      ({Math.round(todayStats.averageScore)}% avg)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Flame}
          label="Day Streak"
          value={stats?.currentStreak ?? 0}
          sub={
            (stats?.longestStreak ?? 0) > 0
              ? `Best: ${stats?.longestStreak} days`
              : "Keep it up!"
          }
          color="yellow"
        />
        <StatCard
          icon={Clock}
          label="Total Hours"
          value={formatDuration(stats?.totalTimeMinutes ?? 0)}
          sub={`${stats?.totalSessionsCompleted ?? 0} sessions completed`}
          color="indigo"
        />
        <StatCard
          icon={BookOpen}
          label="Pages Read"
          value={stats?.totalPagesRead ?? 0}
          sub="All time"
          color="green"
        />
        <StatCard
          icon={Brain}
          label="Avg Quiz Score"
          value={`${Math.round(stats?.averageQuizScore ?? 0)}%`}
          sub={`${stats?.totalQuizzesAttempted ?? 0} quizzes taken`}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity chart */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">
            Activity (last 14 days)
          </h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient
                    id="minutesGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="pagesGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#f9fafb",
                  }}
                  formatter={(v: number, name: string) => [
                    name === "minutes" ? `${v} min` : `${v} pages`,
                    name === "minutes" ? "Study time" : "Pages read",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#minutesGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="pages"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  fill="url(#pagesGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
              No activity data yet. Start a study session!
            </div>
          )}
        </div>

        {/* Weekly goal & revision */}
        <div className="space-y-4">
          {/* Weekly goal */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-indigo-400" />
              <h3 className="font-semibold text-white text-sm">Weekly Goal</h3>
            </div>
            <div className="flex items-end justify-between mb-2">
              <span className="text-2xl font-bold text-white">
                {Math.round(weeklyProgress)}%
              </span>
              <span className="text-xs text-gray-400">
                {formatDuration(stats?.weeklyMinutesThisWeek ?? 0)} /{" "}
                {formatDuration(stats?.weeklyGoalMinutes ?? 300)}
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${weeklyProgress}%` }}
              />
            </div>
          </div>

          {/* Revision due */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <h3 className="font-semibold text-white text-sm">
                  Revision Due
                </h3>
              </div>
              <Link
                to="/revision"
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                View all
              </Link>
            </div>
            {dueRevisions > 0 ? (
              <>
                <div className="text-3xl font-bold text-white mb-1">
                  {dueRevisions}
                </div>
                <p className="text-sm text-gray-400">
                  topics need your attention
                </p>
                <Link
                  to="/revision"
                  className="mt-3 flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 font-medium"
                >
                  Start revision
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </>
            ) : (
              <p className="text-sm text-gray-500">All caught up!</p>
            )}
          </div>
        </div>
      </div>

      {/* Join a Session */}
      <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-indigo-400" />
          <h2 className="font-semibold text-white">Join a Session</h2>
        </div>

        {/* Invite code input */}
        <div className="flex gap-2 mb-5">
          <input
            type="text"
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
            placeholder="Enter invite code"
            maxLength={6}
            className="flex-1 bg-gray-800 border border-gray-700 focus:border-indigo-500 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors tracking-widest uppercase font-mono"
          />
          <button
            onClick={handleJoinByCode}
            disabled={!inviteCodeInput.trim() || isJoining}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            {isJoining ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            Join
          </button>
        </div>

        {/* Public sessions */}
        {publicSessions && publicSessions.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Globe className="w-3.5 h-3.5 text-gray-500" />
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Public Sessions
              </p>
            </div>
            <div className="space-y-2">
              {publicSessions.slice(0, 4).map((s) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 group"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white truncate">
                      {s.title}
                    </h4>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-green-400">active</span>
                      {s.topics.length > 0 && (
                        <span className="text-xs text-gray-500 truncate">
                          {s.topics.slice(0, 2).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoinPublic(s._id)}
                    disabled={isJoining}
                    className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-600/30 text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ml-3"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Join
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!publicSessions || publicSessions.length === 0) && (
          <p className="text-sm text-gray-500">
            No public sessions available right now. Use an invite code to join a
            private session.
          </p>
        )}
      </div>

      {/* Recent sessions */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Recent Sessions</h2>
          <Link
            to="/history"
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            View all
          </Link>
        </div>

        {recentSessions.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
            <BookOpen className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">No study sessions yet</p>
            <Link
              to="/sessions/new"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create your first session
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentSessions.map(({ session, membership }) => (
              <Link
                key={session._id}
                to={`/sessions/${session._id}`}
                className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-white group-hover:text-indigo-400 transition-colors truncate">
                        {session.title}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                          session.status === "active"
                            ? "bg-green-600/20 text-green-400"
                            : session.status === "scheduled"
                              ? "bg-blue-600/20 text-blue-400"
                              : session.status === "paused"
                                ? "bg-yellow-600/20 text-yellow-400"
                                : session.status === "completed"
                                  ? "bg-gray-700 text-gray-400"
                                  : "bg-red-600/20 text-red-400"
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(session.scheduledStart)}
                      </span>
                      {session.topics.length > 0 && (
                        <span className="text-xs text-gray-500">
                          {session.topics.slice(0, 2).join(", ")}
                          {session.topics.length > 2 &&
                            ` +${session.topics.length - 2}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pause confirmation modal */}
      {showPauseModal && myActiveCreatedSession && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
            <div className="w-10 h-10 bg-yellow-600/20 rounded-xl flex items-center justify-center mb-4">
              <Pause className="w-5 h-5 text-yellow-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Pause your active session?
            </h3>
            <p className="text-sm text-gray-400 mb-1">
              You're currently hosting{" "}
              <span className="text-white font-medium">
                {myActiveCreatedSession.title}
              </span>
              .
            </p>
            <p className="text-sm text-gray-400 mb-6">
              To join another session, your current session will be paused. You
              can resume it anytime.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelJoin}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePauseAndJoin}
                disabled={isJoining}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                {isJoining ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Pause className="w-4 h-4" />
                )}
                Pause & Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
