import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Clock,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Image,
  Timer,
  Target,
  Loader2,
} from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";

interface Props {
  sessionId: Id<"studySessions">;
}

function MemberMarker({
  member,
  totalPages,
  isTimeline,
}: {
  member: {
    userName: string;
    userImage?: string;
    avatarColor: string;
    globalPosition: number;
    percentComplete: number;
    isMe: boolean;
    status: string;
    latestCheckInStatus: string | null;
  };
  totalPages: number;
  isTimeline: boolean;
}) {
  const pct =
    totalPages > 0
      ? Math.min(100, (member.globalPosition / totalPages) * 100)
      : 0;

  const initials = member.userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const checkInIcon =
    member.latestCheckInStatus === "struggling" ? (
      <TrendingDown className="w-2.5 h-2.5 text-yellow-400" />
    ) : member.latestCheckInStatus === "ahead" ? (
      <TrendingUp className="w-2.5 h-2.5 text-green-400" />
    ) : member.latestCheckInStatus === "on_track" ? (
      <Minus className="w-2.5 h-2.5 text-blue-400" />
    ) : null;

  if (!isTimeline) return null;

  return (
    <div
      className="absolute -top-1 flex flex-col items-center transition-all duration-700 ease-out z-10"
      style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
    >
      <div className="relative group">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 shadow-lg cursor-default",
            member.isMe ? "ring-indigo-400" : "ring-gray-700"
          )}
          style={{
            background: member.userImage
              ? undefined
              : `linear-gradient(135deg, ${member.avatarColor}, ${member.avatarColor}dd)`,
          }}
        >
          {member.userImage ? (
            <img
              src={member.userImage}
              alt={member.userName}
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        {checkInIcon && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
            {checkInIcon}
          </div>
        )}

        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-800 border border-gray-700 text-xs text-gray-200 px-2.5 py-1.5 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          <span className="font-medium">{member.userName}</span>
          {member.isMe && (
            <span className="text-indigo-400 ml-1">(you)</span>
          )}
          <span className="text-gray-500 ml-1.5">
            pg {member.globalPosition}
          </span>
        </div>
      </div>
      <div
        className={cn(
          "w-0.5 h-3 mt-0.5 rounded-full",
          member.isMe ? "bg-indigo-400" : "bg-gray-600"
        )}
      />
    </div>
  );
}

