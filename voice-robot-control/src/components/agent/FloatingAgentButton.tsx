interface Props {
  onClick: () => void;
  isOpen: boolean;
  hasNewMessage: boolean;
}

export function FloatingAgentButton({ onClick, isOpen, hasNewMessage }: Props) {
  if (isOpen) return null;

  return (
    <button
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gray-800 border-2 border-blue-500/50 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-105 transition-all duration-200 flex items-center justify-center group"
      onClick={onClick}
      title="Open Cobotiq Agent"
    >
      {/* Pulse ring when new message */}
      {hasNewMessage && (
        <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30" />
      )}

      <img
        src="/cobotiq-logo.png"
        alt="Cobotiq Agent"
        className="w-9 h-9 group-hover:scale-110 transition-transform"
      />
    </button>
  );
}
