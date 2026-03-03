import mongoose, { Schema, model, models } from 'mongoose';

export interface IGoal {
  _id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  goal_type: 'lose' | 'maintain' | 'gain';
  calorie_target: number;
  step_target?: number;
  water_target_ml?: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  weight_goal_kg?: number;
  activity_level: 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extra_active';
  created_at: Date;
  updated_at: Date;
}

const GoalSchema = new Schema<IGoal>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    goal_type: {
      type: String,
      enum: ['lose', 'maintain', 'gain'],
      required: true,
    },
    calorie_target: {
      type: Number,
      required: true,
    },
    step_target: {
      type: Number,
      min: 0,
      default: 10000,
    },
    water_target_ml: {
      type: Number,
      min: 0,
      default: 3000,
    },
    protein_g: {
      type: Number,
      required: true,
    },
    carbs_g: {
      type: Number,
      required: true,
    },
    fat_g: {
      type: Number,
      required: true,
    },
    weight_goal_kg: {
      type: Number,
    },
    activity_level: {
      type: String,
      enum: ['sedentary', 'light', 'moderate', 'very_active', 'extra_active'],
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

GoalSchema.index({ user_id: 1 });

const Goal = models.Goal || model<IGoal>('Goal', GoalSchema);

export default Goal;
