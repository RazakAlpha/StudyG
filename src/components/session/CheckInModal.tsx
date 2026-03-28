import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  TrendingUp,
  Minus,
  TrendingDown,
  FileText,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckIn {
  _id: Id<"checkIns">;
  sessionId: Id<"studySessions">;
  promptedAt: number;
  status: "pending" | "on_track" | "struggling" | "ahead";
}

interface Props {
  sessionId: Id<"studySessions">;
  checkIn: CheckIn;
}

const STATUS_OPTIONS = [
  {
    value: "ahead" as const,
    icon: TrendingUp,
    label: "Ahead of schedule",
    desc: "Moving faster than expected",
    color: "border-green-500 bg-green-600/10 text-green-400",
  },
  {
    value: "on_track" as const,
    icon: Minus,
    label: "On track",
    desc: "Progressing as planned",
    color: "border-blue-500 bg-blue-600/10 text-blue-400",
  },
  {
    value: "struggling" as const,
    icon: TrendingDown,
    label: "Struggling",
    desc: "Need more time or help",
    color: "border-yellow-500 bg-yellow-600/10 text-yellow-400",
  },
];

export default function CheckInModal({ sessionId, checkIn }: Props) {
  const respondToCheckIn = useMutation(api.checkIns.respondToCheckIn);
  const materials = useQuery(api.materials.getMaterials, { sessionId });

  const [selected, setSelected] = useState<
    "on_track" | "struggling" | "ahead" | null
  >(null);
  const [notes, setNotes] = useState("");
  const [currentPage, setCurrentPage] = useState<number | undefined>(undefined);
  const [selectedMaterialId, setSelectedMaterialId] = useState<
    Id<"materials"> | undefined
  >(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsPosition = selected === "struggling" || selected === "ahead";

  async function handleSubmit() {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      await respondToCheckIn({
        sessionId,
        status: selected,
        notes: notes.trim() || undefined,
        currentPage,
        currentMaterialId: selectedMaterialId,
      });
      toast.success("Check-in recorded!");
    } catch (err: any) {
      toast.error("Failed to submit check-in");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Progress Check-in</h2>
              <p className="text-xs text-gray-400">
                How's your studying going?
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {STATUS_OPTIONS.map(({ value, icon: Icon, label, desc, color }) => (
              <button
                key={value}
                onClick={() => setSelected(value)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
                  selected === value
                    ? color
                    : "border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <div>
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-xs opacity-70">{desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Position tracking for struggling/ahead */}
          {needsPosition && (
            <div className="mt-4 p-4 rounded-xl border border-gray-700 bg-gray-800/50 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-white">
                  {selected === "struggling"
                    ? "Where are you currently?"
                    : "What page are you on?"}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {selected === "struggling"
                  ? "This helps us understand where you need support"
                  : "This helps track your position for the group"}
              </p>

              {/* Material selector */}
              {materials && materials.length > 1 && (
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">
                    Current document
                  </label>
                  <div className="space-y-1.5">
                    {materials.map((m) => (
                      <button
                        key={m._id}
                        onClick={() => setSelectedMaterialId(m._id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors",
                          selectedMaterialId === m._id
                            ? "border-indigo-500/50 bg-indigo-600/10 text-indigo-300"
                            : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                        )}
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{m.title}</span>
                        {m.totalPages && (
                          <span className="text-xs text-gray-600 ml-auto shrink-0">
                            {m.totalPages} pg
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Page input */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">
                  Current page number
                </label>
                <input
                  type="number"
                  min={1}
                  value={currentPage ?? ""}
                  onChange={(e) =>
                    setCurrentPage(
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                  placeholder="e.g. 12"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          )}

          {selected && (
            <div className="mt-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  selected === "struggling"
                    ? "What are you struggling with? (optional)"
                    : "Add a note (optional)..."
                }
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!selected || isSubmitting}
            className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Submit Check-in"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
