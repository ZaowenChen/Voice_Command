import { Router } from 'express';
import { parseIntent } from '../services/openai.js';

const router = Router();

// POST /api/parse — transcript + context -> GPT -> command JSON
router.post('/parse', async (req, res) => {
  const { transcript, context } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: 'No transcript provided' });
  }

  if (!context?.serialNumber) {
    return res.status(400).json({ error: 'No robot context provided' });
  }

  try {
    const command = await parseIntent(transcript, context);
    console.log('[parse] Command:', JSON.stringify(command));
    res.json(command);
  } catch (err: any) {
    console.error('[parse] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
