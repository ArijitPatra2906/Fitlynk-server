import dotenv from 'dotenv';
import connectDB from '../config/database';
import Food from '../models/Food';

// Load environment variables
dotenv.config();

const commonFoods = [
  // Proteins
  {
    name: 'Chicken Breast',
    brand: 'Generic',
    calories_per_100g: 165,
    protein_per_100g: 31,
    carbs_per_100g: 0,
    fat_per_100g: 3.6,
    source: 'usda' as const,
  },
  {
    name: 'Salmon',
    brand: 'Generic',
    calories_per_100g: 208,
    protein_per_100g: 20,
    carbs_per_100g: 0,
    fat_per_100g: 13,
    source: 'usda' as const,
  },
  {
    name: 'Ground Beef (90% lean)',
    brand: 'Generic',
    calories_per_100g: 176,
    protein_per_100g: 20,
    carbs_per_100g: 0,
    fat_per_100g: 10,
    source: 'usda' as const,
  },
  {
    name: 'Eggs',
    brand: 'Generic',
    calories_per_100g: 155,
    protein_per_100g: 13,
    carbs_per_100g: 1.1,
    fat_per_100g: 11,
    serving_sizes: [
      { unit: 'large egg', grams: 50, label: '1 large egg (50g)' },
      { unit: 'medium egg', grams: 44, label: '1 medium egg (44g)' },
      { unit: 'extra large egg', grams: 56, label: '1 extra large egg (56g)' },
    ],
    source: 'usda' as const,
  },
  {
    name: 'Greek Yogurt (Non-fat)',
    brand: 'Generic',
    calories_per_100g: 59,
    protein_per_100g: 10,
    carbs_per_100g: 3.6,
    fat_per_100g: 0.4,
    source: 'usda' as const,
  },
  {
    name: 'Whey Protein Powder',
    brand: 'Generic',
    calories_per_100g: 375,
    protein_per_100g: 80,
    carbs_per_100g: 8,
    fat_per_100g: 5,
    serving_sizes: [
      { unit: 'scoop', grams: 30, label: '1 scoop (30g)' },
      { unit: 'scoops', grams: 60, label: '2 scoops (60g)' },
    ],
    source: 'custom' as const,
  },
  {
    name: 'Tuna (Canned in Water)',
    brand: 'Generic',
    calories_per_100g: 116,
    protein_per_100g: 26,
    carbs_per_100g: 0,
    fat_per_100g: 0.8,
    source: 'usda' as const,
  },

  // Carbs
  {
    name: 'Brown Rice',
    brand: 'Generic',
    calories_per_100g: 370,
    protein_per_100g: 7.9,
    carbs_per_100g: 77,
    fat_per_100g: 2.9,
    source: 'usda' as const,
  },
  {
    name: 'White Rice',
    brand: 'Generic',
    calories_per_100g: 365,
    protein_per_100g: 7.1,
    carbs_per_100g: 80,
    fat_per_100g: 0.7,
    source: 'usda' as const,
  },
  {
    name: 'Oats',
    brand: 'Generic',
    calories_per_100g: 389,
    protein_per_100g: 16.9,
    carbs_per_100g: 66,
    fat_per_100g: 6.9,
    source: 'usda' as const,
  },
  {
    name: 'Sweet Potato',
    brand: 'Generic',
    calories_per_100g: 86,
    protein_per_100g: 1.6,
    carbs_per_100g: 20,
    fat_per_100g: 0.1,
    source: 'usda' as const,
  },
  {
    name: 'Whole Wheat Bread',
    brand: 'Generic',
    calories_per_100g: 247,
    protein_per_100g: 13,
    carbs_per_100g: 41,
    fat_per_100g: 3.4,
    serving_sizes: [
      { unit: 'slice', grams: 28, label: '1 slice (28g)' },
      { unit: 'slices', grams: 56, label: '2 slices (56g)' },
    ],
    source: 'usda' as const,
  },
  {
    name: 'Pasta (Dry)',
    brand: 'Generic',
    calories_per_100g: 371,
    protein_per_100g: 13,
    carbs_per_100g: 75,
    fat_per_100g: 1.5,
    source: 'usda' as const,
  },
  {
    name: 'Quinoa',
    brand: 'Generic',
    calories_per_100g: 368,
    protein_per_100g: 14,
    carbs_per_100g: 64,
    fat_per_100g: 6,
    source: 'usda' as const,
  },

  // Fruits
  {
    name: 'Banana',
    brand: 'Generic',
    calories_per_100g: 89,
    protein_per_100g: 1.1,
    carbs_per_100g: 23,
    fat_per_100g: 0.3,
    serving_sizes: [
      { unit: 'medium banana', grams: 118, label: '1 medium banana (118g)' },
      { unit: 'large banana', grams: 136, label: '1 large banana (136g)' },
      { unit: 'small banana', grams: 101, label: '1 small banana (101g)' },
    ],
    source: 'usda' as const,
  },
  {
    name: 'Apple',
    brand: 'Generic',
    calories_per_100g: 52,
    protein_per_100g: 0.3,
    carbs_per_100g: 14,
    fat_per_100g: 0.2,
    source: 'usda' as const,
  },
  {
    name: 'Blueberries',
    brand: 'Generic',
    calories_per_100g: 57,
    protein_per_100g: 0.7,
    carbs_per_100g: 14,
    fat_per_100g: 0.3,
    source: 'usda' as const,
  },
  {
    name: 'Strawberries',
    brand: 'Generic',
    calories_per_100g: 32,
    protein_per_100g: 0.7,
    carbs_per_100g: 7.7,
    fat_per_100g: 0.3,
    source: 'usda' as const,
  },

  // Vegetables
  {
    name: 'Broccoli',
    brand: 'Generic',
    calories_per_100g: 34,
    protein_per_100g: 2.8,
    carbs_per_100g: 7,
    fat_per_100g: 0.4,
    source: 'usda' as const,
  },
  {
    name: 'Spinach',
    brand: 'Generic',
    calories_per_100g: 23,
    protein_per_100g: 2.9,
    carbs_per_100g: 3.6,
    fat_per_100g: 0.4,
    source: 'usda' as const,
  },
  {
    name: 'Avocado',
    brand: 'Generic',
    calories_per_100g: 160,
    protein_per_100g: 2,
    carbs_per_100g: 8.5,
    fat_per_100g: 15,
    source: 'usda' as const,
  },

  // Nuts & Seeds
  {
    name: 'Almonds',
    brand: 'Generic',
    calories_per_100g: 579,
    protein_per_100g: 21,
    carbs_per_100g: 22,
    fat_per_100g: 50,
    source: 'usda' as const,
  },
  {
    name: 'Peanut Butter',
    brand: 'Generic',
    calories_per_100g: 588,
    protein_per_100g: 25,
    carbs_per_100g: 20,
    fat_per_100g: 50,
    source: 'usda' as const,
  },
  {
    name: 'Walnuts',
    brand: 'Generic',
    calories_per_100g: 654,
    protein_per_100g: 15,
    carbs_per_100g: 14,
    fat_per_100g: 65,
    source: 'usda' as const,
  },

  // Dairy
  {
    name: 'Milk (Whole)',
    brand: 'Generic',
    calories_per_100g: 61,
    protein_per_100g: 3.2,
    carbs_per_100g: 4.8,
    fat_per_100g: 3.3,
    source: 'usda' as const,
  },
  {
    name: 'Cheddar Cheese',
    brand: 'Generic',
    calories_per_100g: 403,
    protein_per_100g: 25,
    carbs_per_100g: 1.3,
    fat_per_100g: 33,
    source: 'usda' as const,
  },
  {
    name: 'Cottage Cheese (Low-fat)',
    brand: 'Generic',
    calories_per_100g: 72,
    protein_per_100g: 12,
    carbs_per_100g: 2.7,
    fat_per_100g: 1,
    source: 'usda' as const,
  },

  // Other
  {
    name: 'Olive Oil',
    brand: 'Generic',
    calories_per_100g: 884,
    protein_per_100g: 0,
    carbs_per_100g: 0,
    fat_per_100g: 100,
    source: 'usda' as const,
  },
  {
    name: 'Honey',
    brand: 'Generic',
    calories_per_100g: 304,
    protein_per_100g: 0.3,
    carbs_per_100g: 82,
    fat_per_100g: 0,
    source: 'usda' as const,
  },
];

async function seedFoods() {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Checking existing foods...');
    const existingCount = await Food.countDocuments({ source: { $in: ['usda', 'custom'] } });

    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing foods. Skipping seed.`);
      console.log('To re-seed, delete all foods first.');
      process.exit(0);
    }

    console.log('Seeding foods...');
    const result = await Food.insertMany(commonFoods);

    console.log(`✅ Successfully seeded ${result.length} foods!`);
    console.log('Sample foods:');
    result.slice(0, 10).forEach((food) => {
      console.log(
        `  - ${food.name}: ${food.calories_per_100g} kcal, P: ${food.protein_per_100g}g, C: ${food.carbs_per_100g}g, F: ${food.fat_per_100g}g`
      );
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding foods:', error);
    process.exit(1);
  }
}

seedFoods();
