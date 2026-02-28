import mongoose, { Schema, model, models } from 'mongoose';

export interface IExercise {
  _id: mongoose.Types.ObjectId;
  name: string;
  category: 'strength' | 'cardio';
  muscle_groups: string[];
  equipment?: string;
  created_by?: mongoose.Types.ObjectId;
  is_custom: boolean;
  created_at: Date;
}

const ExerciseSchema = new Schema<IExercise>(
  {
    name: {
      type: String,
      required: [true, 'Exercise name is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['strength', 'cardio'],
      required: [true, 'Category is required'],
    },
    muscle_groups: {
      type: [String],
      required: [true, 'At least one muscle group is required'],
      validate: {
        validator: function (v: string[]) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one muscle group is required',
      },
    },
    equipment: {
      type: String,
      trim: true,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    is_custom: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

ExerciseSchema.index({ name: 1 });
ExerciseSchema.index({ category: 1 });
ExerciseSchema.index({ muscle_groups: 1 });

const Exercise = models.Exercise || model<IExercise>('Exercise', ExerciseSchema);

export default Exercise;
