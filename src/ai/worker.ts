import amqplib, { Channel, ChannelModel } from 'amqplib';
import { GoogleGenAI } from '@google/genai';
import { synthesizeSpeech } from '../text-to-speech/tts';
import { CoachingEvent } from '../models/CoachingEvent';
import { buildCoachingPrompt, CoachingContext } from './coachingPrompt';
import { WebSocketBroadcaster } from '../ws/handler';

export const QUEUE_TELEMETRY = 'aurasync.telemetry';
export const QUEUE_TRANSCRIPT = 'aurasync.transcript';

export interface TelemetryMessage {
  sessionId: string;
  stressScore: number;
  heartRate: number;
  wpm: number;
  fillerWordsPerMin: number;
  timestamp: number;
}

export interface TranscriptMessage {
  sessionId: string;
  segment: string;
  question: string;
  timestamp: number;
}

// ─── In-memory session state ──────────────────────────────────────────────────
interface SessionState {
  latest: TelemetryMessage | null;
  transcript: string;
  question: string;
  lastCoachAt: number;
  coachingInFlight: boolean;
}

const sessions = new Map<string, SessionState>();
let broadcaster: WebSocketBroadcaster | null = null;

// Shared RabbitMQ publish channel (one connection for the whole process lifetime)
let publishChannel: Channel | null = null;

export function setBroadcaster(b: WebSocketBroadcaster): void {
  broadcaster = b;
}

export function initSession(sessionId: string, question: string): void {
  sessions.set(sessionId, {
    latest: null,
    transcript: '',
    question,
    lastCoachAt: 0,
    coachingInFlight: false,
  });
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Publish a message to a RabbitMQ queue using the shared channel.
 * Returns true if published, false if RabbitMQ is not available (direct mode).
 */
export function publishToQueue(queue: string, payload: object): boolean {
  if (!publishChannel) return false;
  try {
    publishChannel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), { persistent: true });
    return true;
  } catch {
    return false;
  }
}

function detectTrigger(state: SessionState): string | null {
  const t = state.latest;
  if (!t) return null;
  const now = Date.now();
  const COOLDOWN = 14_000;
  const transcriptLength = state.transcript.trim().length;
  if (now - state.lastCoachAt < COOLDOWN) return null;

  if (t.stressScore >= 0.56) return 'stress_spike';
  if (t.fillerWordsPerMin >= 3.5) return 'filler_surge';
  if (t.wpm > 0 && t.wpm < 95) return 'wpm_low';
  if (t.wpm > 190) return 'wpm_high';
  if (transcriptLength > 80 && now - state.lastCoachAt > 18_000) return 'periodic';
  return null;
}

async function runCoaching(sessionId: string, trigger: string, state: SessionState): Promise<void> {
  if (state.coachingInFlight) return;
  state.coachingInFlight = true;
  state.lastCoachAt = Date.now();

  try {
    const t = state.latest!;
    const ctx: CoachingContext = {
      stressScore: t.stressScore,
      heartRate: t.heartRate,
      wpm: t.wpm,
      fillerWordsPerMin: t.fillerWordsPerMin,
      transcriptSegment: state.transcript.slice(-400),
      question: state.question,
      trigger,
    };

    const prompt = buildCoachingPrompt(ctx);
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    let coachingNote = trigger === 'stress_spike'
      ? 'Pause for a breath. Relax your shoulders, take your time, and continue only when you feel steady.'
      : 'Take a slow, deep breath. Pause, collect your thoughts, then continue.';

    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      coachingNote = (response.text ?? '').trim() || coachingNote;
    }

    let audioBase64 = '';
    try {
      const audioBuf = await synthesizeSpeech(coachingNote);
      audioBase64 = audioBuf.toString('base64');
    } catch (err) {
      console.warn('[AIWorker] TTS failed, sending text-only note:', err);
    }

    try {
      await CoachingEvent.create({
        sessionId,
        trigger,
        stressScore: t.stressScore,
        heartRate: t.heartRate,
        wpm: t.wpm,
        fillerWordsPerMin: t.fillerWordsPerMin,
        transcriptSegment: ctx.transcriptSegment,
        question: state.question,
        geminiPrompt: prompt,
        coachingNote,
        audioBase64,
      });
    } catch (err) {
      console.warn('[AIWorker] DB persist failed:', err);
    }

    if (broadcaster) {
      broadcaster(sessionId, {
        type: 'coaching',
        coachingNote,
        audioBase64,
        trigger,
        stressScore: t.stressScore,
      });
    }

    console.log(`[AIWorker] Coaching sent — session=${sessionId} trigger=${trigger} note="${coachingNote.slice(0, 80)}"`);
  } catch (err) {
    console.error('[AIWorker] Coaching pipeline failed:', err);
  } finally {
    state.coachingInFlight = false;
  }
}

