import dotenv from 'dotenv';
import connectDB from '../config/database';
import Exercise from '../models/Exercise';

// Load environment variables
dotenv.config();

const builtInExercises = [
  // Chest exercises
  { name: 'Bench Press', category: 'strength', muscle_groups: ['chest', 'triceps', 'shoulders'], equipment: 'barbell', is_custom: false },
  { name: 'Incline Bench Press', category: 'strength', muscle_groups: ['chest', 'triceps', 'shoulders'], equipment: 'barbell', is_custom: false },
  { name: 'Dumbbell Press', category: 'strength', muscle_groups: ['chest', 'triceps', 'shoulders'], equipment: 'dumbbell', is_custom: false },
  { name: 'Push-ups', category: 'strength', muscle_groups: ['chest', 'triceps', 'shoulders'], equipment: 'bodyweight', is_custom: false },
  { name: 'Chest Fly', category: 'strength', muscle_groups: ['chest'], equipment: 'dumbbell', is_custom: false },
  { name: 'Cable Crossover', category: 'strength', muscle_groups: ['chest'], equipment: 'cable', is_custom: false },

  // Back exercises
  { name: 'Deadlift', category: 'strength', muscle_groups: ['back', 'hamstrings', 'glutes'], equipment: 'barbell', is_custom: false },
  { name: 'Barbell Row', category: 'strength', muscle_groups: ['back', 'biceps'], equipment: 'barbell', is_custom: false },
  { name: 'Lat Pulldown', category: 'strength', muscle_groups: ['back', 'biceps'], equipment: 'cable', is_custom: false },
  { name: 'Pull-ups', category: 'strength', muscle_groups: ['back', 'biceps'], equipment: 'bodyweight', is_custom: false },
  { name: 'Dumbbell Row', category: 'strength', muscle_groups: ['back', 'biceps'], equipment: 'dumbbell', is_custom: false },
  { name: 'Seated Cable Row', category: 'strength', muscle_groups: ['back', 'biceps'], equipment: 'cable', is_custom: false },

  // Shoulder exercises
  { name: 'Overhead Press', category: 'strength', muscle_groups: ['shoulders', 'triceps'], equipment: 'barbell', is_custom: false },
  { name: 'Dumbbell Shoulder Press', category: 'strength', muscle_groups: ['shoulders', 'triceps'], equipment: 'dumbbell', is_custom: false },
  { name: 'Lateral Raise', category: 'strength', muscle_groups: ['shoulders'], equipment: 'dumbbell', is_custom: false },
  { name: 'Front Raise', category: 'strength', muscle_groups: ['shoulders'], equipment: 'dumbbell', is_custom: false },
  { name: 'Face Pull', category: 'strength', muscle_groups: ['shoulders', 'back'], equipment: 'cable', is_custom: false },

  // Legs exercises
  { name: 'Squat', category: 'strength', muscle_groups: ['quadriceps', 'glutes', 'hamstrings'], equipment: 'barbell', is_custom: false },
  { name: 'Front Squat', category: 'strength', muscle_groups: ['quadriceps', 'glutes'], equipment: 'barbell', is_custom: false },
  { name: 'Leg Press', category: 'strength', muscle_groups: ['quadriceps', 'glutes', 'hamstrings'], equipment: 'machine', is_custom: false },
  { name: 'Romanian Deadlift', category: 'strength', muscle_groups: ['hamstrings', 'glutes', 'back'], equipment: 'barbell', is_custom: false },
  { name: 'Leg Curl', category: 'strength', muscle_groups: ['hamstrings'], equipment: 'machine', is_custom: false },
  { name: 'Leg Extension', category: 'strength', muscle_groups: ['quadriceps'], equipment: 'machine', is_custom: false },
  { name: 'Lunges', category: 'strength', muscle_groups: ['quadriceps', 'glutes', 'hamstrings'], equipment: 'dumbbell', is_custom: false },
  { name: 'Calf Raise', category: 'strength', muscle_groups: ['calves'], equipment: 'machine', is_custom: false },

  // Arms exercises
  { name: 'Barbell Curl', category: 'strength', muscle_groups: ['biceps'], equipment: 'barbell', is_custom: false },
  { name: 'Dumbbell Curl', category: 'strength', muscle_groups: ['biceps'], equipment: 'dumbbell', is_custom: false },
  { name: 'Hammer Curl', category: 'strength', muscle_groups: ['biceps', 'forearms'], equipment: 'dumbbell', is_custom: false },
  { name: 'Tricep Dips', category: 'strength', muscle_groups: ['triceps', 'chest'], equipment: 'bodyweight', is_custom: false },
  { name: 'Tricep Pushdown', category: 'strength', muscle_groups: ['triceps'], equipment: 'cable', is_custom: false },
  { name: 'Skull Crusher', category: 'strength', muscle_groups: ['triceps'], equipment: 'barbell', is_custom: false },
  { name: 'Close Grip Bench Press', category: 'strength', muscle_groups: ['triceps', 'chest'], equipment: 'barbell', is_custom: false },

  // Core exercises
  { name: 'Plank', category: 'strength', muscle_groups: ['core'], equipment: 'bodyweight', is_custom: false },
  { name: 'Crunches', category: 'strength', muscle_groups: ['core'], equipment: 'bodyweight', is_custom: false },
  { name: 'Russian Twist', category: 'strength', muscle_groups: ['core'], equipment: 'bodyweight', is_custom: false },
  { name: 'Leg Raise', category: 'strength', muscle_groups: ['core'], equipment: 'bodyweight', is_custom: false },
  { name: 'Cable Crunch', category: 'strength', muscle_groups: ['core'], equipment: 'cable', is_custom: false },

  // Cardio exercises
  { name: 'Running', category: 'cardio', muscle_groups: ['legs', 'cardio'], equipment: 'none', is_custom: false },
  { name: 'Cycling', category: 'cardio', muscle_groups: ['legs', 'cardio'], equipment: 'bike', is_custom: false },
  { name: 'Rowing', category: 'cardio', muscle_groups: ['back', 'legs', 'cardio'], equipment: 'machine', is_custom: false },
  { name: 'Jump Rope', category: 'cardio', muscle_groups: ['cardio', 'calves'], equipment: 'jump rope', is_custom: false },
  { name: 'Elliptical', category: 'cardio', muscle_groups: ['cardio', 'legs'], equipment: 'machine', is_custom: false },
];

async function seedExercises() {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Checking existing exercises...');
    const existingCount = await Exercise.countDocuments({ is_custom: false });

    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing built-in exercises. Skipping seed.`);
      console.log('To re-seed, delete all exercises first.');
      process.exit(0);
    }

    console.log('Seeding exercises...');
    const result = await Exercise.insertMany(builtInExercises);

    console.log(`✅ Successfully seeded ${result.length} exercises!`);
    console.log('Sample exercises:');
    result.slice(0, 5).forEach(ex => {
      console.log(`  - ${ex.name} (${ex.category}, ${ex.muscle_groups.join(', ')})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding exercises:', error);
    process.exit(1);
  }
}

seedExercises();
