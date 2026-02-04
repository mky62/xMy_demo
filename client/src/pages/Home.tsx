import { useEffect, useReducer, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";
import baseLogo from "../assets/base_logo.svg";
import heroImg from "../assets/heroimgfn.jpg";
import { inMemorySession } from "../tempStorage/globalSession";

// Constants
const USERNAME_PRESETS = [
  "ShadowWhisper",
  "CyberPhantom",
  "NeonGhost",
  "VoidWalker",
  "EchoHunter",
] as const;

const ALIAS_GENERATION_DELAY = 300;
const SETTLE_ANIMATION_DURATION = 200;
const MAX_ROOM_ID_LENGTH = 50;
const GENERATED_ROOM_ID_LENGTH = 10;

// Types
type Phase = "identity" | "session";

interface State {
  phase: Phase;
  alias: string;
  roomId: string;
  isGenerating: boolean;
  isSettling: boolean;
  error: string | null;
  isNavigating: boolean;
}

type Action =
  | { type: "GENERATE_ALIAS_START" }
  | { type: "GENERATE_ALIAS_COMPLETE"; payload: string }
  | { type: "SET_SETTLE"; payload: boolean }
  | { type: "SET_PHASE"; payload: Phase }
  | { type: "SET_ROOM_ID"; payload: string }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_NAVIGATING"; payload: boolean };

// Reducer
function homeReducer(state: State, action: Action): State {
  switch (action.type) {
    case "GENERATE_ALIAS_START":
      return { ...state, isGenerating: true, alias: "", error: null };
    case "GENERATE_ALIAS_COMPLETE":
      return { ...state, isGenerating: false, alias: action.payload };
    case "SET_SETTLE":
      return { ...state, isSettling: action.payload };
    case "SET_PHASE":
      return { ...state, phase: action.payload, error: null };
    case "SET_ROOM_ID":
      return { ...state, roomId: action.payload, error: null };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_NAVIGATING":
      return { ...state, isNavigating: action.payload };
    default:
      return state;
  }
}

// Utilities
function generateRandomAlias(): string {
  const preset = USERNAME_PRESETS[Math.floor(Math.random() * USERNAME_PRESETS.length)];
  const timestamp = Date.now().toString(36);
  const random = Math.floor(Math.random() * 100).toString(36);
  return `${preset}_${timestamp}${random}`;
}

function sanitizeRoomId(id: string): string {
  return id
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function sanitizeUsername(username: string): string {
  // Remove potentially dangerous characters but preserve readability
  return username
    .replace(/[<>\"'&]/g, "")
    .trim()
    .slice(0, 50);
}

function validateRoomId(roomId: string): string | null {
  if (!roomId) {
    return "Session ID is required";
  }
  if (roomId.length > MAX_ROOM_ID_LENGTH) {
    return `Session ID cannot exceed ${MAX_ROOM_ID_LENGTH} characters`;
  }
  return null;
}

// Component
export default function Home() {
  const navigate = useNavigate();
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, dispatch] = useReducer(homeReducer, {
    phase: "identity",
    alias: "",
    roomId: "",
    isGenerating: false,
    isSettling: false,
    error: null,
    isNavigating: false,
  });

  // Generate initial alias
  useEffect(() => {
    handleGenerateAlias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Settle animation effect
  useEffect(() => {
    if (state.alias && !state.isGenerating) {
      dispatch({ type: "SET_SETTLE", payload: true });
      settleTimeoutRef.current = setTimeout(() => {
        dispatch({ type: "SET_SETTLE", payload: false });
      }, SETTLE_ANIMATION_DURATION);
    }

    return () => {
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
    };
  }, [state.alias, state.isGenerating]);

  // Handlers
  function handleGenerateAlias() {
    dispatch({ type: "GENERATE_ALIAS_START" });

    setTimeout(() => {
      const newAlias = generateRandomAlias();
      dispatch({ type: "GENERATE_ALIAS_COMPLETE", payload: newAlias });
    }, ALIAS_GENERATION_DELAY);
  }

  function handleContinueToSession() {
    if (!state.alias) {
      dispatch({ type: "SET_ERROR", payload: "Identity not initialized" });
      return;
    }

    const sanitized = sanitizeUsername(state.alias);
    inMemorySession.username = sanitized;
    dispatch({ type: "SET_PHASE", payload: "session" });
  }

  function handleCreateSession() {
    const roomId = sanitizeRoomId(nanoid(GENERATED_ROOM_ID_LENGTH));
    dispatch({ type: "SET_NAVIGATING", payload: true });
    navigate(`/chat/${roomId}`, { state: { username: inMemorySession.username } });
  }

  function handleJoinSession() {
    const cleanRoomId = sanitizeRoomId(state.roomId.trim());
    const validationError = validateRoomId(cleanRoomId);

    if (validationError) {
      dispatch({ type: "SET_ERROR", payload: validationError });
      return;
    }

    dispatch({ type: "SET_NAVIGATING", payload: true });
    navigate(`/chat/${cleanRoomId}`, { state: { username: inMemorySession.username } });
  }

  function handleRoomIdChange(value: string) {
    dispatch({ type: "SET_ROOM_ID", payload: value });
  }

  function handleBackToIdentity() {
    dispatch({ type: "SET_PHASE", payload: "identity" });
  }

  function handleRoomIdKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleJoinSession();
    }
  }

  const canContinue = state.alias && !state.isGenerating;

  return (
    <div className="min-h-screen paper-terminal terminal-text bg-[linear-gradient(192deg,_rgba(12,130,247,1)_0%,_rgba(87,199,133,1)_50%,_rgba(237,221,83,1)_100%)] text-[#0a0a0a] font-mono relative">
      {/* Visual layers */}
      <div className="pulsar pulsar-top-right" />
      <div className="pulsar pulsar-bottom-left" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-[#d6d4cc]">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
            <img
              src={baseLogo}
              alt="xMy secure chat"
              className="w-12 h-12 border-cyan-200 rounded-xl shadow-xl/20"
            />
            <div>
              <h1 className="sr-only">xMy - Secure Ephemeral Channel</h1>
              <div className="text-xs text-[#6b6b6b]" aria-label="Application description">
                secure ephemeral channel
              </div>
            </div>
          </div>
        </header>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-14 flex flex-col md:flex-row items-start gap-14">
        {/* Narrative */}
        <section
          className="flex-1 relative w-full min-h-[400px] md:h-[600px] lg:h-[400px] overflow-hidden rounded-xl"
          aria-labelledby="hero-heading"
        >
          {/* Background image */}
          <img
            src={heroImg}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            role="presentation"
          />

          {/* Dark overlay for contrast */}
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

          {/* Foreground content */}
          <div className="relative z-10 p-8 space-y-6 max-w-xl">
            <div className="text-xs uppercase underline tracking-wider text-gray-300">
              system notice
            </div>

            <h2 id="hero-heading" className="text-2xl text-white">
              Anonymous session interface.
              <br />
              No persistence. No recovery.
            </h2>

            <p className="text-sm text-[#b0b0b0]">
              Identity is system-generated. No user-controlled identifiers.
            </p>
          </div>
        </section>

        {/* Terminal */}
        <section
          className="flex-1 border border-[#d6d4cc] bg-[#faf9f6] p-8 space-y-8"
          aria-labelledby="terminal-heading"
        >
          <h2 id="terminal-heading" className="sr-only">
            {state.phase === "identity" ? "Identity Generation" : "Session Control"}
          </h2>

          {/* Error display */}
          {state.error && (
            <div
              role="alert"
              className="px-3 py-2 border border-red-600 bg-red-50 text-red-800 text-sm"
            >
              {state.error}
            </div>
          )}

          {state.phase === "identity" && (
            <>
              <div>
                <label htmlFor="alias-display" className="text-xs uppercase tracking-wider mb-2 block">
                  identity
                </label>

                <div
                  id="alias-display"
                  className={`terminal-output ${state.isSettling ? "paper-settle" : ""}`}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {state.alias || "— initializing identity —"}
                  {state.isGenerating && <span className="cursor" aria-label="generating" />}
                </div>

                <div className="mt-2 flex justify-between text-xs text-[#6b6b6b]">
                  <span>system-generated alias</span>
                  <button
                    onClick={handleGenerateAlias}
                    className="underline hover:text-black focus:outline-none focus:text-black"
                    disabled={state.isGenerating}
                    aria-label="Regenerate identity alias"
                  >
                    regenerate
                  </button>
                </div>
              </div>

              <button
                onClick={handleContinueToSession}
                disabled={!canContinue}
                className="
                  w-full h-11
                  border border-black
                  uppercase tracking-wider
                  hover:bg-black hover:text-[#f7f6f2]
                  focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors
                "
                aria-label="Continue to session creation"
              >
                continue →
              </button>
            </>
          )}

          {state.phase === "session" && (
            <>
              <div className="text-xs uppercase tracking-wider">session control</div>

              <button
                onClick={handleCreateSession}
                disabled={state.isNavigating}
                className="w-full h-11 border border-black uppercase tracking-wider hover:bg-black hover:text-[#f7f6f2] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-40 transition-colors"
                aria-label="Create new chat session"
              >
                {state.isNavigating ? "creating session..." : "create new session"}
              </button>

              <div className="text-center text-xs text-[#6b6b6b]" aria-hidden="true">
                — or join existing —
              </div>

              <div>
                <label htmlFor="room-id-input" className="sr-only">
                  Session ID
                </label>
                <input
                  id="room-id-input"
                  type="text"
                  value={state.roomId}
                  onChange={(e) => handleRoomIdChange(e.target.value)}
                  onKeyPress={handleRoomIdKeyPress}
                  placeholder="session id"
                  disabled={state.isNavigating}
                  className="
                    w-full h-10 px-2
                    bg-[#f0efe9]
                    border border-[#d6d4cc]
                    focus:outline-none focus:ring-2 focus:ring-black focus:border-black
                    disabled:opacity-40
                  "
                  aria-describedby="room-id-help"
                  maxLength={MAX_ROOM_ID_LENGTH}
                />
                <div id="room-id-help" className="sr-only">
                  Enter the session ID to join an existing chat room
                </div>
              </div>

              <button
                onClick={handleJoinSession}
                disabled={state.isNavigating}
                className="w-full h-11 border border-[#6b6b6b] uppercase tracking-wider hover:border-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-40 transition-colors"
                aria-label="Join existing session"
              >
                {state.isNavigating ? "joining session..." : "join session"}
              </button>

              <button
                onClick={handleBackToIdentity}
                disabled={state.isNavigating}
                className="text-xs underline text-[#6b6b6b] hover:text-black focus:outline-none focus:text-black disabled:opacity-40"
                aria-label="Go back to regenerate identity"
              >
                ← regenerate identity
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}