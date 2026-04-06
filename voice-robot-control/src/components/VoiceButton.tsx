interface Props {
  isRecording: boolean;
  isProcessing: boolean;
  disabled: boolean;
  onMouseDown: () => void;
  onMouseUp: () => void;
}

export function VoiceButton({ isRecording, isProcessing, disabled, onMouseDown, onMouseUp }: Props) {
  const baseClasses =
    'w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 select-none touch-none';

  let classes = baseClasses;
  let label = 'Hold to Talk';
  let icon = (
    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
    </svg>
  );

  if (disabled) {
    classes += ' bg-gray-700 text-gray-500 cursor-not-allowed';
  } else if (isProcessing) {
    classes += ' bg-yellow-600 text-white animate-pulse cursor-wait';
    label = 'Processing...';
    icon = (
      <svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  } else if (isRecording) {
    classes += ' bg-red-600 text-white scale-110 shadow-lg shadow-red-500/30';
    label = 'Listening...';
  } else {
    classes += ' bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95';
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        className={classes}
        onMouseDown={!disabled && !isProcessing ? onMouseDown : undefined}
        onMouseUp={!disabled && !isProcessing ? onMouseUp : undefined}
        onTouchStart={!disabled && !isProcessing ? onMouseDown : undefined}
        onTouchEnd={!disabled && !isProcessing ? onMouseUp : undefined}
        disabled={disabled || isProcessing}
      >
        {icon}
      </button>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}
