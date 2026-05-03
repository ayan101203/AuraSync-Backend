import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { Session, Tier } from '../models/Session';
import { CoachingEvent } from '../models/CoachingEvent';
import { User } from '../models/User';
import { getQuestionsWithMeta, COMPANIES } from '../data/questions';
import { evaluateSession } from '../ai/evaluator';
import { createSessionReward } from '../rewards/badge';

const router = Router();
router.use(requireAuth);

const REWARD_STRESS_THRESHOLD = 65;
const REWARD_ANSWER_THRESHOLD = 50;

function getAverageStressPct(session: { biometrics?: Array<{ stressScore?: number }> }): number {
  const samples = session.biometrics ?? [];
  if (samples.length === 0) return 100;
  const avg = samples.reduce((sum, sample) => sum + (Number(sample.stressScore) || 0), 0) / samples.length;
  return Math.round(avg * 100);
}

function getAverageAnswerScore(session: { answerReviews?: Array<{ score?: number }> }): number {
  const reviews = session.answerReviews ?? [];
  if (reviews.length === 0) return 0;
  return Math.round(
    reviews.reduce((sum, review) => sum + (Number(review.score) || 0), 0) / reviews.length
  );
}

// POST /api/sessions — create a new session
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { company, tier } = req.body as { company?: string; tier?: Tier };

    if (!company || !tier) {
      return res.status(400).json({ error: 'company and tier are required' });
    }
    if (!COMPANIES.includes(company)) {
      return res.status(400).json({ error: 'Unknown company' });
    }

    const { questions, meta } = getQuestionsWithMeta(company, tier);
    const session = await Session.create({
      userId: req.userId,
      company,
      tier,
      questions,
      questionMeta: meta,
      status: 'active',
    });

    return res.status(201).json({ session });
  } catch (err) {
    console.error('[Sessions/create]', err);
    return res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/sessions/:id — fetch a single session with coaching events
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const events = await CoachingEvent.find({ sessionId: session._id }).select('-audioBase64').sort({ createdAt: 1 });

    return res.json({ session, events });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// GET /api/sessions — list user's sessions (most recent first)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await Session.find({ userId: req.userId })
      .sort({ startedAt: -1 })
      .limit(60)
      .select('-biometrics -transcript');
    return res.json({ sessions });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// PATCH /api/sessions/:id/complete — end session, compute score, award XP
router.patch('/:id/complete', async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') return res.status(409).json({ error: 'Session already ended' });

    const { score, transcript, answers } = req.body as { score?: number; transcript?: string; answers?: string[] };
    const finalScore = typeof score === 'number' ? Math.min(100, Math.max(0, score)) : 60;

    if (typeof transcript === 'string') session.transcript = transcript;
    if (Array.isArray(answers)) session.answers = answers;

    const PASS_THRESHOLD: Record<string, number> = {
      junior: 55, mid: 60, senior: 65, staff: 70,
    };
    const passed = finalScore >= (PASS_THRESHOLD[session.tier] ?? 60);

    const XP_TABLE: Record<string, number> = {
      junior: 100, mid: 200, senior: 350, staff: 500,
    };
    const baseXp = XP_TABLE[session.tier] ?? 150;
    const xpEarned = passed ? baseXp + Math.round((finalScore - 55) * 3) : Math.round(baseXp * 0.3);

    session.status = 'completed';
    session.score = finalScore;
    session.passed = passed;
    session.xpEarned = xpEarned;
    session.endedAt = new Date();
    await session.save();

    // update user XP + streak
    const user = await User.findById(req.userId);
    if (user) {
      user.xp += xpEarned;
      const today = new Date().toDateString();
      const lastDay = user.lastSessionDate?.toDateString();
      if (lastDay !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        user.streak = lastDay === yesterday.toDateString() ? user.streak + 1 : 1;
        user.lastSessionDate = new Date();
      }
      await user.save();
    }

    return res.json({ session, xpEarned, passed });
  } catch (err) {
    console.error('[Sessions/complete]', err);
    return res.status(500).json({ error: 'Failed to complete session' });
  }
});

