import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import robotRoutes from './routes/robot.js';
import voiceRoutes from './routes/voice.js';
import parseRoutes from './routes/parse.js';
import chatRoutes from './routes/chat.js';

const app = express();
const PORT = Number(process.env.SERVER_PORT) || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api', robotRoutes);
app.use('/api', voiceRoutes);
app.use('/api', parseRoutes);
app.use('/api', chatRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`);
  console.log(`[server] Gausium credentials: ${process.env.GAUSIUM_CLIENT_ID ? 'configured' : 'NOT configured (using mock data)'}`);
  console.log(`[server] OpenAI key: ${process.env.OPENAI_API_KEY ? 'configured' : 'NOT configured'}`);
});
