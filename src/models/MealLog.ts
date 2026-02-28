import mongoose, { Schema, model, models } from 'mongoose';

export interface IMealLog {
  _id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  date: Date;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_id: mongoose.Types.ObjectId;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: Date;
}

const MealLogSchema = new Schema<IMealLog>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      index: true,
    },
    meal_type: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      required: [true, 'Meal type is required'],
    },
    food_id: {
      type: Schema.Types.ObjectId,
      ref: 'Food',
      required: [true, 'Food ID is required'],
    },
    serving_size: {
      type: Number,
      required: [true, 'Serving size is required'],
      min: 0.01,
    },
    serving_unit: {
      type: String,
      required: [true, 'Serving unit is required'],
      trim: true,
    },
    calories: {
      type: Number,
      required: [true, 'Calories is required'],
      min: 0,
    },
    protein_g: {
      type: Number,
      required: [true, 'Protein is required'],
      min: 0,
    },
    carbs_g: {
      type: Number,
      required: [true, 'Carbs is required'],
      min: 0,
    },
    fat_g: {
      type: Number,
      required: [true, 'Fat is required'],
      min: 0,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

MealLogSchema.index({ user_id: 1, date: -1 });

const MealLog = models.MealLog || model<IMealLog>('MealLog', MealLogSchema);

export default MealLog;
