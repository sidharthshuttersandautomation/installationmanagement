import React from 'react';

interface SidharthLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark' | 'white-card';
}

export const SidharthLogo: React.FC<SidharthLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'light',
}) => {
  const isLight = variant === 'light';
  const isWhiteCard = variant === 'white-card';

  // Heights
  const heightClass =
    size === 'sm' ? 'h-7' : size === 'lg' ? 'h-13' : size === 'xl' ? 'h-16' : 'h-10';

  // Colors based on variant:
  // If variant="light", we are on dark navy (#10418A). Letters must be PURE CRISP WHITE!
  // If variant="dark" or "white-card", letters are DEEP SIDHARTH ROYAL NAVY (#10418A).
  const textColor = isLight ? '#FFFFFF' : '#10418A';
  const tagColor = isLight ? '#E2E8F0' : '#1E5BB5';
  const greenAccent = isLight ? '#00E676' : '#00A859';
  const ribbonBlueStart = isLight ? '#60A5FA' : '#1E5BB5';
  const ribbonBlueMid = isLight ? '#38BDF8' : '#124694';
  const ribbonBlueEnd = isLight ? '#2563EB' : '#0B2D68';

  const logoSvg = (
    <svg
      viewBox="0 0 340 76"
      className={`${heightClass} w-auto drop-shadow-xs`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* S-Ribbon Gradient */}
        <linearGradient id={`sidharthGrad_${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={ribbonBlueStart} />
          <stop offset="60%" stopColor={ribbonBlueMid} />
          <stop offset="100%" stopColor={ribbonBlueEnd} />
        </linearGradient>

        {/* Green Emerald Accent Gradient */}
        <linearGradient id={`sidharthGreen_${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor={greenAccent} />
        </linearGradient>

        <filter id={`logoGlow_${variant}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="1.5"
            floodColor={isLight ? '#061A3D' : '#94A3B8'}
            floodOpacity={isLight ? '0.5' : '0.2'}
          />
        </filter>
      </defs>

      {/* Stylized 'S' Emblem: Rolling Shutter Curves & Automation Energy */}
      <g filter={`url(#logoGlow_${variant})`}>
        {/* Upper Shutter Curve */}
        <path
          d="M 40 8 C 30 5, 18 9, 14 18 C 10 27, 16 35, 24 39 C 32 44, 38 48, 38 54 C 38 61, 31 66, 22 65 C 16 64, 12 60, 9 56 L 3 61 C 8 68, 15 72, 23 72 C 37 72, 46 64, 46 52 C 46 41, 38 35, 29 30 C 21 26, 17 22, 18 17 C 19 12, 26 9, 34 11 C 39 12, 43 14, 46 17 L 50 11 C 47 9, 44 8, 40 8 Z"
          fill={`url(#sidharthGrad_${variant})`}
        />
        {/* Emerald Green Shutter Slat Accent inside S */}
        <path
          d="M 28 32 C 33 34, 37 38, 37 42 L 31 42 C 30 38, 27 36, 23 34 Z"
          fill={`url(#sidharthGreen_${variant})`}
        />
      </g>

      {/* Main Text: "S I D H A R T H" */}
      {/* S */}
      <path
        d="M 75 18 C 67 15, 60 18, 57 23 C 54 28, 57 33, 62 35 C 68 38, 73 40, 73 45 C 73 50, 68 53, 62 53 C 57 53, 53 50, 51 46 L 46 49 C 49 55, 55 58, 62 58 C 72 58, 78 52, 78 44 C 78 37, 72 33, 65 30 C 60 27, 58 25, 59 21 C 60 17, 65 14, 71 16 C 75 17, 78 19, 80 22 L 84 17 C 82 15, 79 14, 75 18 Z"
        fill={textColor}
      />

      {/* Emerald Dot on the 'i' */}
      <circle cx="94" cy="18" r="5.5" fill={`url(#sidharthGreen_${variant})`} />
      {/* 'i' stem */}
      <path d="M 90.5 27 L 97.5 27 L 97.5 56 L 90.5 56 Z" fill={textColor} />

      {/* 'D' */}
      <path
        d="M 106 27 L 120 27 C 130 27, 137 33, 137 41.5 C 137 50, 130 56, 120 56 L 106 56 Z M 113.5 33.5 L 113.5 49.5 L 120 49.5 C 125.5 49.5, 129.5 46.5, 129.5 41.5 C 129.5 36.5, 125.5 33.5, 120 33.5 Z"
        fill={textColor}
      />

      {/* 'H' */}
      <path
        d="M 144 27 L 151.5 27 L 151.5 38.5 L 163.5 38.5 L 163.5 27 L 171 27 L 171 56 L 163.5 56 L 163.5 44.5 L 151.5 44.5 L 151.5 56 L 144 56 Z"
        fill={textColor}
      />

      {/* 'A' */}
      <path
        d="M 188 27 L 196.5 27 L 206 56 L 198.5 56 L 196.5 49.5 L 187 49.5 L 185 56 L 178 56 Z M 194.5 43.5 L 192 34 L 189 43.5 Z"
        fill={textColor}
      />

      {/* 'R' */}
      <path
        d="M 213 27 L 227 27 C 235 27, 240 31, 240 37 C 240 42, 236 45, 231 46.5 L 241 56 L 232.5 56 L 224 47 L 220.5 47 L 220.5 56 L 213 56 Z M 220.5 33.5 L 220.5 41 L 226.5 41 C 230 41, 232.5 39.5, 232.5 37 C 232.5 34.5, 230 33.5, 226.5 33.5 Z"
        fill={textColor}
      />

      {/* 'T' */}
      <path
        d="M 245 27 L 267 27 L 267 33.5 L 259.5 33.5 L 259.5 56 L 252 56 L 252 33.5 L 245 33.5 Z"
        fill={textColor}
      />

      {/* 'H' */}
      <path
        d="M 273 27 L 280.5 27 L 280.5 38.5 L 292.5 38.5 L 292.5 27 L 300 27 L 300 56 L 292.5 56 L 292.5 44.5 L 280.5 44.5 L 280.5 56 L 273 56 Z"
        fill={textColor}
      />

      {/* Green decorative separator dot / pill */}
      <circle cx="309" cy="41.5" r="3" fill={`url(#sidharthGreen_${variant})`} />

      {/* Subtitle: "SHUTTER & AUTOMATION" */}
      <g>
        <line
          x1="58"
          y1="64"
          x2="95"
          y2="64"
          stroke={`url(#sidharthGreen_${variant})`}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <text
          x="102"
          y="68"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="9"
          letterSpacing="3.5"
          fill={tagColor}
        >
          SHUTTER &amp; AUTOMATION
        </text>
        <line
          x1="288"
          y1="64"
          x2="325"
          y2="64"
          stroke={`url(#sidharthGreen_${variant})`}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );

  // If white-card variant requested, enclose in an ultra-crisp elevated white container
  if (isWhiteCard) {
    return (
      <div
        className={`bg-white rounded-xl px-3 py-1.5 border border-slate-200/80 shadow-xs flex items-center gap-2 select-none ${className}`}
      >
        {logoSvg}
      </div>
    );
  }

  return (
    <div className={`flex items-center select-none ${className}`}>
      {logoSvg}
    </div>
  );
};
