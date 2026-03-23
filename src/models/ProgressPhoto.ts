import mongoose, { Schema, model, models } from 'mongoose';

export interface IProgressPhoto {
  _id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  photo_url: string; // Firebase Storage URL
  thumbnail_url?: string; // Optional thumbnail URL for faster loading
  caption?: string;
  taken_at: Date; // When the photo was taken
  weight_kg?: number; // Optional weight at the time of photo
  body_fat_pct?: number; // Optional body fat percentage
  tags?: string[]; // Tags like 'front', 'back', 'side', 'flexed', etc.
  created_at: Date;
  updated_at: Date;
}

const ProgressPhotoSchema = new Schema<IProgressPhoto>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    photo_url: {
      type: String,
      required: [true, 'Photo URL is required'],
    },
    thumbnail_url: {
      type: String,
    },
    caption: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    taken_at: {
      type: Date,
      required: [true, 'Photo date is required'],
      index: true,
    },
    weight_kg: {
      type: Number,
      min: 20,
      max: 500,
    },
    body_fat_pct: {
      type: Number,
      min: 0,
      max: 100,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Compound index for efficient querying by user and date
ProgressPhotoSchema.index({ user_id: 1, taken_at: -1 });

const ProgressPhoto =
  models.ProgressPhoto || model<IProgressPhoto>('ProgressPhoto', ProgressPhotoSchema);

export default ProgressPhoto;