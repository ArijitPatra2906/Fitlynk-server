import mongoose, { Schema, model, models } from 'mongoose';

export interface IServingSize {
  unit: string; // e.g., "piece", "egg", "slice", "cup", "scoop"
  grams: number; // weight in grams for this serving
  label?: string; // e.g., "1 large egg (50g)", "1 slice (28g)"
}

export interface IFood {
  _id: mongoose.Types.ObjectId;
  name: string;
  brand?: string;
  barcode?: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  serving_sizes?: IServingSize[]; // Common serving sizes
  source: 'usda' | 'open_food_facts' | 'custom';
  user_id?: mongoose.Types.ObjectId;
  created_at: Date;
}

const FoodSchema = new Schema<IFood>(
  {
    name: {
      type: String,
      required: [true, 'Food name is required'],
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
      index: true,
    },
    calories_per_100g: {
      type: Number,
      required: [true, 'Calories per 100g is required'],
      min: 0,
    },
    protein_per_100g: {
      type: Number,
      required: [true, 'Protein per 100g is required'],
      min: 0,
    },
    carbs_per_100g: {
      type: Number,
      required: [true, 'Carbs per 100g is required'],
      min: 0,
    },
    fat_per_100g: {
      type: Number,
      required: [true, 'Fat per 100g is required'],
      min: 0,
    },
    serving_sizes: {
      type: [
        {
          unit: { type: String, required: true },
          grams: { type: Number, required: true },
          label: { type: String },
        },
      ],
      default: [],
    },
    source: {
      type: String,
      enum: ['usda', 'open_food_facts', 'custom'],
      required: [true, 'Source is required'],
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

FoodSchema.index({ name: 1 });
FoodSchema.index({ user_id: 1, source: 1 });

const Food = models.Food || model<IFood>('Food', FoodSchema);

export default Food;
