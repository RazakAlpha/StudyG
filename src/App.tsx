import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuthSession } from "./hooks/useAuthSession";
import Layout from "./components/layout/Layout";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import SessionCreatePage from "./pages/SessionCreatePage";
import SessionActivePage from "./pages/SessionActivePage";
import QuizPage from "./pages/QuizPage";
import RevisionPage from "./pages/RevisionPage";
import SessionHistoryPage from "./pages/SessionHistoryPage";
import JoinPage from "./pages/JoinPage";
import AuthPage from "./pages/AuthPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthSession();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/join/:inviteCode" element={<JoinPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/sessions/new" element={<SessionCreatePage />} />
          <Route path="/sessions/:sessionId" element={<SessionActivePage />} />
          <Route
            path="/sessions/:sessionId/quiz/:quizId"
            element={<QuizPage />}
          />
          <Route path="/revision" element={<RevisionPage />} />
          <Route path="/history" element={<SessionHistoryPage />} />
        </Route>
      </Routes>
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#1f2937",
            border: "1px solid #374151",
            color: "#f9fafb",
          },
        }}
      />
    </BrowserRouter>
  );
}
