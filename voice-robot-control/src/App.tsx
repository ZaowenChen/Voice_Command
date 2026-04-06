import { useState, useEffect, useCallback } from 'react';
import type { Robot } from './types';
import { fetchRobots } from './services/api';
import { useRobotStatus } from './hooks/useRobotStatus';
import { useChat } from './hooks/useChat';
import { useTTS } from './hooks/useTTS';
import { TopNav } from './components/dashboard/TopNav';
import { Dashboard } from './components/dashboard/Dashboard';
import { FloatingAgentButton } from './components/agent/FloatingAgentButton';
import { AgentOverlay } from './components/agent/AgentOverlay';

export default function App() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [selectedSN, setSelectedSN] = useState<string | null>(null);
  const [robotsLoading, setRobotsLoading] = useState(true);
  const [agentOpen, setAgentOpen] = useState(false);

  const selectedRobot = robots.find((r) => r.serialNumber === selectedSN) || null;
  const { status, currentMap, loading: statusLoading } = useRobotStatus(selectedSN);
  const { messages, isLoading, sendMessage, resetWithGreeting } = useChat(selectedSN);
  const { ttsEnabled, speak, toggleTTS } = useTTS();

  // Load robots on mount
  useEffect(() => {
    fetchRobots()
      .then(setRobots)
      .catch(console.error)
      .finally(() => setRobotsLoading(false));
  }, []);

  // Open agent and send a pre-filled command (from dashboard buttons)
  const handleAgentCommand = useCallback(
    (command: string) => {
      if (!agentOpen) {
        resetWithGreeting(selectedRobot?.displayName);
        setAgentOpen(true);
      }
      // Small delay so the overlay renders before sending
      setTimeout(() => {
        sendMessage(command).then((reply) => {
          if (reply && ttsEnabled) speak(reply);
        });
      }, 100);
    },
    [agentOpen, resetWithGreeting, selectedRobot, sendMessage, ttsEnabled, speak]
  );

  // Open agent overlay
  const handleOpenAgent = useCallback(() => {
    resetWithGreeting(selectedRobot?.displayName);
    setAgentOpen(true);
  }, [resetWithGreeting, selectedRobot]);

  // Send message with TTS
  const handleSend = useCallback(
    async (text: string, isVoice?: boolean) => {
      const reply = await sendMessage(text, isVoice);
      if (reply && ttsEnabled) speak(reply);
    },
    [sendMessage, ttsEnabled, speak]
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <TopNav
        robots={robots}
        selectedSN={selectedSN}
        onSelectRobot={setSelectedSN}
        loading={robotsLoading}
      />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Dashboard
          robot={selectedRobot}
          status={status}
          statusLoading={statusLoading}
          currentMap={currentMap}
          onAgentCommand={handleAgentCommand}
        />
      </main>

      {/* Floating Agent */}
      <FloatingAgentButton
        onClick={handleOpenAgent}
        isOpen={agentOpen}
        hasNewMessage={false}
      />

      <AgentOverlay
        isOpen={agentOpen}
        onClose={() => setAgentOpen(false)}
        messages={messages}
        isLoading={isLoading}
        onSend={handleSend}
        ttsEnabled={ttsEnabled}
        onToggleTTS={toggleTTS}
      />
    </div>
  );
}
