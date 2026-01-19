import { useState, useEffect } from "react";
import logo from '../../assets/base_logo.svg';

interface ChatTopProps {
  roomId: string;
  userCount: number;
}

function ChatTop({ roomId, userCount, expiresAt }: ChatTopProps & { expiresAt?: number | null }) {
  const [copied, setCopied] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isLowTime, setIsLowTime] = useState<boolean>(false);

  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = expiresAt - now;

      if (diff <= 0) {
        setTimeLeft("00:00");
        setIsLowTime(true);
        return;
      }

      setIsLowTime(diff < 60000); // Less than 1 minute

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const copyRoomId = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500); // Slightly longer for mobile visibility
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  return (
    <div className="relative flex justify-between items-center bg-slate-900/80 backdrop-blur-md border border-slate-700/50 px-3 sm:px-6 py-2 sm:py-3 min-h-[60px] rounded-b-2xl">
      {/* Left: Room ID Section - Responsive sizing */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0">
          <img src={logo} alt="Logo" className="w-8 h-6 sm:w-14 sm:h-12" />
        </div>
        <div
          onClick={copyRoomId}
          className="group cursor-pointer flex flex-col items-start leading-tight flex-1 min-w-0"
        >
          <span className="text-xs sm:text-[10px] uppercase tracking-widest text-sky-400 font-bold">
            Room Session
          </span>
          <div className="flex items-center gap-1 sm:gap-2 truncate">
            <span className="text-white font-mono text-xs sm:text-sm tracking-tight underline group-hover:text-yellow-400 hover:underline-offset-2 transition-colors truncate">
              {roomId}
            </span>
          </div>
        </div>
      </div>

      {/* Center: Timer Display */}
      {expiresAt && (
        <div className={`absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border ${isLowTime ? 'bg-red-900/30 border-red-500/50 text-red-200 animate-pulse' : 'bg-slate-800/50 border-slate-600/50 text-slate-300'}`}>
          <span className="text-[10px] uppercase tracking-wider font-bold">Time Left</span>
          <span className="font-mono font-bold text-sm tabular-nums">{timeLeft}</span>
        </div>
      )}

      {/* Right: User Count Badge - Adjusted for dark theme and mobile */}
      <div className="flex-shrink-0 flex items-center gap-1.5 sm:gap-2 border border-slate-600/50 bg-slate-800/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md">
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-[10px] sm:text-xs font-bold text-indigo-100 tracking-tighter">
          {userCount} inside
        </span>
      </div>

      {/* Notification: Improved positioning and mobile-friendly */}
      {copied && (
        <div className="absolute -bottom-2 sm:-bottom-10 left-1/2 -translate-x-1/2 bg-slate-600/95 text-white text-xs px-3 py-1.5 rounded-md shadow-lg border border-slate-500/30 animate-bounce z-10 whitespace-nowrap">
          Copied to clipboard!
        </div>
      )}
    </div>
  );
}

export default ChatTop;