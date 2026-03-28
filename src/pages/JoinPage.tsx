import { useParams, useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function JoinPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthSession();
  const joinByInviteCode = useMutation(api.sessions.joinByInviteCode);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/auth?redirect=/join/${inviteCode}`, { replace: true });
      return;
    }
    if (inviteCode) {
      handleJoin();
    }
  }, [inviteCode, user, authLoading]);

  async function handleJoin() {
    if (!inviteCode) return;
    setIsJoining(true);
    setError("");
    try {
      const { sessionId } = await joinByInviteCode({ inviteCode: inviteCode.toUpperCase() });
      toast.success("Joined study session!");
      navigate(`/sessions/${sessionId}`, { replace: true });
    } catch (err: any) {
      setError(err.message ?? "Invalid invite code");
      setIsJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Users className="w-6 h-6 text-indigo-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">
          Joining Study Session
        </h1>

        {(isJoining || authLoading) ? (
          <div className="flex flex-col items-center gap-3 mt-6">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-gray-400">Connecting you to the session...</p>
          </div>
        ) : error ? (
          <div className="mt-4">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => navigate("/")}
              className="text-indigo-400 hover:text-indigo-300 text-sm"
            >
              Go back home
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
