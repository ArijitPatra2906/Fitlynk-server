import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStepLog extends Document {
  user_id: mongoose.Types.ObjectId;
  date: Date;
  steps: number;
  distance_km?: number;
  calories_burned?: number;
  source: 'manual' | 'device' | 'synced';
  created_at: Date;
  updated_at: Date;
}

const StepLogSchema = new Schema<IStepLog>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    steps: {
      type: Number,
      required: true,
      min: 0,
    },
    distance_km: {
      type: Number,
      min: 0,
    },
    calories_burned: {
      type: Number,
      min: 0,
    },
    source: {
      type: String,
      enum: ['manual', 'device', 'synced'],
      default: 'manual',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

StepLogSchema.index({ user_id: 1, date: -1 });
StepLogSchema.index({ user_id: 1, date: 1 }, { unique: true });

const StepLog: Model<IStepLog> =
  mongoose.models.StepLog || mongoose.model<IStepLog>('StepLog', StepLogSchema);

export default StepLog;
