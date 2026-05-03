import mongoose, { Schema, Document } from 'mongoose';

export interface ICoachingEvent extends Document {
  sessionId: mongoose.Types.ObjectId;
  trigger: 'stress_spike' | 'filler_surge' | 'wpm_low' | 'wpm_high' | 'periodic';
  stressScore: number;
  heartRate: number;
  wpm: number;
  fillerWordsPerMin: number;
  transcriptSegment: string;
  question: string;
  geminiPrompt: string;
  coachingNote: string;
  audioBase64: string;
  createdAt: Date;
}

const CoachingEventSchema = new Schema<ICoachingEvent>({
  sessionId:        { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  trigger:          { type: String, enum: ['stress_spike', 'filler_surge', 'wpm_low', 'wpm_high', 'periodic'] },
  stressScore:      Number,
  heartRate:        Number,
  wpm:              Number,
  fillerWordsPerMin:Number,
  transcriptSegment:String,
  question:         String,
  geminiPrompt:     String,
  coachingNote:     String,
  audioBase64:      String,
}, { timestamps: true });

export const CoachingEvent = mongoose.model<ICoachingEvent>('CoachingEvent', CoachingEventSchema);