// POST /api/sessions/:id/review — Gemini-powered Q&A evaluation
router.post('/:id/review', async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const {
      answers,
      biometricScore,
    } = req.body as { answers?: string[]; biometricScore?: number };

    const finalAnswers  = answers ?? session.answers ?? [];
    const bioScore      = typeof biometricScore === 'number' ? biometricScore : 60;
    const questions     = session.questions;
    const meta          = session.questionMeta ?? [];
    const questionTypes = meta.map((m: { type?: string }) => m?.type ?? 'behavioral');

    const result = await evaluateSession({
      questions,
      questionTypes,
      answers: finalAnswers,
      biometricScore: bioScore,
      company: session.company,
      tier: session.tier,
    });

    // Persist reviews back to session
    session.answerReviews = result.questionReviews;
    session.overallReview = result.overallReview;
    session.score = result.overallReview.score;
    if (Array.isArray(answers)) session.answers = answers;
    session.markModified('score');
    session.markModified('answerReviews');
    session.markModified('overallReview');
    await session.save();

    return res.json(result);
  } catch (err) {
    console.error('[Sessions/review]', err);
    return res.status(500).json({ error: 'Evaluation failed' });
  }
});

// POST /api/sessions/:id/reward — generate or return a stored AI reward badge
router.post('/:id/reward', async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.passed) return res.status(400).json({ error: 'Reward badge is only available for passed sessions' });
    if (!session.overallReview || (session.answerReviews?.length ?? 0) === 0) {
      return res.status(400).json({ error: 'Finish the AI answer review before unlocking a validated reward badge' });
    }

    const avgStressPct = getAverageStressPct(session);
    const avgAnswerScore = getAverageAnswerScore(session);
    if (avgStressPct > REWARD_STRESS_THRESHOLD || avgAnswerScore < REWARD_ANSWER_THRESHOLD) {
      const blockers = [];
      if (avgStressPct > REWARD_STRESS_THRESHOLD) {
        blockers.push(`average stress must stay at ${REWARD_STRESS_THRESHOLD}% or lower (current ${avgStressPct}%)`);
      }
      if (avgAnswerScore < REWARD_ANSWER_THRESHOLD) {
        blockers.push(`answer quality must reach ${REWARD_ANSWER_THRESHOLD}/100 or higher (current ${avgAnswerScore}/100)`);
      }
      return res.status(400).json({
        error: `Reward badge still locked: ${blockers.join(' and ')}.`,
      });
    }

    if (session.rewardImageUrl && session.rewardName) {
      return res.json({
        rewardName: session.rewardName,
        rewardSummary: session.rewardSummary,
        rewardImageUrl: session.rewardImageUrl,
        rewardGeneratedAt: session.rewardGeneratedAt,
      });
    }

    const reward = await createSessionReward({
      company: session.company,
      tier: session.tier,
      score: session.overallReview?.score ?? session.score,
      answerScore: avgAnswerScore,
      communicationScore: session.overallReview?.communicationScore ?? session.score,
      avgStressPct,
      passed: session.passed,
    });

    session.rewardName = reward.rewardName;
    session.rewardSummary = reward.rewardSummary;
    session.rewardImageUrl = reward.rewardImageUrl;
    session.rewardGeneratedAt = reward.rewardGeneratedAt;
    await session.save();

    return res.json(reward);
  } catch (err) {
    console.error('[Sessions/reward]', err);
    return res.status(500).json({ error: 'Failed to generate reward badge' });
  }
});

// GET /api/sessions/leaderboard/top — top 10 by XP
router.get('/leaderboard/top', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await User.find()
      .sort({ xp: -1 })
      .limit(10)
      .select('displayName xp streak');
    return res.json({ leaderboard: users });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
