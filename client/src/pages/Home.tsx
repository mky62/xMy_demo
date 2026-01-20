import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { useNavigate } from "react-router-dom";
import { Shield, Zap, Lock, ArrowRight, Sparkles } from "lucide-react";
import baseLogo from "../assets/base_logo.svg";
import { inMemorySession } from "../tempStorage/globalSession";

const usernamePresets = [
  "ShadowWhisper",
  "CyberPhantom",
  "NeonGhost",
  "VoidWalker",
  "EchoHunter",
  "QuantumDrifter",
  "SilentStorm",
  "NightShade",
  "DataSpectre",
  "GhostProtocol",
];

const roomIdPresets = [
  "quantum-nexus",
  "void-chamber",
  "cyber-haven",
  "shadow-realm",
  "echo-vault",
  "neural-space",
  "ghost-protocol",
  "dark-matrix",
  "silent-sphere",
  "neon-sanctum",
];

function Home() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [glowActive, setGlowActive] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  const anonymousQuotes = [
    "Your secrets are safe here. Your identity is yours alone.",
    "No traces. No records. Just pure, unfiltered conversation.",
    "Speak your truth without fear. Vanish without a trace.",
    "Real privacy means zero compromise. We keep none of your data.",
    "Anonymous by design. Ephemeral by nature. Secure by default.",
  ];

  useEffect(() => {
    const glowTimer = window.setTimeout(() => setGlowActive(true), 100);
    const quoteInterval = window.setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % anonymousQuotes.length);
    }, 5000);

    return () => {
      window.clearTimeout(glowTimer);
      window.clearInterval(quoteInterval);
    };
  }, [anonymousQuotes.length]);

  function generateUsername() {
    const preset = usernamePresets[Math.floor(Math.random() * usernamePresets.length)];

    // Timestamp + random ensures near-zero collision
    const unique = Date.now().toString(36) + Math.floor(Math.random() * 100).toString(36);
    setUsername(`${preset}_${unique}`);
  }

  function generateRoomId() {
    const randomRoom = nanoid(8);
    const base = roomIdPresets[Math.floor(Math.random() * roomIdPresets.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    const generatedRoomId = `${base}-${randomRoom}-${randomNum}`;
    setRoomId(generatedRoomId);
  }

  function joinRoom() {
    const cleanUsername = username.trim();
    if (!cleanUsername) return alert("Username cannot be empty");
    if (cleanUsername.length > 25) return alert("Username too long (max 25)");

    inMemorySession.username = cleanUsername; // to persist username across refreshes

    const safeRoomId = roomId
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    if (!safeRoomId) return alert("Room ID cannot be empty");
    if (safeRoomId.length > 50) return alert("Room ID too long (max 50)");

    navigate(`/chat/${safeRoomId}`, { state: { username: cleanUsername } });
  }

  const handleNext = () => {
    if (step === 1) {
      const cleanUsername = username.trim();
      if (!cleanUsername) return alert("Username cannot be empty");
      if (cleanUsername.length > 25) return alert("Username too long (max 25)");
      setUsername(cleanUsername);

      // Auto-generate Room ID when moving to Step 2
      if (!roomId) {
        generateRoomId();
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      joinRoom();
    }
  };

  return (
    <div className="relative h-screen bg-gradient-to-br from-white via-emerald-50/20 to-cyan-50/30 overflow-y-auto md:overflow-hidden flex flex-col">
      <div
        className="absolute top-16 left-12 w-80 h-80 rounded-full mix-blend-multiply filter blur-3xl animate-pulse opacity-40"
        style={{ background: "radial-gradient(circle, rgba(245, 158, 11, 0.55) 0%, transparent 70%)" }}
      />
      <div
        className="absolute top-32 right-16 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl animate-pulse opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(59, 130, 246, 0.45) 0%, rgba(30, 64, 175, 0.35) 50%, transparent 70%)",
          animationDelay: "2s",
        }}
      />
      <div
        className="absolute bottom-20 left-1/4 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl animate-pulse opacity-35"
        style={{
          background: "radial-gradient(circle, rgba(20, 184, 166, 0.5) 0%, rgba(15, 118, 110, 0.35) 60%, transparent 70%)",
          animationDelay: "4s",
        }}
      />
      <div
        className="absolute top-1/2 right-1/4 w-64 h-64 rounded-full mix-blend-multiply filter blur-3xl animate-pulse opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(59, 130, 246, 0.35) 0%, rgba(30, 64, 175, 0.28) 50%, transparent 70%)",
          animationDelay: "1s",
        }}
      />

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none z-0">
        <div
          className={`w-[120vw] h-[60vw] max-w-[1600px] max-h-[800px] rounded-t-full transition-all duration-[2500ms] ease-out ${glowActive ? "opacity-100 scale-100" : "opacity-0 scale-90"
            }`}
          style={{
            background: `radial-gradient(ellipse at center top,
              rgba(245, 158, 11, 0.18) 0%,
              rgba(132, 204, 22, 0.20) 15%,
              rgba(34, 197, 94, 0.24) 30%,
              rgba(20, 184, 166, 0.22) 50%,
              rgba(13, 148, 136, 0.16) 65%,
              rgba(30, 64, 175, 0.12) 80%,
              transparent 95%)`,
            filter: "blur(90px)",
          }}
        />
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
        <h1 className="text-[20rem] md:text-[28rem] lg:text-[35rem] font-bold select-none leading-none opacity-[.2]">
          <span
            className="text-transparent bg-clip-text"
            style={{
              background:
                "linear-gradient(135deg, rgb(245 158 11), rgb(132 204 22), rgb(34 197 94), rgb(20 184 166), rgb(30 64 175))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            <img src={baseLogo} alt="xMy" />
          </span>
        </h1>
      </div>

      <header className="relative z-20 w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={baseLogo} alt="Logo" width={64} height={64} className="w-16 h-16 drop-shadow-md" />
        </div>
        <div className="flex items-center gap-6">
          <a href="#" className="text-sm text-neutral-700 hover:text-emerald-600 transition-colors font-medium tracking-wide">
            About
          </a>
          <a href="#" className="text-sm text-neutral-700 hover:text-teal-600 transition-colors font-medium tracking-wide">
            GitHub
          </a>
        </div>
      </header>

      <div className="relative z-10 w-full max-w-4xl mx-auto text-center space-y-9 flex-1 flex flex-col items-center justify-center px-4 py-2">
        <div className="relative w-full max-w-2xl mx-auto overflow-hidden">
          <div className="bg-gradient-to-r from-amber-300/20 via-emerald-300/20 to-teal-300/20 backdrop-blur-sm border border-neutral-200/40 rounded-2xl p-3 shadow-lg">
            <p className="text-xs md:text-sm text-neutral-700 font-medium italic transition-all duration-500 ease-in-out">
              "{anonymousQuotes[quoteIndex]}"
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xl md:text-2xl lg:text-3xl text-neutral-800 uppercase tracking-[0.3em] font-light">
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent font-medium">Chat.</span> Vanish.{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent font-medium">Repeat.</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start justify-center gap-4 py-4">
          {step === 1 ? (
            <>
              <div className="w-full sm:w-auto min-w-[300px] space-y-3">
                {/* Username input */}
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Enter username..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNext()}
                    className="h-16 w-full bg-white/90 backdrop-blur-md border-2 border-emerald-500/30 hover:border-emerald-500/50 focus:border-emerald-600 text-neutral-800 placeholder:text-neutral-500 text-center text-lg font-medium rounded-2xl shadow-xl shadow-emerald-500/10 transition-all"
                  />
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-200/40 to-teal-200/40 opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl" />
                </div>
                <button
                  type="button"
                  onClick={generateUsername}
                  className="w-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-600/5 text-sm rounded-xl font-medium h-10 flex items-center justify-center"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate random username
                </button>
              </div>
              <button
                type="button"
                onClick={handleNext}
                disabled={!username.trim()}
                className="h-16 px-10 bg-emerald-600 hover:bg-emerald-600/90 text-white font-semibold uppercase tracking-wider disabled:opacity-30 rounded-2xl shadow-xl shadow-emerald-600/25 transition-all hover:shadow-2xl hover:shadow-emerald-600/30 flex items-center justify-center"
              >
                Continue
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </>
          ) : (
            <>
              <div className="w-full sm:w-auto min-w-[300px] space-y-3">
                {/* Room ID input with generate button */}
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Generating room ID..."
                    value={roomId}
                    readOnly
                    className="h-16 w-full bg-white/90 backdrop-blur-md border-2 border-teal-500/30 text-neutral-600 text-center text-lg font-mono font-medium rounded-2xl shadow-xl shadow-teal-500/10 transition-all cursor-default focus:outline-none"
                  />
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-teal-200/40 to-emerald-200/40 opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl" />
                </div>
                <button
                  type="button"
                  onClick={generateRoomId}
                  className="w-full text-teal-600 hover:text-teal-700 hover:bg-teal-600/5 text-sm rounded-xl font-medium h-10 flex items-center justify-center"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate new room
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="h-16 px-6 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/50 uppercase tracking-wider rounded-2xl transition-all"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!roomId.trim()}
                  className="h-16 px-10 bg-teal-600 hover:bg-teal-600/90 text-white font-semibold uppercase tracking-wider disabled:opacity-30 rounded-2xl shadow-xl shadow-teal-600/25 transition-all hover:shadow-2xl hover:shadow-teal-600/30 flex items-center justify-center"
                >
                  Join Room
                  <ArrowRight className="w-5 h-5 ml-2" />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2">
          <div
            className={`h-2.5 rounded-full transition-all ${step === 1 ? "bg-gradient-to-r from-emerald-600 to-teal-600 w-10" : "bg-neutral-300 w-2.5"
              }`}
          />
          <div
            className={`h-2.5 rounded-full transition-all ${step === 2 ? "bg-gradient-to-r from-emerald-600 to-teal-600 w-10" : "bg-neutral-300 w-2.5"
              }`}
          />
        </div>

        <div className="text-center max-w-2xl mx-auto space-y-2">
          <p className="text-lg md:text-xl font-semibold text-neutral-800 leading-tight">
            Talk freely.{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Leave no trace.</span>
          </p>
          <p className="text-sm md:text-base text-neutral-600 leading-relaxed">
            Every conversation self-destructs in 15 minutes. Zero accounts. Zero history.
            <span className="text-teal-600 font-semibold"> Zero compromises.</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          <div className="relative group space-y-2 p-5 bg-white/70 backdrop-blur-md rounded-3xl border border-neutral-200/60 shadow-lg hover:shadow-xl transition-all">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-300/20 to-emerald-300/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex justify-center mb-2">
              <div className="p-3 bg-gradient-to-br from-amber-300/25 to-emerald-300/25 rounded-2xl">
                <Shield className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <h3 className="relative text-neutral-900 font-semibold text-base">Self-Destructing</h3>
            <p className="relative text-xs text-neutral-600 leading-relaxed">Rooms automatically expire after 15 minutes</p>
          </div>

          <div className="relative group space-y-2 p-5 bg-white/70 backdrop-blur-md rounded-3xl border border-neutral-200/60 shadow-lg hover:shadow-xl transition-all">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-emerald-300/20 to-teal-300/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex justify-center mb-2">
              <div className="p-3 bg-gradient-to-br from-teal-300/25 to-blue-300/25 rounded-2xl">
                <Lock className="w-6 h-6 text-teal-600" />
              </div>
            </div>
            <h3 className="relative text-neutral-900 font-semibold text-base">No Accounts</h3>
            <p className="relative text-xs text-neutral-600 leading-relaxed">Start chatting immediately without registration</p>
          </div>

          <div className="relative group space-y-2 p-5 bg-white/70 backdrop-blur-md rounded-3xl border border-neutral-200/60 shadow-lg hover:shadow-xl transition-all">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-lime-300/20 to-amber-300/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex justify-center mb-2">
              <div className="p-3 bg-gradient-to-br from-amber-300/25 to-lime-300/25 rounded-2xl">
                <Zap className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <h3 className="relative text-neutral-900 font-semibold text-base">Real-Time</h3>
            <p className="relative text-xs text-neutral-600 leading-relaxed">Instant message delivery with live updates</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;