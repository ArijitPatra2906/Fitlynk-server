import mongoose, { Schema, model, models } from 'mongoose'

export interface IServingSize {
  unit: string
  grams: number
  label?: string
}

export interface IFood {
  _id: mongoose.Types.ObjectId
  name: string
  brand?: string
  barcode?: string

  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number

  serving_sizes?: IServingSize[]

  category?:
    | 'fruit'
    | 'vegetable'
    | 'grain'
    | 'protein'
    | 'dairy'
    | 'snack'
    | 'sweet'
    | 'meal'
    | 'street_food'
    | 'restaurant'
    | 'supplement'
    | 'packaged'
    | 'ingredient'

  region?: 'global' | 'indian' | 'bengali' | 'asian' | 'western'

  source:
    | 'usda'
    | 'indian_db'
    | 'bengali_db'
    | 'open_food_facts'
    | 'restaurant'
    | 'supplement'
    | 'packaged'
    | 'street_food'
    | 'custom'

  user_id?: mongoose.Types.ObjectId

  created_at: Date
}

const FoodSchema = new Schema<IFood>(
  {
    name: {
      type: String,
      required: [true, 'Food name is required'],
      trim: true,
      index: true,
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
      required: true,
      min: 0,
    },

    protein_per_100g: {
      type: Number,
      required: true,
      min: 0,
    },

    carbs_per_100g: {
      type: Number,
      required: true,
      min: 0,
    },

    fat_per_100g: {
      type: Number,
      required: true,
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

    category: {
      type: String,
      enum: [
        'fruit',
        'vegetable',
        'grain',
        'protein',
        'dairy',
        'snack',
        'sweet',
        'meal',
        'street_food',
        'restaurant',
        'supplement',
        'packaged',
        'ingredient',
      ],
      index: true,
    },

    region: {
      type: String,
      enum: ['global', 'indian', 'bengali', 'asian', 'western'],
      index: true,
    },

    source: {
      type: String,
      enum: [
        'usda',
        'indian_db',
        'bengali_db',
        'restaurant',
        'open_food_facts',
        'supplement',
        'street_food',
        'packaged',
        'custom',
      ],
      required: true,
    },

    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  },
)

FoodSchema.index({ name: 1 })
FoodSchema.index({ category: 1 })
FoodSchema.index({ region: 1 })
FoodSchema.index({ user_id: 1, source: 1 })

const Food = models.Food || model<IFood>('Food', FoodSchema)

export default Food
