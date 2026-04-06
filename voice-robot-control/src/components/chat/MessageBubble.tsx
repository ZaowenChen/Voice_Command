import type { ChatMessage } from '../../types';
import { TypingIndicator } from './TypingIndicator';
import { ToolActivityIndicator } from './ToolActivityIndicator';

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const isThinking = message.status === 'thinking';
  const isError = message.status === 'error';

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isThinking) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] bg-gray-800 rounded-2xl rounded-bl-sm">
          <TypingIndicator />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : isError
            ? 'bg-red-900/50 text-red-200 border border-red-700 rounded-bl-sm'
            : 'bg-gray-800 text-gray-100 rounded-bl-sm'
        }`}
      >
        {/* Voice indicator */}
        {isUser && message.isVoice && (
          <div className="flex items-center gap-1 mb-1">
            <svg className="w-3 h-3 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
            </svg>
            <span className="text-xs text-blue-300">Voice</span>
          </div>
        )}

        {/* Message content */}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

        {/* Tool activity */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <ToolActivityIndicator toolCalls={message.toolCalls} />
        )}

        {/* Timestamp */}
        <p className={`text-xs mt-1 ${isUser ? 'text-blue-300' : 'text-gray-500'}`}>{time}</p>
      </div>
    </div>
  );
}