function SoloProgressView({
  member,
  totalPages,
  elapsedMinutes,
  scheduledEnd,
  materialSegments,
}: {
  member: {
    userName: string;
    totalPagesRead: number;
    percentComplete: number;
    estimatedMinRemaining: number;
    speedMinPerPage: number;
    totalTimeSpentSeconds: number;
    currentPage: number;
    currentMaterialId?: Id<"materials"> | null;
    progressPerMaterial: Array<{
      materialId: Id<"materials">;
      currentPage: number;
      totalPages: number;
      pagesVisited: number;
      completedAt?: number;
    }>;
  };
  totalPages: number;
  elapsedMinutes: number;
  scheduledEnd: number;
  materialSegments: Array<{
    _id: Id<"materials">;
    title: string;
    type: string;
    totalPages: number;
  }>;
}) {
  const timeRemainingMs = scheduledEnd - Date.now();
  const sessionTimeRemainingMin = Math.max(0, timeRemainingMs / 60000);
  const willFinishOnTime =
    member.estimatedMinRemaining <= sessionTimeRemainingMin;

  return (
    <div className="p-4 space-y-5">
      {/* Progress ring + stats */}
      <div className="flex items-center gap-5">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              strokeWidth="6"
              className="stroke-gray-800"
            />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className="stroke-indigo-500 transition-all duration-700"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - member.percentComplete / 100)}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white">
              {Math.round(member.percentComplete)}%
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Pages Read</span>
            <span className="text-sm font-medium text-white tabular-nums">
              {member.totalPagesRead} / {totalPages}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Time Spent</span>
            <span className="text-sm font-medium text-white">
              {formatDuration(member.totalTimeSpentSeconds / 60)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Speed</span>
            <span className="text-sm font-medium text-white">
              {member.speedMinPerPage} min/page
            </span>
          </div>
        </div>
      </div>

      {/* Time estimate */}
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-xl border",
          willFinishOnTime
            ? "border-green-600/30 bg-green-600/5"
            : "border-yellow-600/30 bg-yellow-600/5"
        )}
      >
        <Timer
          className={cn(
            "w-5 h-5 shrink-0",
            willFinishOnTime ? "text-green-400" : "text-yellow-400"
          )}
        />
        <div>
          <p
            className={cn(
              "text-sm font-medium",
              willFinishOnTime ? "text-green-400" : "text-yellow-400"
            )}
          >
            {member.estimatedMinRemaining > 0
              ? `~${formatDuration(member.estimatedMinRemaining)} remaining`
              : "Complete!"}
          </p>
          <p className="text-xs text-gray-500">
            {willFinishOnTime
              ? `Session time left: ${formatDuration(sessionTimeRemainingMin)}`
              : `Need ${formatDuration(member.estimatedMinRemaining - sessionTimeRemainingMin)} more than session allows`}
          </p>
        </div>
      </div>

      {/* Per-material breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Material Progress
        </p>
        {materialSegments.map((mat) => {
          const prog = member.progressPerMaterial.find(
            (p) => p.materialId === mat._id
          );
          const pagesRead = prog?.pagesVisited ?? 0;
          const pct =
            mat.totalPages > 0 ? (pagesRead / mat.totalPages) * 100 : 0;
          const isComplete = !!prog?.completedAt;

          return (
            <div
              key={mat._id}
              className="p-3 rounded-xl border border-gray-800 bg-gray-800/30"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {mat.type === "image" ? (
                    <Image className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  )}
                  <span className="text-sm text-white truncate">
                    {mat.title}
                  </span>
                </div>
                <span className="text-xs text-gray-500 tabular-nums shrink-0 ml-2">
                  {pagesRead}/{mat.totalPages}
                </span>
              </div>
              <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isComplete ? "bg-green-500" : "bg-indigo-500"
                  )}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProgressTimeline({ sessionId }: Props) {
  const timeline = useQuery(api.progress.getTimelineData, { sessionId });

  if (!timeline) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
      </div>
    );
  }

  const {
    sessionTotalPages,
    elapsedMinutes,
    scheduledEnd,
    materialSegments,
    materialOffsets,
    members,
    isSolo,
  } = timeline;

  if (sessionTotalPages === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <BookOpen className="w-10 h-10 text-gray-700 mb-3" />
        <p className="text-sm text-gray-400">No materials uploaded yet</p>
        <p className="text-xs text-gray-600 mt-1">
          Upload documents to track progress
        </p>
      </div>
    );
  }

  const me = members.find((m) => m.isMe);

  if (isSolo && me) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-400" />
            My Progress
          </h3>
        </div>
        <SoloProgressView
          member={me}
          totalPages={sessionTotalPages}
          elapsedMinutes={elapsedMinutes}
          scheduledEnd={scheduledEnd}
          materialSegments={materialSegments}
        />
      </div>
    );
  }

  const sortedMembers = [...members].sort((a, b) => {
    if (a.isMe) return -1;
    if (b.isMe) return 1;
    return b.globalPosition - a.globalPosition;
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-400" />
          Session Timeline
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {sessionTotalPages} total pages across {materialSegments.length}{" "}
          {materialSegments.length === 1 ? "document" : "documents"}
        </p>
      </div>

      {/* Visual timeline bar */}
      <div className="px-4 pt-8 pb-4">
        <div className="relative">
          {/* Material segment backgrounds */}
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-800">
            {materialSegments.map((seg, i) => {
              const widthPct =
                sessionTotalPages > 0
                  ? (seg.totalPages / sessionTotalPages) * 100
                  : 0;
              return (
                <div
                  key={seg._id}
                  className={cn(
                    "h-full border-r border-gray-700/50 last:border-r-0",
                    i % 2 === 0 ? "bg-gray-750" : "bg-gray-800"
                  )}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor:
                      i % 2 === 0
                        ? "rgba(55, 65, 81, 0.6)"
                        : "rgba(31, 41, 55, 0.6)",
                  }}
                  title={`${seg.title} (${seg.totalPages} pages)`}
                />
              );
            })}
          </div>

          {/* Member position markers */}
          {sortedMembers.map((m) => (
            <MemberMarker
              key={m.userId}
              member={m}
              totalPages={sessionTotalPages}
              isTimeline={true}
            />
          ))}

          {/* Expected position marker */}
          {timeline.actualStart && (
            <div
              className="absolute top-0 h-3 border-l-2 border-dashed border-gray-500/40 transition-all duration-1000"
              style={{
                left: `${Math.min(100, sessionTotalPages > 0 ? ((elapsedMinutes / (members[0]?.speedMinPerPage ?? 3)) / sessionTotalPages) * 100 : 0)}%`,
              }}
              title="Expected position"
            />
          )}
        </div>

        {/* Material labels under timeline */}
        <div className="flex mt-1.5">
          {materialSegments.map((seg) => {
            const widthPct =
              sessionTotalPages > 0
                ? (seg.totalPages / sessionTotalPages) * 100
                : 0;
            return (
              <div
                key={seg._id}
                className="overflow-hidden"
                style={{ width: `${widthPct}%` }}
              >
                <p className="text-[10px] text-gray-600 truncate px-0.5">
                  {seg.title}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Member cards */}
      <div className="px-4 pb-4 space-y-2">
        {sortedMembers.map((m) => {
          const statusColor =
            m.latestCheckInStatus === "struggling"
              ? "border-yellow-600/30 bg-yellow-600/5"
              : m.latestCheckInStatus === "ahead"
                ? "border-green-600/30 bg-green-600/5"
                : "border-gray-800 bg-gray-800/30";

          const initials = m.userName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          const currentMat = materialSegments.find(
            (s) => s._id === m.currentMaterialId
          );

          return (
            <div
              key={m.userId}
              className={cn(
                "p-3 rounded-xl border transition-all",
                m.isMe ? "border-indigo-500/20 bg-indigo-500/5" : statusColor
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{
                    background: m.userImage
                      ? undefined
                      : `linear-gradient(135deg, ${m.avatarColor}, ${m.avatarColor}dd)`,
                  }}
                >
                  {m.userImage ? (
                    <img
                      src={m.userImage}
                      alt={m.userName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white truncate">
                      {m.userName}
                    </span>
                    {m.isMe && (
                      <span className="text-[10px] text-indigo-400/80 font-medium bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        you
                      </span>
                    )}
                    {m.latestCheckInStatus === "struggling" && (
                      <TrendingDown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    )}
                    {m.latestCheckInStatus === "ahead" && (
                      <TrendingUp className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                    {currentMat && (
                      <span className="truncate max-w-[120px]">
                        {currentMat.title}
                      </span>
                    )}
                    {currentMat && <span className="text-gray-700">·</span>}
                    <span className="tabular-nums">
                      pg {m.currentPage} of {sessionTotalPages}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-white tabular-nums">
                    {Math.round(m.percentComplete)}%
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <Clock className="w-3 h-3" />
                    {m.estimatedMinRemaining > 0
                      ? formatDuration(m.estimatedMinRemaining)
                      : "Done"}
                  </div>
                </div>
              </div>

              {/* Mini progress bar */}
              <div className="mt-2 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.min(100, m.percentComplete)}%`,
                    background: `linear-gradient(90deg, ${m.avatarColor}, ${m.avatarColor}cc)`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
