import mongoose, { Schema, Document } from 'mongoose';

export type SessionStatus = 'active' | 'completed' | 'failed';
export type Tier = 'junior' | 'mid' | 'senior' | 'staff';

export interface BiometricSnapshot {
  timestamp: number;
  stressScore: number;   // 0.0 – 1.0
  heartRate: number;     // BPM
  wpm: number;
  fillerWordsPerMin: number;
}

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  company: string;
  tier: Tier;
  status: SessionStatus;
  score: number;
  xpEarned: number;
  passed: boolean;
  biometrics: BiometricSnapshot[];
  transcript: string;
  questions: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  questionMeta: any[];       // QuestionMeta[] (stored as Mixed for schema flexibility)
  answers: string[];         // per-question candidate answers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answerReviews: any[];      // QuestionReview[] from Gemini evaluator
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overallReview?: any;       // OverallReview from Gemini evaluator
  rewardName?: string;
  rewardSummary?: string;
  rewardImageUrl?: string;
  rewardGeneratedAt?: Date;
  startedAt: Date;
  endedAt?: Date;
}

const BiometricSnapshotSchema = new Schema<BiometricSnapshot>({
  timestamp:        Number,
  stressScore:      Number,
  heartRate:        Number,
  wpm:              Number,
  fillerWordsPerMin:Number,
}, { _id: false });

const SessionSchema = new Schema<ISession>({
  userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
  company:          { type: String, required: true },
  tier:             { type: String, enum: ['junior', 'mid', 'senior', 'staff'], required: true },
  status:           { type: String, enum: ['active', 'completed', 'failed'], default: 'active' },
  score:            { type: Number, default: 0 },
  xpEarned:         { type: Number, default: 0 },
  passed:           { type: Boolean, default: false },
  biometrics:       { type: [BiometricSnapshotSchema], default: [] },
  transcript:       { type: String, default: '' },
  questions:        { type: [String], default: [] },
  questionMeta:     [Schema.Types.Mixed],
  answers:          { type: [String], default: [] },
  answerReviews:    [Schema.Types.Mixed],
  overallReview:    Schema.Types.Mixed,
  rewardName:       String,
  rewardSummary:    String,
  rewardImageUrl:   String,
  rewardGeneratedAt: Date,
  startedAt:        { type: Date, default: Date.now },
  endedAt:          Date,
});

export const Session = mongoose.model<ISession>('Session', SessionSchema);
