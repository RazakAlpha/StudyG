import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Users,
  Brain,
  BarChart3,
  Clock,
  Shield,
  ArrowRight,
  Zap,
  LogIn,
} from "lucide-react";

const features = [
  {
    icon: Clock,
    title: "Timed Learning Sessions",
    description:
      "Set your learning period, scope your study material, and track progress page by page with customizable reading speeds.",
  },
  {
    icon: Users,
    title: "Virtual Group Study",
    description:
      "Invite friends to join your session in real-time. Share progress, chat, and annotate materials together.",
  },
  {
    icon: Brain,
    title: "AI-Powered Quizzes",
    description:
      "Get post-session quizzes automatically generated from your study materials to confirm understanding.",
  },
  {
    icon: BarChart3,
    title: "Progress Analytics",
    description:
      "Track your learning trends, streaks, and performance over time with detailed statistics.",
  },
  {
    icon: Zap,
    title: "Smart Revision",
    description:
      "Spaced repetition system surfaces the most critical topics you need to revisit, at the right time.",
  },
  {
    icon: Shield,
    title: "Check-in System",
    description:
      "Periodic check-ins during your session keep you accountable and help adjust your study pace.",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");

  function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/join/${code}`);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold">StudyG</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2"
            >
              Sign in
            </Link>
            <Link
              to="/auth?mode=register"
              className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-600/10 border border-indigo-600/30 rounded-full px-4 py-1.5 text-sm text-indigo-400 mb-8">
          <Zap className="w-3.5 h-3.5" />
          AI-powered learning companion
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-6">
          Study Smarter,{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Together
          </span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Your virtual group learning companion. Set study sessions, track your
          progress, collaborate in real-time, and let AI quiz you when you're
          done.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/auth?mode=register"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-indigo-500/20"
          >
            Start Learning Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white px-8 py-3.5 rounded-xl font-semibold transition-colors"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Join a Study Group */}
      <section className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Join a Study Group</h2>
              <p className="text-sm text-gray-400">
                Got an invite code? Enter it below to jump right in.
              </p>
            </div>
          </div>
          <form onSubmit={handleJoinSubmit} className="flex gap-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter code, e.g. ABC123"
              maxLength={10}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono text-center tracking-widest text-lg"
            />
            <button
              type="submit"
              disabled={!joinCode.trim()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold transition-all"
            >
              <LogIn className="w-4 h-4" />
              Join
            </button>
          </form>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h2 className="text-3xl font-bold text-center mb-4">
          Everything you need to learn effectively
        </h2>
        <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
          Built for students who want to take their learning seriously — alone
          or with friends.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors"
            >
              <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-600/30 rounded-3xl p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to start studying?</h2>
          <p className="text-gray-400 mb-8">
            Join StudyG and transform how you learn.
          </p>
          <Link
            to="/auth?mode=register"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-xl font-semibold transition-all hover:scale-[1.02]"
          >
            Create Free Account
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-800 py-8 text-center text-sm text-gray-500">
        <p>© 2026 StudyG. Built to help you learn better.</p>
      </footer>
    </div>
  );
}
