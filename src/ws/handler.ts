import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import { Session } from "../models/Session";
import {
  QUEUE_TELEMETRY,
  QUEUE_TRANSCRIPT,
  publishToQueue,
  initSession,
  clearSession,
  triggerCoachingDirect,
  updateTranscriptDirect,
} from "../ai/worker";
import mongoose from "mongoose";

export type WebSocketBroadcaster = (sessionId: string, payload: object) => void;

// sessionId → set of WS clients
const sessionClients = new Map<string, Set<WebSocket>>();

export function broadcast(sessionId: string, payload: object): void {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

function getUserIdFromToken(token: string): string | null {
  try {
    const secret = process.env.JWT_SECRET ?? "dev-secret-change-me";
    const payload = jwt.verify(token, secret) as { userId: string };
    return payload.userId;
  } catch {
    return null;
  }
}

export function attachWebSocket(server: import("http").Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    console.log("[STEP 1] connection start");

    const url = new URL(req.url ?? "", "http://localhost");
    console.log("[STEP 2] url parsed");

    const token = url.searchParams.get("token");
    const sessionId = url.searchParams.get("sessionId");
    console.log("[STEP 3] params", { token: !!token, sessionId });

    if (
      !sessionId ||
      typeof sessionId !== "string" ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      console.log("[STEP 4] invalid sessionId");
      ws.close(4002, "Invalid sessionId format");
      return;
    }

    console.log("[STEP 5] sessionId valid");

    if (!token) {
      console.log("[STEP 5.5] missing token");
      ws.close(4001, "Missing token");
      return;
    }

    const userId = getUserIdFromToken(token);
    console.log("[STEP 6] userId", userId);

    if (!userId) {
      console.log("[STEP 6.5] invalid token");
      ws.close(4001, "Invalid token");
      return;
    }

    let session = null;
    try {
      session = await Session.findOne({ _id: sessionId, userId });
      console.log("[STEP 7] DB query done");
    } catch (err) {
      console.error("[STEP 7 ERROR]", err);
    }

    console.log("[STEP 8] session result", session);

    if (!session) {
      console.log("[STEP 9] session not found");
      ws.close(4004, "Session not found");
      return;
    }

    if (!token || !sessionId) {
      ws.close(4001, "Missing token or sessionId");
      return;
    }

    console.log("[WS DEBUG]", {
      sessionId,
      userId,
      found: !!session,
    });

    if (!sessionClients.has(sessionId))
      sessionClients.set(sessionId, new Set());
    sessionClients.get(sessionId)!.add(ws);
    initSession(sessionId, session.questions[0] ?? "");

    console.log(`[WS] Client connected — session=${sessionId}`);
    ws.send(
      JSON.stringify({
        type: "connected",
        sessionId,
        questions: session.questions,
      }),
    );

    ws.on("message", async (raw) => {
      let msg: { type?: string; [key: string]: unknown };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === "telemetry") {
        const payload = {
          sessionId,
          stressScore: Number(msg.stressScore ?? 0),
          heartRate: Number(msg.heartRate ?? 70),
          wpm: Number(msg.wpm ?? 0),
          fillerWordsPerMin: Number(msg.fillerWordsPerMin ?? 0),
          timestamp: Date.now(),
        };

        Session.findByIdAndUpdate(sessionId, {
          $push: { biometrics: payload },
        }).catch(() => {});

        // Use shared RabbitMQ publish channel, or fall through to direct mode
        const published = publishToQueue(QUEUE_TELEMETRY, payload);
        if (!published) {
          triggerCoachingDirect(
            sessionId,
            payload,
            String(msg.transcriptSoFar ?? ""),
            String(msg.currentQuestion ?? session.questions[0] ?? ""),
          ).catch(console.error);
        }
      }

      if (msg.type === "transcript") {
        const payload = {
          sessionId,
          segment: String(msg.segment ?? ""),
          question: String(msg.question ?? session.questions[0] ?? ""),
          timestamp: Date.now(),
        };

        Session.findByIdAndUpdate(sessionId, {
          $set: { transcript: msg.fullTranscript ?? payload.segment },
        }).catch(() => {});

        const published = publishToQueue(QUEUE_TRANSCRIPT, payload);
        if (!published) {
          updateTranscriptDirect(sessionId, payload.segment, payload.question).catch(console.error);
        }
      }

      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    });

    ws.on("close", () => {
      sessionClients.get(sessionId)?.delete(ws);
      if (sessionClients.get(sessionId)?.size === 0) {
        sessionClients.delete(sessionId);
        clearSession(sessionId);
      }
      console.log(`[WS] Client disconnected — session=${sessionId}`);
    });
  });
}
