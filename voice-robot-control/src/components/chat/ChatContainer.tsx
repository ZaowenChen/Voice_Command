import type { ChatMessage } from '../../types';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string, isVoice?: boolean) => void;
}

export function ChatContainer({ messages, isLoading, onSend }: Props) {
  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />
      <ChatInput onSend={onSend} disabled={isLoading} />
    </div>
  );
}
