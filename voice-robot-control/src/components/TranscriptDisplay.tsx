interface Props {
  transcript: string | null;
  isProcessing: boolean;
}

export function TranscriptDisplay({ transcript, isProcessing }: Props) {
  if (!transcript && !isProcessing) return null;

  return (
    <div className="bg-gray-800 rounded-lg px-4 py-3">
      {isProcessing && !transcript ? (
        <p className="text-gray-400 text-sm animate-pulse">Transcribing audio...</p>
      ) : (
        <p className="text-gray-200 text-sm italic">"{transcript}"</p>
      )}
    </div>
  );
}
