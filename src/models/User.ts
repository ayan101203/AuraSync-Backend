import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  displayName: string;
  xp: number;
  streak: number;
  lastSessionDate?: Date;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email:          { type: String, required: true, unique: true, lowercase: true },
  passwordHash:   { type: String, required: true },
  displayName:    { type: String, required: true },
  xp:             { type: Number, default: 0 },
  streak:         { type: Number, default: 0 },
  lastSessionDate:{ type: Date },
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);
