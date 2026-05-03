import http from 'http';
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { connectDB } from './db/connect';
import { attachWebSocket, broadcast } from './ws/handler';
import { startAIWorker, setBroadcaster } from './ai/worker';

import authRoutes from './routes/auth';
import sessionRoutes from './routes/sessions';
import healthRoutes from './routes/health';

import {
  processInterviewRequest,
  processTextRequest,
} from './interview-agent/interview';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigin = process.env.FRONTEND_URL ?? '*';
app.use(cors({
  origin: allowedOrigin,
  credentials: allowedOrigin !== '*',
}));
app.use(express.json({ limit: '20mb' }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

// Legacy interview route (practice mode — no auth required)
app.post('/api/interview/process', async (req: express.Request, res: express.Response) => {
  try {
    const { audioBase64, transcript, jobDescription, mimeType, lastInterviewerAnswer, interviewType } = req.body as {
      audioBase64?: string;
      transcript?: string;
      jobDescription?: string;
      mimeType?: string;
      lastInterviewerAnswer?: string;
      interviewType?: string;
    };

    if (!audioBase64 && !transcript) {
      return res.status(400).json({ error: 'audioBase64 or transcript is required.' });
    }

    const result = transcript
      ? await processTextRequest(
          transcript,
          typeof jobDescription === 'string' ? jobDescription : undefined,
          typeof lastInterviewerAnswer === 'string' ? lastInterviewerAnswer : undefined,
          typeof interviewType === 'string' ? interviewType : undefined
        )
      : await processInterviewRequest(
          audioBase64!,
          typeof jobDescription === 'string' ? jobDescription : undefined,
          typeof mimeType === 'string' ? mimeType : undefined,
          typeof lastInterviewerAnswer === 'string' ? lastInterviewerAnswer : undefined,
          typeof interviewType === 'string' ? interviewType : undefined
        );

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

// ─── HTTP + WebSocket Server ──────────────────────────────────────────────────
const server = http.createServer(app);
attachWebSocket(server);

// Wire AI Worker broadcaster to WebSocket broadcast
setBroadcaster(broadcast);

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot(): Promise<void> {
  await connectDB();
  await startAIWorker();

  server.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`);
    console.log(`[Server] Gemini: ${Boolean(process.env.GEMINI_API_KEY) ? 'loaded' : 'missing'}`);
    console.log(`[Server] ElevenLabs: ${Boolean(process.env.ELEVENLABS_API_KEY) ? 'loaded' : 'missing'}`);
    console.log(`[Server] MongoDB: ${Boolean(process.env.MONGODB_URI) ? 'configured' : 'not configured'}`);
    console.log(`[Server] RabbitMQ: ${Boolean(process.env.RABBITMQ_URL) ? 'configured' : 'direct mode'}`);
  });
}

boot().catch((err) => {
  console.error('[Server] Boot failed:', err);
  process.exit(1);
});
