import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  BookOpen,
  Plus,
  X,
  Globe,
  Lock,
  ChevronLeft,
  Zap,
} from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

const COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
];

export default function SessionCreatePage() {
  const navigate = useNavigate();
  const createSession = useMutation(api.sessions.createSession);
  const createCourse = useMutation(api.sessions.createCourse);
  const courses = useQuery(api.sessions.getMyCourses);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<
    Id<"courses"> | undefined
  >();
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [speedMinPerPage, setSpeedMinPerPage] = useState(3);
  const [isPublic, setIsPublic] = useState(false);
  const [checkInInterval, setCheckInInterval] = useState(3);
  const [isLoading, setIsLoading] = useState(false);

  // New course form
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseColor, setNewCourseColor] = useState(COLORS[0]);

  function addTopic() {
    const t = topicInput.trim();
    if (t && !topics.includes(t)) {
      setTopics([...topics, t]);
      setTopicInput("");
    }
  }

  function removeTopic(topic: string) {
    setTopics(topics.filter((t) => t !== topic));
  }

  async function handleCreateCourse() {
    if (!newCourseName.trim()) return;
    try {
      const id = await createCourse({
        title: newCourseName.trim(),
        color: newCourseColor,
      });
      setSelectedCourseId(id as Id<"courses">);
      setNewCourseName("");
      setShowNewCourse(false);
      toast.success("Course created!");
    } catch {
      toast.error("Failed to create course");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    try {
      const { sessionId } = await createSession({
        title: title.trim(),
        description: description.trim() || undefined,
        courseId: selectedCourseId,
        topics,
        scheduledStart: new Date(startDate).getTime(),
        scheduledEnd: new Date(endDate).getTime(),
        defaultSpeedMinPerPage: speedMinPerPage,
        isPublic,
        checkInIntervalMinutes: checkInInterval,
      });

      toast.success("Session created successfully!");
      navigate(`/sessions/${sessionId}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create session");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 text-sm"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-white mb-2">
        Create Study Session
      </h1>
      <p className="text-gray-400 mb-8">
        Set up your learning environment and invite others to join.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Session Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Chapter 5 - Organic Chemistry"
            required
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will you be studying?"
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
          />
        </div>

        {/* Course */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Course (optional)
          </label>
          <div className="flex gap-2">
            <select
              value={selectedCourseId ?? ""}
              onChange={(e) =>
                setSelectedCourseId((e.target.value as Id<"courses">) || undefined)
              }
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">No course</option>
              {courses?.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewCourse(!showNewCourse)}
              className="px-4 py-3 border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-white rounded-xl transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {showNewCourse && (
            <div className="mt-3 p-4 bg-gray-900 border border-gray-700 rounded-xl space-y-3">
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="Course name"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewCourseColor(c)}
                    className={`w-7 h-7 rounded-full transition-transform ${newCourseColor === c ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-gray-900" : ""}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleCreateCourse}
                className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Create Course
              </button>
            </div>
          )}
        </div>

        {/* Topics */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Topics / Chapters
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
              placeholder="Add a topic and press Enter"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <button
              type="button"
              onClick={addTopic}
              className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {topics.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {topics.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 bg-indigo-600/20 text-indigo-300 border border-indigo-600/30 px-3 py-1 rounded-full text-sm"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTopic(t)}
                    className="hover:text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              Start Time
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              End Time
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Speed & Check-in */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              Reading Speed
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={15}
                value={speedMinPerPage}
                onChange={(e) => {
                  const newSpeed = Number(e.target.value);
                  setSpeedMinPerPage(newSpeed);
                  if (checkInInterval < newSpeed) {
                    setCheckInInterval(newSpeed);
                  }
                }}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-sm text-white font-medium w-16 text-right">
                {speedMinPerPage} min/pg
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <Zap className="w-3.5 h-3.5 inline mr-1" />
              Check-in Every
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={speedMinPerPage}
                max={60}
                step={1}
                value={checkInInterval}
                onChange={(e) => setCheckInInterval(Number(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-sm text-white font-medium w-12 text-right">
                {checkInInterval}m
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Min {speedMinPerPage}m (based on reading speed)
            </p>
          </div>
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Session Visibility
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${!isPublic ? "border-indigo-500 bg-indigo-600/10 text-white" : "border-gray-700 text-gray-400 hover:border-gray-600"}`}
            >
              <Lock className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium text-sm">Private</div>
                <div className="text-xs text-gray-500">Invite code only</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${isPublic ? "border-indigo-500 bg-indigo-600/10 text-white" : "border-gray-700 text-gray-400 hover:border-gray-600"}`}
            >
              <Globe className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium text-sm">Public</div>
                <div className="text-xs text-gray-500">Anyone can join</div>
              </div>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !title.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <BookOpen className="w-4 h-4" />
              Create Session
            </>
          )}
        </button>
      </form>
    </div>
  );
}
