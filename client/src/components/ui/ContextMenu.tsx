import React, { useEffect, useRef } from 'react';
import { Trash2, Mic, MicOff } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
  onMute: () => void;
  isMuted: boolean;
  canMute: boolean;
}

export default function ContextMenu({ 
  x, 
  y, 
  onClose, 
  onDelete, 
  onMute, 
  isMuted, 
  canMute 
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Click outside handler
    function handleClickOutside(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // Escape key handler
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu within viewport
  const style: React.CSSProperties = {
    top: y,
    left: x,
  };

  // Basic viewport adjustment logic could be added here if needed, 
  // currently relying on CSS or parent to provide valid coordinates.

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[60px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg animate-in fade-in zoom-in-95 duration-100"
      style={style}
    >
      <div className="p-1">
        {canMute && (
          <button
            onClick={onMute}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {isMuted ? <Mic size={16} /> : <MicOff size={16} />}
            <span>{isMuted ? "Unmute" : "Mute"}</span>
          </button>
        )}
        <button
          onClick={onDelete}
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={16} />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}