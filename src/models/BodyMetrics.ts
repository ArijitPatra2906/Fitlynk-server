import mongoose, { Schema, model, models } from 'mongoose';

export interface IBodyMetrics {
  _id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  recorded_at: Date;
  weight_kg: number;
  body_fat_pct?: number;
  waist_cm?: number;
  chest_cm?: number;
  arms_cm?: number;
  notes?: string;
  created_at: Date;
}

const BodyMetricsSchema = new Schema<IBodyMetrics>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    recorded_at: {
      type: Date,
      required: [true, 'Recorded date is required'],
      index: true,
    },
    weight_kg: {
      type: Number,
      required: [true, 'Weight is required'],
      min: 20,
      max: 500,
    },
    body_fat_pct: {
      type: Number,
      min: 0,
      max: 100,
    },
    waist_cm: {
      type: Number,
      min: 0,
    },
    chest_cm: {
      type: Number,
      min: 0,
    },
    arms_cm: {
      type: Number,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

BodyMetricsSchema.index({ user_id: 1, recorded_at: -1 });

const BodyMetrics = models.BodyMetrics || model<IBodyMetrics>('BodyMetrics', BodyMetricsSchema);

export default BodyMetrics;
