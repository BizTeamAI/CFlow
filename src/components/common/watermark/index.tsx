import React from "react";
import { cn } from "@/utils/utils";

interface WatermarkProps {
  className?: string;
  visible?: boolean;
}

export default function Watermark({ className, visible = true }: WatermarkProps) {
  if (!visible) return null;

  // Detect theme mode from document class or data attribute
  const isDarkMode = document.documentElement.classList.contains('dark') || 
                     document.documentElement.getAttribute('data-theme') === 'dark';

  const textColor = isDarkMode ? 'text-white' : 'text-gray-600';
  const bgColor = isDarkMode ? 'bg-gray-900/20' : 'bg-white/20';
  const borderColor = isDarkMode ? 'border-gray-700/30' : 'border-gray-300/30';

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 pointer-events-none select-none z-[1000]",
        bgColor,
        "backdrop-blur-sm rounded-lg p-4 border",
        borderColor,
        className
      )}
      style={{
        position: "fixed",
        bottom: "48px",
        right: "16px",
        zIndex: 1000,
        minWidth: "220px",
      }}
    >
      <div 
        className="flex flex-col items-center space-y-2"
        style={{ color: isDarkMode ? '#ffffff' : '#4b5563' }}
      >
        {/* CFlow Logo */}
        <div className="flex items-center space-x-2">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ color: isDarkMode ? '#ffffff' : '#4b5563' }}
          >
            <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" />
            <path d="M9 12l2 2 4-4" stroke={isDarkMode ? "white" : "black"} strokeWidth="1.5" fill="none" />
          </svg>
          <span className="text-lg font-bold">CFlow</span>

          <p className="text-sm font-medium">Community Edition</p>
        </div>
        
        {/* License information */}
        <div className="text-center space-y-1">
          <p className="text-xs" style={{ opacity: 0.8 }}>
            This software is not licensed. Purchase a license for 
          </p>
          <p className="text-xs" style={{ opacity: 0.8 }}>
            enhanced commercial support and professional services.
          </p>
        </div>
      </div>
    </div>
  );
}