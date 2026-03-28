import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  Upload,
  File,
  Image,
  X,
  Loader2,
  Check,
  Library,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: Id<"studySessions">;
  onSuccess?: () => void;
}

interface UploadFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  title: string;
  pages: string;
  startPage: string;
  endPage: string;
}

type Tab = "upload" | "library";

export default function MaterialUpload({ sessionId, onSuccess }: Props) {
  const generateUploadUrl = useMutation(api.materials.generateUploadUrl);
  const saveMaterial = useMutation(api.materials.saveMaterial);
  const addExistingMaterial = useMutation(api.materials.addExistingMaterial);
  const myFiles = useQuery(api.materials.getMyUploadedFiles);

  const [tab, setTab] = useState<Tab>("upload");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Library state
  const [selectedFile, setSelectedFile] = useState<NonNullable<typeof myFiles>[0] | null>(
    null
  );
  const [libTitle, setLibTitle] = useState("");
  const [libStartPage, setLibStartPage] = useState("");
  const [libEndPage, setLibEndPage] = useState("");
  const [isAddingExisting, setIsAddingExisting] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      status: "pending" as const,
      title: f.name.replace(/\.[^.]+$/, ""),
      pages: "1",
      startPage: "",
      endPage: "",
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
    },
    maxSize: 20 * 1024 * 1024,
  });

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function updateFile(id: string, updates: Partial<UploadFile>) {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  }

  async function handleUpload() {
    const pending = files.filter((f) => f.status === "pending");
    if (pending.length === 0) return;

    setIsUploading(true);

    for (const uploadFile of pending) {
      updateFile(uploadFile.id, { status: "uploading" });
      try {
        const uploadUrl = await generateUploadUrl();

        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": uploadFile.file.type },
          body: uploadFile.file,
        });

        if (!response.ok) throw new Error("Upload failed");

        const { storageId } = await response.json();

        const type = uploadFile.file.type.startsWith("image/")
          ? "image"
          : uploadFile.file.type === "application/pdf"
            ? "pdf"
            : "document";

        const totalPages = parseInt(uploadFile.pages) || 1;
        const sp = parseInt(uploadFile.startPage);
        const ep = parseInt(uploadFile.endPage);

        await saveMaterial({
          sessionId,
          title: uploadFile.title || uploadFile.file.name,
          type,
          storageId,
          mimeType: uploadFile.file.type,
          totalPages,
          startPage: sp && sp >= 1 ? sp : undefined,
          endPage: ep && ep >= 1 ? ep : undefined,
        });

        updateFile(uploadFile.id, { status: "done" });
      } catch (err) {
        updateFile(uploadFile.id, { status: "error" });
        toast.error(`Failed to upload ${uploadFile.file.name}`);
      }
    }

    setIsUploading(false);

    if (files.filter((f) => f.status === "done").length > 0) {
      onSuccess?.();
    }
  }

  async function handleAddExisting() {
    if (!selectedFile) return;
    setIsAddingExisting(true);
    try {
      const sp = parseInt(libStartPage);
      const ep = parseInt(libEndPage);

      await addExistingMaterial({
        sessionId,
        storageId: selectedFile.storageId as Id<"_storage">,
        title: libTitle || selectedFile.title,
        type: selectedFile.type as "document" | "image" | "pdf",
        mimeType: selectedFile.mimeType,
        totalPages: selectedFile.totalPages,
        startPage: sp && sp >= 1 ? sp : undefined,
        endPage: ep && ep >= 1 ? ep : undefined,
      });

      toast.success("Material added!");
      setSelectedFile(null);
      setLibTitle("");
      setLibStartPage("");
      setLibEndPage("");
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add material");
    } finally {
      setIsAddingExisting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex rounded-xl bg-gray-800 p-1">
        <button
          onClick={() => setTab("upload")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors",
            tab === "upload"
              ? "bg-indigo-600 text-white"
              : "text-gray-400 hover:text-white"
          )}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload New
        </button>
        <button
          onClick={() => setTab("library")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors",
            tab === "library"
              ? "bg-indigo-600 text-white"
              : "text-gray-400 hover:text-white"
          )}
        >
          <Library className="w-3.5 h-3.5" />
          My Files
        </button>
      </div>

      {tab === "upload" && (
        <>
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
              isDragActive
                ? "border-indigo-500 bg-indigo-600/10"
                : "border-gray-700 hover:border-gray-600"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {isDragActive
                ? "Drop files here..."
                : "Drag & drop files, or click to browse"}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Images, PDFs, text files up to 20MB
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="p-3 bg-gray-800 rounded-xl space-y-2"
                >
                  <div className="flex items-center gap-3">
                    {f.file.type.startsWith("image/") ? (
                      <Image className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <File className="w-4 h-4 text-indigo-400 shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={f.title}
                        onChange={(e) =>
                          updateFile(f.id, { title: e.target.value })
                        }
                        disabled={f.status !== "pending"}
                        className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {f.status === "uploading" && (
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      )}
                      {f.status === "done" && (
                        <Check className="w-4 h-4 text-green-400" />
                      )}
                      {f.status === "error" && (
                        <span className="text-xs text-red-400">Failed</span>
                      )}
                      {f.status === "pending" && (
                        <button
                          onClick={() => removeFile(f.id)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {f.status === "pending" && (
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">Total pages:</span>
                        <input
                          type="number"
                          value={f.pages}
                          onChange={(e) =>
                            updateFile(f.id, { pages: e.target.value })
                          }
                          min={1}
                          className="w-14 bg-gray-700 text-white px-2 py-0.5 rounded focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">From:</span>
                        <input
                          type="number"
                          value={f.startPage}
                          onChange={(e) =>
                            updateFile(f.id, { startPage: e.target.value })
                          }
                          placeholder="1"
                          min={1}
                          max={parseInt(f.pages) || undefined}
                          className="w-14 bg-gray-700 text-white px-2 py-0.5 rounded focus:outline-none placeholder-gray-600"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">To:</span>
                        <input
                          type="number"
                          value={f.endPage}
                          onChange={(e) =>
                            updateFile(f.id, { endPage: e.target.value })
                          }
                          placeholder={f.pages}
                          min={parseInt(f.startPage) || 1}
                          max={parseInt(f.pages) || undefined}
                          className="w-14 bg-gray-700 text-white px-2 py-0.5 rounded focus:outline-none placeholder-gray-600"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {files.some((f) => f.status === "pending") && (
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload{" "}
                  {files.filter((f) => f.status === "pending").length} file
                  {files.filter((f) => f.status === "pending").length > 1
                    ? "s"
                    : ""}
                </>
              )}
            </button>
          )}
        </>
      )}

      {tab === "library" && (
        <>
          {!selectedFile ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {myFiles && myFiles.length > 0 ? (
                myFiles.map((f) => (
                  <button
                    key={f.storageId}
                    onClick={() => {
                      setSelectedFile(f);
                      setLibTitle(f.title);
                      setLibStartPage("");
                      setLibEndPage("");
                    }}
                    className="w-full flex items-center gap-3 p-3 bg-gray-800 rounded-xl hover:bg-gray-750 hover:border-gray-600 border border-transparent transition-colors text-left"
                  >
                    {f.type === "image" ? (
                      <Image className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{f.title}</p>
                      <p className="text-xs text-gray-500">
                        {f.totalPages} page{f.totalPages > 1 ? "s" : ""} &middot;{" "}
                        {f.type}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <Library className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No previously uploaded files found
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => setSelectedFile(null)}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                &larr; Back to file list
              </button>

              <div className="p-3 bg-gray-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  {selectedFile.type === "image" ? (
                    <Image className="w-4 h-4 text-indigo-400 shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                  )}
                  <span className="text-sm text-white">
                    {selectedFile.title}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {selectedFile.totalPages} pg
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={libTitle}
                    onChange={(e) => setLibTitle(e.target.value)}
                    className="w-full bg-gray-700 text-sm text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Start Page
                    </label>
                    <input
                      type="number"
                      value={libStartPage}
                      onChange={(e) => setLibStartPage(e.target.value)}
                      placeholder="1"
                      min={1}
                      max={selectedFile.totalPages}
                      className="w-full bg-gray-700 text-sm text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      End Page
                    </label>
                    <input
                      type="number"
                      value={libEndPage}
                      onChange={(e) => setLibEndPage(e.target.value)}
                      placeholder={String(selectedFile.totalPages)}
                      min={parseInt(libStartPage) || 1}
                      max={selectedFile.totalPages}
                      className="w-full bg-gray-700 text-sm text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-600"
                    />
                  </div>
                </div>

                {libStartPage && libEndPage && (
                  <p className="text-xs text-indigo-400">
                    {Math.max(
                      1,
                      (parseInt(libEndPage) || 0) -
                        (parseInt(libStartPage) || 1) +
                        1
                    )}{" "}
                    pages selected
                  </p>
                )}
              </div>

              <button
                onClick={handleAddExisting}
                disabled={isAddingExisting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {isAddingExisting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Add to Session
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
