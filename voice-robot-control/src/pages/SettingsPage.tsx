import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTTS } from '../hooks/useTTS';
import { useChat } from '../hooks/useChat';
import { VoiceBar } from '../components/VoiceBar';
import { AgentOverlay } from '../components/agent/AgentOverlay';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { ttsEnabled, toggleTTS, speak } = useTTS();
  const [notifications, setNotifications] = useState(true);
  const [agentOpen, setAgentOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');

  const { messages, isLoading: chatLoading, sendMessage, resetWithGreeting } = useChat(null);

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

  const handleSubmitTicket = () => {
    console.log('Support ticket submitted:', { subject: ticketSubject, description: ticketDescription });
    setTicketOpen(false);
    setTicketSubject('');
    setTicketDescription('');
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen pb-[70px]" style={{ background: '#0F1117' }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white">Settings</h1>
      </div>

      {/* User profile card */}
      <div className="mx-5 mb-6 rounded-xl p-4 flex items-center gap-4" style={{ background: '#1E293B', border: '1px solid #334155' }}>
        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
        </div>
      </div>

      {/* GENERAL section */}
      <div className="px-5 mb-6">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium mb-3">General</p>
        <div className="rounded-xl overflow-hidden" style={{ background: '#1E293B', border: '1px solid #334155' }}>
          {/* Voice replies */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-3.15a.75.75 0 011.28.53v12.74a.75.75 0 01-1.28.53l-4.72-3.15H3.75A.75.75 0 013 15v-6a.75.75 0 01.75-.75h3z" />
                </svg>
              </div>
              <span className="text-sm text-white">Voice replies</span>
            </div>
            <button
              onClick={toggleTTS}
              className={`w-11 h-6 rounded-full transition-colors relative ${ttsEnabled ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${ttsEnabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                </svg>
              </div>
              <span className="text-sm text-white">Language</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">English</span>
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-600/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </div>
              <span className="text-sm text-white">Notifications</span>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`w-11 h-6 rounded-full transition-colors relative ${notifications ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${notifications ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* SUPPORT section */}
      <div className="px-5 mb-6">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium mb-3">Support</p>
        <div className="rounded-xl overflow-hidden" style={{ background: '#1E293B', border: '1px solid #334155' }}>
          <button
            onClick={() => setTicketOpen(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-700/50 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                </svg>
              </div>
              <span className="text-sm text-white">Submit a ticket</span>
            </div>
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-600/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
              </div>
              <span className="text-sm text-white">Help center</span>
            </div>
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* ADVANCED section */}
      <div className="px-5 mb-8">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium mb-3">Advanced</p>
        <div className="rounded-xl overflow-hidden" style={{ background: '#1E293B', border: '1px solid #334155' }}>
          <button className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-700/50 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-600/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
              </div>
              <span className="text-sm text-white">API configuration</span>
            </div>
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-600/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm text-white">Activity log</span>
            </div>
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sign out + version */}
      <div className="px-5 pb-8 text-center">
        <button
          onClick={handleLogout}
          className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
        >
          Sign out
        </button>
        <p className="text-xs text-gray-600 mt-3">Cobotiq v1.0.0</p>
      </div>

      {/* Ticket modal */}
      {ticketOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setTicketOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl animate-slide-up"
            style={{ background: '#1E293B' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-white">Submit a ticket</h3>
              <button onClick={() => setTicketOpen(false)} className="text-gray-500 hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Subject</label>
                <input
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="What's the issue?"
                  className="w-full h-11 px-3 rounded-[10px] text-sm text-white placeholder-gray-500 outline-none"
                  style={{ background: '#0F1117', border: '1px solid #334155' }}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
                <textarea
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  placeholder="Describe the problem..."
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-[10px] text-sm text-white placeholder-gray-500 outline-none resize-none"
                  style={{ background: '#0F1117', border: '1px solid #334155' }}
                />
              </div>
              <button
                onClick={handleSubmitTicket}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </>
      )}

      {/* Voice Bar */}
      <VoiceBar
        contextHint="Submit a ticket"
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
