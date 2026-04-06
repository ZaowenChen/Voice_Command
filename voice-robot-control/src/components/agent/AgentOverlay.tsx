import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../types';
import { MessageList } from '../chat/MessageList';
import { ChatInput } from '../chat/ChatInput';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string, isVoice?: boolean) => void;
  ttsEnabled: boolean;
  onToggleTTS: () => void;
}

export function AgentOverlay({
  isOpen,
  onClose,
  messages,
  isLoading,
  onSend,
  ttsEnabled,
  onToggleTTS,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={overlayRef}
        className="fixed z-50 flex flex-col bg-gray-900 border border-gray-700 shadow-2xl shadow-black/50
          /* Mobile: bottom half, full width */
          bottom-0 left-0 right-0 h-[55vh]
          rounded-t-2xl
          /* Desktop: anchored bottom-right */
          md:bottom-6 md:right-6 md:left-auto md:top-auto
          md:w-[420px] md:h-[520px] md:rounded-2xl
          animate-slide-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <img src="/cobotiq-logo.png" alt="" className="w-6 h-6" />
            <span className="text-sm font-semibold text-white">Cobotiq Agent</span>
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Ready
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* TTS toggle */}
            <button
              className={`p-1.5 rounded-lg transition-colors ${
                ttsEnabled ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'
              }`}
              onClick={onToggleTTS}
              title={ttsEnabled ? 'Voice replies ON' : 'Voice replies OFF'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.8l4.7-3.5a.5.5 0 01.8.4v12.6a.5.5 0 01-.8.4L6.5 15.2H4a1 1 0 01-1-1v-4.4a1 1 0 011-1h2.5z" />
              </svg>
            </button>
            {/* Close */}
            <button
              className="text-gray-500 hover:text-white transition-colors p-1"
              onClick={onClose}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <MessageList messages={messages} />
        </div>

        {/* Input */}
        <ChatInput onSend={onSend} disabled={isLoading} />
      </div>
    </>
  );
}
