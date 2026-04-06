import { useState, useEffect, useCallback } from 'react';
import type { Robot } from './types';
import { fetchRobots } from './services/api';
import { useRobotStatus } from './hooks/useRobotStatus';
import { useChat } from './hooks/useChat';
import { useTTS } from './hooks/useTTS';
import { Sidebar } from './components/Sidebar';
import { ChatContainer } from './components/chat/ChatContainer';

export default function App() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [selectedSN, setSelectedSN] = useState<string | null>(null);
  const [robotsLoading, setRobotsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { status, currentMap, loading: statusLoading } = useRobotStatus(selectedSN);
  const { messages, isLoading, sendMessage, clearChat } = useChat(selectedSN);
  const { ttsEnabled, speak, toggleTTS } = useTTS();

  // Load robots on mount
  useEffect(() => {
    fetchRobots()
      .then(setRobots)
      .catch(console.error)
      .finally(() => setRobotsLoading(false));
  }, []);

  // Auto-speak assistant replies
  const handleSend = useCallback(
    async (text: string, isVoice?: boolean) => {
      const reply = await sendMessage(text, isVoice);
      if (reply && ttsEnabled) {
        speak(reply);
      }
    },
    [sendMessage, ttsEnabled, speak]
  );

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <Sidebar
        robots={robots}
        selectedSN={selectedSN}
        onSelectRobot={setSelectedSN}
        robotsLoading={robotsLoading}
        status={status}
        statusLoading={statusLoading}
        currentMap={currentMap}
        ttsEnabled={ttsEnabled}
        onToggleTTS={toggleTTS}
        onNewChat={clearChat}
        isSidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
      />

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-700">
          <button
            className="text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold">VoBotiq</h1>
          {selectedSN && status && (
            <span className="ml-auto text-xs text-gray-500">
              {robots.find((r) => r.serialNumber === selectedSN)?.displayName} &middot; {status.battery}%
            </span>
          )}
        </div>

        {/* Chat */}
        <ChatContainer
          messages={messages}
          isLoading={isLoading}
          onSend={handleSend}
        />
      </main>
    </div>
  );
}
