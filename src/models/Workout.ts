import mongoose, { Schema, model, models } from 'mongoose'

export interface ISet {
  set_number: number
  reps: number
  weight_kg: number
  duration_s?: number
  distance_m?: number
  is_warmup: boolean
  completed_at?: Date
}

export interface IExerciseInWorkout {
  exercise_id: mongoose.Types.ObjectId
  order_index: number
  sets: ISet[]
  notes?: string
}

export interface IWorkout {
  _id: mongoose.Types.ObjectId
  user_id: mongoose.Types.ObjectId
  name: string
  started_at: Date
  ended_at?: Date
  calories: number
  notes?: string
  is_template: boolean
  template_id?: mongoose.Types.ObjectId
  exercises: IExerciseInWorkout[]
  created_at: Date
  updated_at: Date
}

const SetSchema = new Schema<ISet>(
  {
    set_number: {
      type: Number,
      required: [true, 'Set number is required'],
      min: 1,
    },
    reps: {
      type: Number,
      min: 0,
      default: 0,
    },
    weight_kg: {
      type: Number,
      min: 0,
      default: 0,
    },
    duration_s: {
      type: Number,
      min: 0,
    },
    distance_m: {
      type: Number,
      min: 0,
    },
    is_warmup: {
      type: Boolean,
      default: false,
    },
    completed_at: {
      type: Date,
    },
  },
  { _id: false },
)

const ExerciseInWorkoutSchema = new Schema<IExerciseInWorkout>(
  {
    exercise_id: {
      type: Schema.Types.ObjectId,
      ref: 'Exercise',
      required: [true, 'Exercise ID is required'],
    },
    order_index: {
      type: Number,
      required: [true, 'Order index is required'],
      min: 0,
    },
    sets: {
      type: [SetSchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false },
)

const WorkoutSchema = new Schema<IWorkout>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Workout name is required'],
      trim: true,
    },
    started_at: {
      type: Date,
      required: false,
      index: true,
      validate: {
        validator: function(this: IWorkout, value: Date) {
          // started_at is required for workouts but not for templates
          if (!this.is_template && !value) {
            return false
          }
          return true
        },
        message: 'Start time is required for workouts'
      }
    },
    ended_at: {
      type: Date,
    },
    calories: {
      type: Number,
      min: 0,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    is_template: {
      type: Boolean,
      default: false,
      index: true,
    },
    template_id: {
      type: Schema.Types.ObjectId,
      ref: 'Workout',
    },
    exercises: {
      type: [ExerciseInWorkoutSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
)

WorkoutSchema.index({ user_id: 1, started_at: -1 })

const Workout = models.Workout || model<IWorkout>('Workout', WorkoutSchema)

export default Workout
