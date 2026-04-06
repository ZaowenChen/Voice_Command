import { Router } from 'express';
import OpenAI from 'openai';
import { tools, executeTool } from '../services/chat-tools.js';
import { buildSystemPrompt } from '../services/chat-system-prompt.js';
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from 'openai/resources/chat/completions';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_TOOL_ITERATIONS = 10;

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

  try {
    // Build conversation with system prompt
    const systemPrompt = buildSystemPrompt(selectedRobotSN);
    const conversation: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const toolCallRecords: ToolCallRecord[] = [];

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
        } catch {}

        console.log(`[chat] Tool call: ${fnName}(${JSON.stringify(fnArgs)})`);
        const result = await executeTool(fnName, fnArgs);

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
