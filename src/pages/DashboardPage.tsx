import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Clock,
  BookOpen,
  Brain,
  BarChart3,
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

  const joinByInviteCode = useMutation(api.sessions.joinByInviteCode);
  const joinPublicSession = useMutation(api.sessions.joinPublicSession);
  const pauseSession = useMutation(api.sessions.pauseSession);

  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pendingJoinAction, setPendingJoinAction] = useState<(() => Promise<void>) | null>(null);

  const recentSessions = (sessions?.slice(0, 5) ?? []).filter(
    (s): s is NonNullable<typeof s> => s !== null
  );
  const dueRevisions = revisionQueue?.length ?? 0;

  const chartData =
    activityLog?.map((log) => ({
      date: log.date.slice(5),
      minutes: log.minutesStudied,
      pages: log.pagesRead,
    })) ?? [];

  const weeklyProgress = stats
    ? Math.min(
        100,
        ((stats.weeklyMinutesThisWeek ?? 0) / (stats.weeklyGoalMinutes || 300)) *
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

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Flame}
          label="Day Streak"
          value={stats?.currentStreak ?? 0}
          sub="Keep it up!"
          color="yellow"
        />
        <StatCard
          icon={Clock}
          label="Total Hours"
          value={formatDuration(stats?.totalTimeMinutes ?? 0)}
          sub="Study time"
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
                  <linearGradient id="minutesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
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
                  formatter={(v) => [`${v} min`, "Study time"]}
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#minutesGrad)"
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
              <p className="text-sm text-gray-500">All caught up! 🎉</p>
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
