import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Globe, Lock, MessageSquare, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/hooks/useAuthSession";
import { formatRelative } from "@/lib/utils";

interface Props {
  materialId: Id<"materials">;
  sessionId: Id<"studySessions">;
  currentPage: number;
  addAnnotationPage: number | null;
  onAddClose: () => void;
}

export default function AnnotationsPanel({
  materialId,
  sessionId,
  currentPage,
  addAnnotationPage,
  onAddClose,
}: Props) {
  const { user } = useAuthSession();
  const annotations = useQuery(api.annotations.getPageAnnotations, {
    materialId,
    page: currentPage,
    sessionId,
  });
  const addAnnotation = useMutation(api.annotations.addAnnotation);
  const deleteAnnotation = useMutation(api.annotations.deleteAnnotation);

  const [newContent, setNewContent] = useState("");
  const [isShared, setIsShared] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const showAddForm = addAnnotationPage === currentPage;

  async function handleAdd() {
    if (!newContent.trim()) return;
    setIsAdding(true);
    try {
      await addAnnotation({
        materialId,
        sessionId,
        page: currentPage,
        content: newContent.trim(),
        isShared,
      });
      setNewContent("");
      onAddClose();
      toast.success("Note added!");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(annotationId: Id<"annotations">) {
    try {
      await deleteAnnotation({ annotationId });
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-white">
            Notes - Page {currentPage}
          </span>
        </div>
      </div>

      {/* Add note form */}
      {showAddForm && (
        <div className="p-4 border-b border-gray-800 bg-gray-800/50">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write your note..."
            rows={3}
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none mb-3"
          />
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsShared(!isShared)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors",
                isShared
                  ? "bg-green-600/20 text-green-400"
                  : "bg-gray-700 text-gray-400"
              )}
            >
              {isShared ? (
                <Globe className="w-3 h-3" />
              ) : (
                <Lock className="w-3 h-3" />
              )}
              {isShared ? "Shared" : "Private"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={onAddClose}
                className="text-xs text-gray-400 hover:text-white px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newContent.trim() || isAdding}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                {isAdding ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Annotations list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!annotations || annotations.length === 0 ? (
          <div className="text-center text-gray-600 text-sm py-8">
            No notes on this page yet
          </div>
        ) : (
          annotations.map((a) => (
            <div
              key={a._id}
              className="p-3 rounded-xl border border-gray-800 bg-gray-800/30"
              style={{ borderLeftColor: a.color ?? "#6366f1", borderLeftWidth: 3 }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-300">
                    {a.userName}
                  </span>
                  {a.isShared ? (
                    <Globe className="w-3 h-3 text-gray-500" />
                  ) : (
                    <Lock className="w-3 h-3 text-gray-500" />
                  )}
                </div>
                {a.userId === user?.id && (
                  <button
                    onClick={() => handleDelete(a._id)}
                    className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{a.content}</p>
              <span className="text-xs text-gray-600 mt-1 block">
                {formatRelative(a.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
