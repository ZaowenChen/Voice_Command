import { useState, useCallback } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { sendVoiceAudio } from '../services/api';

interface Props {
  contextHint?: string;
  onOpenAgent: () => void;
  onVoiceMessage?: (transcript: string) => void;
}

export function VoiceBar({ contextHint, onOpenAgent, onVoiceMessage }: Props) {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleMicPress = useCallback(async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob.size > 0 && onVoiceMessage) {
        setIsTranscribing(true);
        try {
          const { transcript } = await sendVoiceAudio(blob);
          if (transcript.trim()) {
            onVoiceMessage(transcript);
          }
        } catch (err) {
          console.error('Voice transcription failed:', err);
        } finally {
          setIsTranscribing(false);
        }
      }
    } else {
      try {
        await startRecording();
      } catch (err) {
        console.error('Microphone access denied:', err);
      }
    }
  }, [isRecording, startRecording, stopRecording, onVoiceMessage]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      <div
        className="mx-auto max-w-lg flex items-center gap-3 px-4 py-2"
        style={{
          background: '#1E293B',
          borderTop: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '14px 14px 0 0',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3), 0 0 15px rgba(37, 99, 235, 0.08)',
        }}
      >
        {/* Mic button */}
        <button
          onClick={handleMicPress}
          className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            isRecording
              ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/30'
              : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-lg shadow-blue-600/20'
          }`}
        >
          {isTranscribing ? (
            <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        {/* Text area — tapping opens agent */}
        <button
          onClick={onOpenAgent}
          className="flex-1 min-w-0 text-left py-2"
        >
          <p className="text-sm text-gray-400 truncate">
            {isRecording ? (
              <span className="text-red-400">Listening...</span>
            ) : isTranscribing ? (
              <span className="text-blue-400">Transcribing...</span>
            ) : (
              'Ask VoBotiq anything...'
            )}
          </p>
          {contextHint && !isRecording && !isTranscribing && (
            <p className="text-[10px] text-gray-600 mt-0.5 truncate">Try: {contextHint}</p>
          )}
        </button>

        {/* Expand arrow */}
        <button
          onClick={onOpenAgent}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
