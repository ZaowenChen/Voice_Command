import { Router } from 'express';
import OpenAI from 'openai';
import { tools, executeTool } from '../services/chat-tools.js';
import { buildSystemPrompt } from '../services/chat-system-prompt.js';
import { hasGausiumCredentials } from '../services/gausium-auth.js';
import * as gausiumApi from '../services/gausium-api.js';
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from 'openai/resources/chat/completions';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_TOOL_ITERATIONS = 10;

// ── Confirmation gate helpers ──

const CONFIRMATION_PATTERN =
  /^(yes|yeah|yep|confirm|go ahead|do it|ok|sure|proceed|approved|execute|y|affirmative)[\.\!\s]*$/i;

/**
 * Check if the last user message in the incoming request is a confirmation.
 */
function lastUserMessageIsConfirmation(
  messages: Array<{ role: string; content: string }>
): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return CONFIRMATION_PATTERN.test(messages[i].content.trim());
    }
  }
  return false;
}

/**
 * Check if a prior assistant message in this request's history asked for confirmation.
 */
function priorAssistantAskedConfirmation(
  messages: Array<{ role: string; content: string }>
): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      const text = messages[i].content.toLowerCase();
      return (
        text.includes('confirmation_required') ||
        text.includes('shall i proceed') ||
        text.includes('should i proceed') ||
        text.includes('want me to') ||
        text.includes('confirm') ||
        text.includes('go ahead')
      );
    }
  }
  return false;
}

/**
 * Build a human-readable description of a send_command tool call.
 */
function describeCommand(args: Record<string, any>): string {
  const parts: string[] = [`${args.command_type || 'UNKNOWN'} on robot ${args.serial_number || 'unknown'}`];
  if (args.task_name) parts.push(`task: "${args.task_name}"`);
  if (args.position_name) parts.push(`position: "${args.position_name}"`);
  return parts.join(', ');
}

interface ToolCallRecord {
  toolName: string;
  args: Record<string, any>;
  result: string;
}

router.post('/chat', async (req, res) => {
  const { messages, selectedRobotSN } = req.body as {
    messages: Array<{ role: string; content: string }>;
    selectedRobotSN?: string;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided' });
  }

  // Only allow 'user' and 'assistant' roles from the client
  const sanitizedMessages = messages.filter(
    (m) => m.role === 'user' || m.role === 'assistant'
  );

  try {
    // Pre-fetch robot status for dynamic system prompt context (#5)
    let robotStatus = null;
    if (selectedRobotSN) {
      try {
        if (hasGausiumCredentials()) {
          robotStatus = await gausiumApi.getRobotStatus(selectedRobotSN);
        }
      } catch (statusErr) {
        console.warn('[chat] Failed to pre-fetch robot status:', (statusErr as Error).message);
      }
    }

    // Build conversation with system prompt
    const systemPrompt = buildSystemPrompt(selectedRobotSN, robotStatus);
    const conversation: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...sanitizedMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const toolCallRecords: ToolCallRecord[] = [];

    // Determine if the user has confirmed a prior send_command request
    const userConfirmed =
      lastUserMessageIsConfirmation(sanitizedMessages) &&
      priorAssistantAskedConfirmation(sanitizedMessages);

    let commandConfirmedThisRequest = userConfirmed;

    // Agentic loop: keep calling OpenAI until we get a text response
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: conversation,
        tools,
        tool_choice: 'auto',
        temperature: 0.3,
      });

      const choice = response.choices[0];
      if (!choice) throw new Error('No response from OpenAI');

      const assistantMessage = choice.message;

      // If no tool calls, we have the final text response
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        const reply = assistantMessage.content || '';
        console.log(`[chat] Reply (${i} tool rounds):`, reply.substring(0, 100));
        return res.json({ reply, toolCalls: toolCallRecords });
      }

      // Append assistant message with tool calls to conversation
      conversation.push(assistantMessage);

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, any> = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch (parseErr) {
          console.warn(`[chat] Failed to parse tool args for ${fnName}:`, toolCall.function.arguments);
        }

        console.log(`[chat] Tool call: ${fnName}(${JSON.stringify(fnArgs)})`);

        let result: string;

        // ── Confirmation gate: require operator confirmation for send_command ──
        if (fnName === 'send_command' && !commandConfirmedThisRequest) {
          const description = describeCommand(fnArgs);
          console.log(`[chat] Confirmation gate triggered for: ${description}`);
          result = JSON.stringify({
            status: 'CONFIRMATION_REQUIRED',
            description,
            message:
              'This command requires operator confirmation before execution. Please describe the command to the operator and ask them to confirm.',
          });
        } else {
          result = await executeTool(fnName, fnArgs);
          // Once a command is confirmed and executed, allow further commands in same request
          if (fnName === 'send_command') {
            commandConfirmedThisRequest = false; // Reset so next send_command also needs confirmation
          }
        }

        toolCallRecords.push({
          toolName: fnName,
          args: fnArgs,
          result,
        });

        // Append tool result to conversation
        const toolResultMessage: ChatCompletionToolMessageParam = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        };
        conversation.push(toolResultMessage);
      }
    }

    // If we hit max iterations, return what we have
    return res.json({
      reply: "I've been working on your request but it required too many steps. Could you try a simpler request?",
      toolCalls: toolCallRecords,
    });
  } catch (err: any) {
    console.error('[chat] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
