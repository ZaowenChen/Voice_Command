import { useState, useCallback, useRef } from 'react';
import type { ChatMessage } from '../types';
import { sendChatMessage } from '../services/api';

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm VoBotiq, your robot operations assistant. I can check robot status, start cleaning tasks, navigate robots, and more. Select a robot from the sidebar or just ask me anything!",
  timestamp: Date.now(),
  status: 'complete',
};

export function useChat(selectedRobotSN: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string, isVoice = false) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
        isVoice,
        status: 'complete',
      };

      const thinkingMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        status: 'thinking',
      };

      setMessages((prev) => [...prev, userMsg, thinkingMsg]);
      setIsLoading(true);

      try {
        // Build API messages (only role + content, no UI metadata)
        // Filter out synthetic welcome message and cap history to last 20 messages
        const apiMessages = [...messages, userMsg]
          .filter((m) => m.id !== 'welcome')
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content }));

        const { reply, toolCalls } = await sendChatMessage(apiMessages, selectedRobotSN || undefined);

        const assistantMsg: ChatMessage = {
          id: thinkingMsg.id,
          role: 'assistant',
          content: reply,
          timestamp: Date.now(),
          toolCalls,
          status: 'complete',
        };

        setMessages((prev) =>
          prev.map((m) => (m.id === thinkingMsg.id ? assistantMsg : m))
        );

        return reply;
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          id: thinkingMsg.id,
          role: 'assistant',
          content: `Sorry, something went wrong: ${err.message}`,
          timestamp: Date.now(),
          status: 'error',
        };

        setMessages((prev) =>
          prev.map((m) => (m.id === thinkingMsg.id ? errorMsg : m))
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, selectedRobotSN, isLoading]
  );

  const clearChat = useCallback(() => {
    setMessages([
      {
        ...WELCOME_MESSAGE,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const resetWithGreeting = useCallback((robotName?: string) => {
    const greeting = robotName
      ? `Ready to command **${robotName}**. What's the next task?`
      : "Hi! Select a robot above and I can help manage it.";

    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: greeting,
        timestamp: Date.now(),
        status: 'complete',
      },
    ]);
  }, []);

  return { messages, isLoading, sendMessage, clearChat, resetWithGreeting };
}
