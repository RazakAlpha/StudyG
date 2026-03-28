import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  MessageSquare,
  Plus,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/hooks/useAuthSession";
import AnnotationsPanel from "@/components/annotations/AnnotationsPanel";

interface Props {
  materialId: Id<"materials">;
  sessionId: Id<"studySessions">;
  defaultSpeed: number;
  sessionStatus: string;
}

export default function MaterialViewer({
  materialId,
  sessionId,
  defaultSpeed,
  sessionStatus,
}: Props) {
  const { user } = useAuthSession();

  const material = useQuery(api.materials.getMaterials, { sessionId });
  const materialData = material?.find((m) => m._id === materialId);
  const urlData = useQuery(
    api.materials.getMaterialUrl,
    materialData ? { storageId: materialData.storageId } : "skip"
  );
  const annotations = useQuery(api.annotations.getMaterialAnnotations, {
    materialId,
    sessionId,
  });
  const updateProgress = useMutation(api.progress.updateProgress);
  const myProgress = useQuery(api.progress.getMyProgress, { sessionId });

  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [addAnnotationPage, setAddAnnotationPage] = useState<number | null>(
    null
  );

  const rawTotalPages = materialData?.totalPages ?? 1;
  const startPage = materialData?.startPage;
  const endPage = materialData?.endPage;
  const hasRange = startPage != null && endPage != null;
  const effectiveTotal = hasRange
    ? Math.max(1, Math.min(endPage, rawTotalPages) - Math.max(1, startPage) + 1)
    : rawTotalPages;
  const pageOffset = hasRange ? Math.max(1, startPage) - 1 : 0;

  const totalPages = effectiveTotal;
  const progressForMaterial = myProgress?.find(
    (p) => p.materialId === materialId
  );

  const toAbsolutePage = (local: number) => local + pageOffset;

  const saveProgress = useCallback(
    async (page: number) => {
      if (!sessionStatus || sessionStatus !== "active") return;
      try {
        await updateProgress({
          sessionId,
          materialId,
          currentPage: page,
          totalPages,
        });
      } catch {}
    },
    [sessionId, materialId, totalPages, sessionStatus, updateProgress]
  );

  useEffect(() => {
    if (progressForMaterial?.currentPage) {
      setCurrentPage(progressForMaterial.currentPage);
    }
  }, [materialId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveProgress(currentPage);
    }, 2000);
    return () => clearTimeout(timer);
  }, [currentPage, saveProgress]);

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  }

  const absolutePage = toAbsolutePage(currentPage);
  const pageAnnotations = annotations?.filter((a) => a.page === absolutePage) ?? [];

  if (!materialData) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  const estTimeRemaining = defaultSpeed * (totalPages - currentPage);

  return (
    <div className="flex h-full">
      {/* Viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors text-gray-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <input
                type="number"
                value={currentPage}
                onChange={(e) => goToPage(Number(e.target.value))}
                min={1}
                max={totalPages}
                className="w-12 bg-gray-800 text-center text-white text-sm px-2 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span>/ {totalPages}</span>
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors text-gray-400 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Page range indicator */}
            {hasRange && (
              <span className="hidden sm:inline text-xs text-amber-400/80 bg-amber-600/10 border border-amber-600/20 px-2 py-0.5 rounded-md">
                pp. {startPage}–{endPage}
              </span>
            )}

            {/* Estimated time */}
            {estTimeRemaining > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5" />
                ~{estTimeRemaining}m remaining
              </div>
            )}

            {/* Annotations toggle */}
            <button
              onClick={() => setShowAnnotations(!showAnnotations)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors",
                showAnnotations
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {pageAnnotations.length > 0 && (
                <span className="bg-indigo-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {pageAnnotations.length}
                </span>
              )}
            </button>

            {/* Add annotation */}
            <button
              onClick={() => setAddAnnotationPage(absolutePage)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Note
            </button>

            {/* Zoom */}
            <div className="hidden sm:flex items-center gap-1">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-gray-500 w-10 text-center">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-950 flex items-start justify-center p-6">
          <div
            style={{ width: `${zoom}%`, maxWidth: "900px" }}
            className="transition-all duration-200"
          >
            {urlData ? (
              materialData.type === "image" ? (
                <img
                  src={urlData}
                  alt={materialData.title}
                  className="w-full rounded-lg shadow-lg"
                />
              ) : materialData.type === "pdf" ? (
                <iframe
                  src={`${urlData}#page=${absolutePage}`}
                  className="w-full h-[80vh] rounded-lg border border-gray-800"
                  title={materialData.title}
                />
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 min-h-[60vh]">
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {materialData.extractedText ?? "Loading document content..."}
                  </p>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Annotations sidebar */}
      {showAnnotations && (
        <div className="w-72 border-l border-gray-800 bg-gray-900 flex flex-col shrink-0">
          <AnnotationsPanel
            materialId={materialId}
            sessionId={sessionId}
            currentPage={absolutePage}
            addAnnotationPage={addAnnotationPage}
            onAddClose={() => setAddAnnotationPage(null)}
          />
        </div>
      )}

      {/* Add annotation modal triggered inline */}
      {addAnnotationPage !== null && !showAnnotations && (
        <div className="w-72 border-l border-gray-800 bg-gray-900 flex flex-col shrink-0">
          <AnnotationsPanel
            materialId={materialId}
            sessionId={sessionId}
            currentPage={absolutePage}
            addAnnotationPage={addAnnotationPage}
            onAddClose={() => setAddAnnotationPage(null)}
          />
        </div>
      )}
    </div>
  );
}
