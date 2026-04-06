import { useState, useEffect, useCallback } from 'react';
import type { Robot, CommandHistoryEntry } from './types';
import { fetchRobots } from './services/api';
import { useRobotStatus } from './hooks/useRobotStatus';
import { useVoiceCommand } from './hooks/useVoiceCommand';
import { RobotSelector } from './components/RobotSelector';
import { RobotStatusPanel } from './components/RobotStatusPanel';
import { LocalizationWarning } from './components/LocalizationWarning';
import { TaskList } from './components/TaskList';
import { NavigationPoints } from './components/NavigationPoints';
import { VoiceButton } from './components/VoiceButton';
import { TranscriptDisplay } from './components/TranscriptDisplay';
import { CommandConfirmation } from './components/CommandConfirmation';
import { CommandHistory } from './components/CommandHistory';

export default function App() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [selectedSN, setSelectedSN] = useState<string | null>(null);
  const [robotsLoading, setRobotsLoading] = useState(true);
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);

  const { status, currentMap, loading: statusLoading } = useRobotStatus(selectedSN);

  const handleCommandComplete = useCallback((entry: CommandHistoryEntry) => {
    setHistory((h) => [...h, entry]);
  }, []);

  const {
    isRecording,
    isProcessing,
    transcript,
    command,
    commandResult,
    error,
    startRecording,
    stopRecording,
  } = useVoiceCommand(selectedSN, currentMap, handleCommandComplete);

  useEffect(() => {
    fetchRobots()
      .then(setRobots)
      .catch(console.error)
      .finally(() => setRobotsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header */}
        <h1 className="text-xl font-bold text-center">Robot Voice Control</h1>

        {/* Robot Selector + Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-850 rounded-xl p-4 border border-gray-700">
          <RobotSelector
            robots={robots}
            selectedSN={selectedSN}
            onSelect={setSelectedSN}
            loading={robotsLoading}
          />
          <RobotStatusPanel status={status} loading={statusLoading} />
        </div>

        {/* Localization Warning */}
        {status && <LocalizationWarning localized={status.localized} />}

        {/* Tasks + Navigation */}
        {selectedSN && (
          <div className="grid grid-cols-2 gap-4 bg-gray-850 rounded-xl p-4 border border-gray-700">
            <TaskList currentMap={currentMap} />
            <NavigationPoints currentMap={currentMap} />
          </div>
        )}

        {/* Voice Control Section */}
        <div className="flex flex-col items-center gap-4 bg-gray-850 rounded-xl p-6 border border-gray-700">
          <VoiceButton
            isRecording={isRecording}
            isProcessing={isProcessing}
            disabled={!selectedSN}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
          />
          <TranscriptDisplay transcript={transcript} isProcessing={isProcessing} />
          <CommandConfirmation command={command} result={commandResult} error={error} />
        </div>

        {/* History */}
        <div className="bg-gray-850 rounded-xl p-4 border border-gray-700">
          <CommandHistory history={history} />
        </div>
      </div>
    </div>
  );
}
