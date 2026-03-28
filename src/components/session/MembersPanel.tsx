import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import { Clock, Settings, Crown, Zap, WifiOff, Timer } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";

interface Props {
  sessionId: Id<"studySessions">;
  currentUserId: string;
  defaultSpeed: number;
}

const STATUS_CONFIG = {
  active: {
    color: "bg-emerald-400",
    ring: "ring-emerald-400/30",
    label: "Online",
    pulse: true,
  },
  idle: {
    color: "bg-amber-400",
    ring: "ring-amber-400/30",
    label: "Idle",
    pulse: false,
  },
  away: {
    color: "bg-orange-400",
    ring: "ring-orange-400/30",
    label: "Away",
    pulse: false,
  },
  offline: {
    color: "bg-gray-500",
    ring: "ring-gray-500/30",
    label: "Offline",
    pulse: false,
  },
};

function MemberAvatar({
  name,
  image,
  color,
  status,
  size = "md",
  showStatus = true,
  ringGlow = false,
}: {
  name: string;
  image?: string;
  color: string;
  status: "active" | "idle" | "away" | "offline";
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
  ringGlow?: boolean;
}) {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-lg",
  };
  const statusSizeClasses = {
    sm: "w-2.5 h-2.5 border-[1.5px]",
    md: "w-3 h-3 border-2",
    lg: "w-4 h-4 border-2",
  };
  const statusConfig = STATUS_CONFIG[status];
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative inline-flex shrink-0">
      {ringGlow && status === "active" && (
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ backgroundColor: color }}
        />
      )}
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold ring-2 ring-transparent transition-all duration-300",
          sizeClasses[size],
          ringGlow && status === "active" && "ring-2",
          ringGlow && status === "active" && statusConfig.ring
        )}
        style={{
          background: image
            ? undefined
            : `linear-gradient(135deg, ${color}, ${color}dd)`,
        }}
      >
        {image ? (
          <img
            src={image}
            alt={name}
            className={cn("rounded-full object-cover", sizeClasses[size])}
          />
        ) : (
          <span className="text-white drop-shadow-sm">{initials}</span>
        )}
      </div>
      {showStatus && (
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full border-gray-900",
            statusSizeClasses[size],
            statusConfig.color
          )}
        >
          {statusConfig.pulse && (
            <span
              className={cn(
                "absolute inset-0 rounded-full animate-ping opacity-75",
                statusConfig.color
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}

function AvatarStack({
  members,
}: {
  members: Array<{
    _id: string;
    userName: string;
    userImage?: string;
    avatarColor: string;
    status: "active" | "idle" | "away" | "offline";
  }>;
}) {
  const onlineCount = members.filter((m) => m.status === "active").length;
  const displayMembers = members.slice(0, 8);
  const overflow = members.length - displayMembers.length;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex -space-x-2.5">
        {displayMembers.map((member) => (
          <div
            key={member._id}
            className="relative transition-transform hover:scale-110 hover:z-10"
            title={member.userName}
          >
            <MemberAvatar
              name={member.userName}
              image={member.userImage}
              color={member.avatarColor}
              status={member.status}
              size="sm"
              showStatus={false}
            />
          </div>
        ))}
        {overflow > 0 && (
          <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-xs font-medium text-gray-300">
            +{overflow}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-xs font-medium text-emerald-400">
            {onlineCount}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          / {members.length} online
        </span>
      </div>
    </div>
  );
}

export default function MembersPanel({
  sessionId,
  currentUserId,
  defaultSpeed,
}: Props) {
  const members = useQuery(api.sessions.getSessionMembers, { sessionId });
  const allProgress = useQuery(api.progress.getAllProgress, { sessionId });
  const sessionData = useQuery(api.sessions.getMySession, { sessionId });
  const updateSpeed = useMutation(api.sessions.updateMySpeed);

  const [editingSpeed, setEditingSpeed] = useState(false);
  const [speed, setSpeed] = useState(defaultSpeed);

  const session = sessionData?.session;
  const sessionTotalPages = session?.totalPages ?? 0;

  async function handleSaveSpeed() {
    try {
      await updateSpeed({ sessionId, speedMinPerPage: speed });
      setEditingSpeed(false);
      toast.success("Speed updated!");
    } catch {
      toast.error("Failed to update speed");
    }
  }

  const progressByUser = Object.fromEntries(
    (allProgress ?? []).map((p) => [p.userId, p])
  );

  const sortedMembers = [...(members ?? [])].sort((a, b) => {
    const statusOrder = { active: 0, idle: 1, away: 2, offline: 3 };
    if (a.role === "host" && b.role !== "host") return -1;
    if (b.role === "host" && a.role !== "host") return 1;
    return statusOrder[a.status] - statusOrder[b.status];
  });

  const recentJoinThreshold = Date.now() - 5 * 60 * 1000;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Avatar stack header */}
      {sortedMembers.length > 0 && (
        <div className="border-b border-gray-800 bg-gradient-to-b from-gray-800/50 to-transparent">
          <AvatarStack
            members={sortedMembers.map((m) => ({
              _id: m._id,
              userName: m.userName,
              userImage: m.userImage,
              avatarColor: m.avatarColor ?? "#6366F1",
              status: m.status,
            }))}
          />
        </div>
      )}

      {/* My speed setting */}
      <div className="px-4 pt-3 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            My Reading Speed
          </span>
          <button
            onClick={() => setEditingSpeed(!editingSpeed)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {editingSpeed ? (
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={15}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-sm text-white w-16 text-right">
              {speed} min/pg
            </span>
            <button
              onClick={handleSaveSpeed}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            {speed} min per page
          </div>
        )}
      </div>

      {/* Members list */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between px-1 mb-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Study Group
          </p>
          <span className="text-xs text-gray-600 tabular-nums">
            {members?.length ?? 0} members
          </span>
        </div>

        {sortedMembers.map((member) => {
          const progress = progressByUser[member.userId];
          const isMe = member.userId === currentUserId;
          const isRecentJoin = member.joinedAt > recentJoinThreshold;
          const statusConfig = STATUS_CONFIG[member.status];
          const avatarColor = member.avatarColor ?? "#6366F1";

          const totalMaterialPages =
            progress?.progress.reduce(
              (s: number, p: any) => s + p.totalPages,
              0
            ) ?? 0;
          const pagesRead = progress?.totalPagesRead ?? 0;
          const remainingPages = Math.max(
            0,
            (sessionTotalPages || totalMaterialPages) - pagesRead
          );
          const etaMinutes = remainingPages * member.speedMinPerPage;

          return (
            <div
              key={member._id}
              className={cn(
                "group p-3 rounded-xl border transition-all duration-300",
                isMe
                  ? "border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10"
                  : "border-gray-800/60 bg-gray-800/20 hover:bg-gray-800/40 hover:border-gray-700/60"
              )}
            >
              <div className="flex items-center gap-3">
                <MemberAvatar
                  name={member.userName}
                  image={member.userImage}
                  color={avatarColor}
                  status={member.status}
                  size="md"
                  ringGlow={member.status === "active"}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white truncate">
                      {member.userName}
                    </span>
                    {isMe && (
                      <span className="text-[10px] text-indigo-400/80 font-medium bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        you
                      </span>
                    )}
                    {member.role === "host" && (
                      <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    {isRecentJoin && (
                      <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded animate-pulse">
                        new
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-1">
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          statusConfig.color
                        )}
                      />
                      <span className="text-[11px] text-gray-500">
                        {statusConfig.label}
                      </span>
                    </div>
                    <span className="text-gray-700">·</span>
                    <div className="flex items-center gap-0.5">
                      <Zap className="w-3 h-3 text-gray-600" />
                      <span className="text-[11px] text-gray-500">
                        {member.speedMinPerPage}m/pg
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress bar + ETA */}
              {progress && progress.totalPagesRead > 0 && (
                <div className="mt-2.5 ml-[52px]">
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                    <span>Page {member.currentPage}</span>
                    <span className="tabular-nums">
                      {progress.totalPagesRead} pages read
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.min(100, (progress.totalPagesRead / (totalMaterialPages || 1)) * 100)}%`,
                        background: `linear-gradient(90deg, ${avatarColor}, ${avatarColor}cc)`,
                      }}
                    />
                  </div>
                  {etaMinutes > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-600">
                      <Timer className="w-3 h-3" />
                      <span>~{formatDuration(etaMinutes)} left</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {(!members || members.length === 0) && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3">
              <WifiOff className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-sm text-gray-500">No members yet</p>
            <p className="text-xs text-gray-600 mt-1">
              Share the invite code to add people
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