// Used by WS handler when RabbitMQ is not available
export async function triggerCoachingDirect(
  sessionId: string,
  telemetry: TelemetryMessage,
  transcript: string,
  question: string
): Promise<void> {
  let state = sessions.get(sessionId);
  if (!state) {
    state = { latest: null, transcript: '', question, lastCoachAt: 0, coachingInFlight: false };
    sessions.set(sessionId, state);
  }
  state.latest = telemetry;
  state.transcript = transcript.trim();
  state.question = question;

  const trigger = detectTrigger(state);
  if (trigger) {
    await runCoaching(sessionId, trigger, state);
  }
}

export async function updateTranscriptDirect(
  sessionId: string,
  segment: string,
  question: string
): Promise<void> {
  let state = sessions.get(sessionId);
  if (!state) {
    state = { latest: null, transcript: '', question, lastCoachAt: 0, coachingInFlight: false };
    sessions.set(sessionId, state);
  }

  state.transcript = `${state.transcript} ${segment}`.trim();
  state.question = question;

  const trigger = detectTrigger(state);
  if (trigger) {
    await runCoaching(sessionId, trigger, state);
  }
}

export async function startAIWorker(): Promise<void> {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    console.log('[AIWorker] RABBITMQ_URL not set — direct coaching mode');
    return;
  }

  try {
    const conn: ChannelModel = await amqplib.connect(url);
    console.log('[AIWorker] Connected to RabbitMQ');

    // Shared publish channel — used by WS handler to enqueue events
    publishChannel = await conn.createChannel();
    await publishChannel.assertQueue(QUEUE_TELEMETRY, { durable: true });
    await publishChannel.assertQueue(QUEUE_TRANSCRIPT, { durable: true });

    // Separate consume channel
    const consumeCh: Channel = await conn.createChannel();
    await consumeCh.assertQueue(QUEUE_TELEMETRY, { durable: true });
    await consumeCh.assertQueue(QUEUE_TRANSCRIPT, { durable: true });
    consumeCh.prefetch(1);

    console.log('[AIWorker] Consuming queues');

    consumeCh.consume(QUEUE_TELEMETRY, async (msg) => {
      if (!msg) return;
      try {
        const data: TelemetryMessage = JSON.parse(msg.content.toString());
        let state = sessions.get(data.sessionId);
        if (!state) {
          state = { latest: null, transcript: '', question: '', lastCoachAt: 0, coachingInFlight: false };
          sessions.set(data.sessionId, state);
        }
        state.latest = data;
        const trigger = detectTrigger(state);
        if (trigger) runCoaching(data.sessionId, trigger, state).catch(console.error);
      } catch (err) {
        console.error('[AIWorker] Bad telemetry message:', err);
      }
      consumeCh.ack(msg);
    });

    consumeCh.consume(QUEUE_TRANSCRIPT, async (msg) => {
      if (!msg) return;
      try {
        const data: TranscriptMessage = JSON.parse(msg.content.toString());
        let state = sessions.get(data.sessionId);
        if (!state) {
          state = { latest: null, transcript: '', question: '', lastCoachAt: 0, coachingInFlight: false };
          sessions.set(data.sessionId, state);
        }
        state.transcript = `${state.transcript} ${data.segment}`.trim();
        state.question = data.question;
        const trigger = detectTrigger(state);
        if (trigger) runCoaching(data.sessionId, trigger, state).catch(console.error);
      } catch (err) {
        console.error('[AIWorker] Bad transcript message:', err);
      }
      consumeCh.ack(msg);
    });

    conn.on('error', (err) => {
      console.error('[AIWorker] RabbitMQ connection error:', err.message);
      publishChannel = null;
    });
    conn.on('close', () => {
      console.warn('[AIWorker] RabbitMQ connection closed — falling back to direct mode');
      publishChannel = null;
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[AIWorker] RabbitMQ unavailable — direct coaching mode: ${msg}`);
    publishChannel = null;
  }
}
