import mongoose, { Schema, model, models } from 'mongoose';

export interface IUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  password?: string;
  name: string;
  avatar_url?: string;
  height?: number;
  weight_kg?: number;
  date_of_birth?: Date;
  gender?: 'male' | 'female' | 'other';
  units: 'metric' | 'imperial';
  google_id?: string;
  auth_provider: 'email' | 'google';
  onboarding_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    avatar_url: {
      type: String,
    },
    height: {
      type: Number,
      min: [50, 'Height must be at least 50 cm'],
      max: [300, 'Height cannot exceed 300 cm'],
    },
    weight_kg: {
      type: Number,
      min: [20, 'Weight must be at least 20 kg'],
      max: [500, 'Weight cannot exceed 500 kg'],
    },
    date_of_birth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    units: {
      type: String,
      enum: ['metric', 'imperial'],
      default: 'metric',
    },
    google_id: {
      type: String,
      unique: true,
      sparse: true,
    },
    auth_provider: {
      type: String,
      enum: ['email', 'google'],
      default: 'email',
    },
    onboarding_completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

UserSchema.index({ email: 1 });
UserSchema.index({ google_id: 1 });

const User = models.User || model<IUser>('User', UserSchema);

export default User;
