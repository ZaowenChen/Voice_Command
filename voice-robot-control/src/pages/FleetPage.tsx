import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Robot, RobotStatus } from '../types';
import { fetchRobots, fetchRobotStatus } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { VoiceBar } from '../components/VoiceBar';
import { AgentOverlay } from '../components/agent/AgentOverlay';
import { useChat } from '../hooks/useChat';
import { useTTS } from '../hooks/useTTS';

export function FleetPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [robots, setRobots] = useState<Robot[]>([]);
  const [statuses, setStatuses] = useState<Record<string, RobotStatus>>({});
  const [loading, setLoading] = useState(true);
  const [agentOpen, setAgentOpen] = useState(false);

  const { messages, isLoading: chatLoading, sendMessage, resetWithGreeting } = useChat(null);
  const { ttsEnabled, speak, toggleTTS } = useTTS();

  useEffect(() => {
    fetchRobots()
      .then(async (bots) => {
        setRobots(bots);
        // Fetch status for online robots
        const entries = await Promise.allSettled(
          bots.filter((r) => r.online).map(async (r) => {
            const s = await fetchRobotStatus(r.serialNumber);
            return [r.serialNumber, s] as const;
          })
        );
        const map: Record<string, RobotStatus> = {};
        for (const e of entries) {
          if (e.status === 'fulfilled') map[e.value[0]] = e.value[1];
        }
        setStatuses(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const onlineCount = robots.filter((r) => r.online).length;
  const offlineCount = robots.length - onlineCount;

  const initials = user?.name
    ?.split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  const handleOpenAgent = useCallback(() => {
    resetWithGreeting();
    setAgentOpen(true);
  }, [resetWithGreeting]);

  const handleSend = useCallback(
    async (text: string, isVoice?: boolean) => {
      const reply = await sendMessage(text, isVoice);
      if (reply && ttsEnabled) speak(reply);
    },
    [sendMessage, ttsEnabled, speak]
  );

  const handleVoiceMessage = useCallback(
    (transcript: string) => {
      if (!agentOpen) {
        resetWithGreeting();
        setAgentOpen(true);
      }
      setTimeout(() => {
        sendMessage(transcript, true).then((reply) => {
          if (reply && ttsEnabled) speak(reply);
        });
      }, 100);
    },
    [agentOpen, resetWithGreeting, sendMessage, ttsEnabled, speak]
  );

  const getStatusBadge = (robot: Robot) => {
    if (!robot.online) return { label: 'Offline', color: 'bg-red-500/20 text-red-400' };
    const s = statuses[robot.serialNumber];
    if (!s) return { label: 'Online', color: 'bg-green-500/20 text-green-400' };
    if (s.taskState === 'running') return { label: 'Cleaning', color: 'bg-green-500/20 text-green-400' };
    if (s.taskState === 'paused') return { label: 'Paused', color: 'bg-yellow-500/20 text-yellow-400' };
    return { label: 'Idle', color: 'bg-gray-500/20 text-gray-400' };
  };

  const getBatteryColor = (pct: number) => {
    if (pct > 50) return 'text-green-400';
    if (pct > 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen pb-[70px]" style={{ background: '#0F1117' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">My fleet</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {robots.length} robots, {onlineCount} online
          </p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-semibold text-white"
        >
          {initials}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 px-5 mb-6">
        <div className="rounded-xl p-3" style={{ background: '#1E293B' }}>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-white mt-1">{robots.length}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: '#064E3B33' }}>
          <p className="text-[10px] text-green-400/70 uppercase tracking-wider">Online</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{onlineCount}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: '#7F1D1D33' }}>
          <p className="text-[10px] text-red-400/70 uppercase tracking-wider">Offline</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{offlineCount}</p>
        </div>
      </div>

      {/* Robot list */}
      <div className="px-5">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium mb-3">Robots</p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : robots.length === 0 ? (
          <p className="text-center text-gray-500 py-12 text-sm">No robots found</p>
        ) : (
          <div className="space-y-3">
            {robots.map((robot) => {
              const badge = getStatusBadge(robot);
              const s = statuses[robot.serialNumber];
              const isOffline = !robot.online;

              return (
                <button
                  key={robot.serialNumber}
                  onClick={() => navigate(`/robot/${robot.serialNumber}`)}
                  className={`w-full text-left rounded-xl p-4 transition-colors active:scale-[0.98] ${
                    isOffline ? 'opacity-50' : 'hover:bg-white/5'
                  }`}
                  style={{ background: '#1E293B', border: '1px solid #334155' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{robot.displayName}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{robot.serialNumber}</p>
                    </div>
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>

                  {s && (
                    <div className="flex items-center gap-4 mt-3 text-[11px]">
                      <span className={getBatteryColor(s.battery)}>
                        <svg className="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z" />
                        </svg>
                        {s.battery}%
                      </span>
                      {s.currentMap && (
                        <span className="text-gray-500 truncate">
                          <svg className="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                          </svg>
                          {s.currentMap}
                        </span>
                      )}
                    </div>
                  )}

                  {s?.taskState === 'running' && s.currentTask && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-gray-400">{s.currentTask}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-green-500 animate-progress" />
                      </div>
                    </div>
                  )}

                  {isOffline && (
                    <p className="text-[11px] text-gray-600 mt-2">Last seen: recently</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Voice Bar */}
      <VoiceBar
        contextHint="Check all robots"
        onOpenAgent={handleOpenAgent}
        onVoiceMessage={handleVoiceMessage}
      />

      {/* Agent Overlay */}
      <AgentOverlay
        isOpen={agentOpen}
        onClose={() => setAgentOpen(false)}
        messages={messages}
        isLoading={chatLoading}
        onSend={handleSend}
        ttsEnabled={ttsEnabled}
        onToggleTTS={toggleTTS}
      />
    </div>
  );
}
