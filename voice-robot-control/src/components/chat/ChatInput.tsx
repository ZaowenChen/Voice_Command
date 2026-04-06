import { useState, useRef, useCallback } from 'react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { sendVoiceAudio } from '../../services/api';

interface Props {
  onSend: (text: string, isVoice?: boolean) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      inputRef.current?.focus();
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleMicToggle = useCallback(async () => {
    if (isRecording) {
      // Stop recording and transcribe
      setIsTranscribing(true);
      try {
        const blob = await stopRecording();
        if (blob.size > 0) {
          const { transcript } = await sendVoiceAudio(blob);
          if (transcript.trim()) {
            onSend(transcript.trim(), true);
          }
        }
      } catch (err: any) {
        console.error('Voice error:', err);
      } finally {
        setIsTranscribing(false);
      }
    } else {
      try {
        await startRecording();
      } catch {
        // Mic access denied
      }
    }
  }, [isRecording, startRecording, stopRecording, onSend]);

  const micBusy = isRecording || isTranscribing;

  return (
    <div className="border-t border-gray-700 px-4 py-3 bg-gray-900">
      <div className="flex items-center gap-2">
        {/* Mic button */}
        <button
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            isRecording
              ? 'bg-red-600 text-white animate-pulse'
              : isTranscribing
              ? 'bg-yellow-600 text-white animate-pulse'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          onClick={handleMicToggle}
          disabled={disabled || isTranscribing}
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isTranscribing ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
            </svg>
          )}
        </button>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-gray-800 border border-gray-600 rounded-full px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={isRecording ? 'Listening...' : 'Type a message or use the mic...'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || micBusy}
        />

        {/* Send button */}
        <button
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            text.trim() && !disabled
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'bg-gray-700 text-gray-500'
          }`}
          onClick={handleSend}
          disabled={!text.trim() || disabled}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <p className="text-xs text-red-400 mt-1 ml-12 animate-pulse">
          Recording... Click mic to stop
        </p>
      )}
    </div>
  );
}
