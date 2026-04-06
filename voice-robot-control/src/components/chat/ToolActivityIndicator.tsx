import { useState } from 'react';
import type { ToolCallRecord } from '../../types';

interface Props {
  toolCalls: ToolCallRecord[];
}

const TOOL_LABELS: Record<string, string> = {
  list_robots: 'Looked up robots',
  get_robot_status: 'Checked robot status',
  get_site_info: 'Fetched site info',
  send_command: 'Sent command',
};

export function ToolActivityIndicator({ toolCalls }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        className="text-xs text-gray-500 hover:text-gray-400 flex items-center gap-1"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {toolCalls.length} tool{toolCalls.length > 1 ? 's' : ''} used
      </button>
      {expanded && (
        <ul className="mt-1 space-y-1 text-xs text-gray-500 pl-4 border-l border-gray-700">
          {toolCalls.map((tc, i) => (
            <li key={i} className="flex items-center gap-1">
              <span className="text-blue-400">&#9679;</span>
              <span>{TOOL_LABELS[tc.toolName] || tc.toolName}</span>
              {tc.args?.serial_number && (
                <span className="text-gray-600">({tc.args.serial_number.slice(-4)})</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
