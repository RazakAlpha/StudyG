import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  Clock,
  Users,
  Brain,
  Plus,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useState } from "react";
import { formatDate, formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "completed" | "active" | "paused" | "scheduled" | "cancelled";

export default function SessionHistoryPage() {
  const sessions = useQuery(api.sessions.getMySessions);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = sessions
    ?.filter((s): s is NonNullable<typeof s> => s !== null)
    .filter(({ session }) =>
      statusFilter === "all" ? true : session.status === statusFilter
    );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Session History</h1>
          <p className="text-gray-400 mt-1">
            All your study sessions in one place.
          </p>
        </div>
        <Link
          to="/sessions/new"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Session
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(
          ["all", "active", "paused", "scheduled", "completed", "cancelled"] as const
        ).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              statusFilter === s
                ? "bg-indigo-600 text-white"
                : "bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700"
            )}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" &&
              sessions &&
              ` (${sessions.filter((x): x is NonNullable<typeof x> => x !== null && x.session.status === s).length})`}
          </button>
        ))}
      </div>

      {!filtered || filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-4">
            {statusFilter === "all"
              ? "No study sessions yet"
              : `No ${statusFilter} sessions`}
          </p>
          {statusFilter === "all" && (
            <Link
              to="/sessions/new"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create your first session
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ session, membership }) => {
            const duration =
              session.actualStart && session.actualEnd
                ? (session.actualEnd - session.actualStart) / 60000
                : null;

            return (
              <Link
                key={session._id}
                to={`/sessions/${session._id}`}
                className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                        {session.title}
                      </h3>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full shrink-0",
                          session.status === "active"
                            ? "bg-green-600/20 text-green-400"
                            : session.status === "scheduled"
                              ? "bg-blue-600/20 text-blue-400"
                              : session.status === "paused"
                                ? "bg-yellow-600/20 text-yellow-400"
                                : session.status === "completed"
                                  ? "bg-gray-700 text-gray-400"
                                  : "bg-red-600/20 text-red-400"
                        )}
                      >
                        {session.status}
                      </span>
                      {membership.role === "host" && (
                        <span className="text-xs bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded-full shrink-0">
                          Host
                        </span>
                      )}
                    </div>

                    {session.description && (
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                        {session.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(session.scheduledStart)}
                      </span>
                      {duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(duration)}
                        </span>
                      )}
                      {session.topics.length > 0 && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {session.topics.slice(0, 2).join(", ")}
                          {session.topics.length > 2 &&
                            ` +${session.topics.length - 2}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
