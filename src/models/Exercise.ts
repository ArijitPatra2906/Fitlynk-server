import mongoose, { Schema, model, models } from 'mongoose'

export interface IExercise {
  _id: mongoose.Types.ObjectId
  name: string
  category: 'strength' | 'cardio' | 'mobility' | 'plyometric'
  muscle_groups: string[]
  primary_muscle?: string
  secondary_muscles?: string[]
  equipment?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  exercise_type?: 'compound' | 'isolation'
  calories_per_minute?: number
  instructions?: string[]
  created_by?: mongoose.Types.ObjectId
  is_custom: boolean
  is_active: boolean
  created_at: Date
}

const ExerciseSchema = new Schema<IExercise>(
  {
    name: {
      type: String,
      required: [true, 'Exercise name is required'],
      trim: true,
      unique: true,
    },

    category: {
      type: String,
      enum: ['strength', 'cardio', 'mobility', 'plyometric'],
      required: [true, 'Category is required'],
    },

    muscle_groups: {
      type: [String],
      required: [true, 'At least one muscle group is required'],
      validate: {
        validator: function (v: string[]) {
          return Array.isArray(v) && v.length > 0
        },
        message: 'At least one muscle group is required',
      },
      index: true,
    },

    primary_muscle: {
      type: String,
      trim: true,
    },

    secondary_muscles: {
      type: [String],
      default: [],
    },

    equipment: {
      type: String,
      trim: true,
    },

    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },

    exercise_type: {
      type: String,
      enum: ['compound', 'isolation'],
    },

    calories_per_minute: {
      type: Number,
      min: 0,
    },

    instructions: {
      type: [String],
      default: [],
    },

    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    is_custom: {
      type: Boolean,
      default: false,
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  },
)

/* INDEXES */

// Prevent duplicate exercise names
ExerciseSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
)

// Filters
ExerciseSchema.index({ category: 1 })
ExerciseSchema.index({ difficulty: 1 })
ExerciseSchema.index({ equipment: 1 })

// Multi-key index for array search
ExerciseSchema.index({ muscle_groups: 1 })

// Active exercises filter (very common query)
ExerciseSchema.index({ is_active: 1 })

// Compound index for exercise discovery
ExerciseSchema.index({
  category: 1,
  difficulty: 1,
  muscle_groups: 1,
})

const Exercise = models.Exercise || model<IExercise>('Exercise', ExerciseSchema)

export default Exercise
