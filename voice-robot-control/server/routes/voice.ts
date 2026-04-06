import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { transcribeAudio } from '../services/openai.js';

const router = Router();
const upload = multer({ dest: os.tmpdir() });

// POST /api/voice — audio blob -> Whisper -> transcript
router.post('/voice', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const tmpPath = req.file.path;
  // Rename with proper extension for Whisper
  const ext = req.file.originalname?.split('.').pop() || 'webm';
  const newPath = `${tmpPath}.${ext}`;

  try {
    fs.renameSync(tmpPath, newPath);
    const transcript = await transcribeAudio(newPath);
    console.log('[voice] Transcript:', transcript);
    res.json({ transcript });
  } catch (err: any) {
    console.error('[voice] Error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    // Cleanup temp files
    try { fs.unlinkSync(newPath); } catch {}
    try { fs.unlinkSync(tmpPath); } catch {}
  }
});

export default router;
