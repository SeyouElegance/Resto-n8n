interface BetaBadgeProps {
  className?: string;
}

export function BetaBadge({ className = "" }: BetaBadgeProps) {
  return (
    <div
      className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${className}`}
    >
      {/* Glass background */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-lg"></div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-full"></div>

      {/* Content */}
      <div className="relative z-10 flex items-center gap-2">
        <span className="text-white/90 font-medium">BETA</span>
      </div>

      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-full animate-pulse"></div>
    </div>
  );
}
