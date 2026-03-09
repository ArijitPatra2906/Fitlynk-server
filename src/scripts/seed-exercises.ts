import dotenv from 'dotenv'
import connectDB from '../config/database'
import Exercise from '../models/Exercise'
import Exercises from '../../exercises.json'

dotenv.config()

async function seedExercises() {
  try {
    console.log('🔌 Connecting to database...')
    await connectDB()

    console.log('📦 Loading exercises from JSON...')

    // Normalize and remove duplicates within JSON
    const uniqueMap = new Map()

    Exercises.forEach((ex: any) => {
      const key = ex.name.trim().toLowerCase()

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          ...ex,
          name: ex.name.trim(),
          muscle_groups: ex.muscle_groups || [],
          secondary_muscles: ex.secondary_muscles || [],
          instructions: ex.instructions || [],
          is_custom: false,
          is_active: true,
        })
      }
    })

    const uniqueExercises = Array.from(uniqueMap.values())

    console.log(
      `🧹 Removed duplicates from JSON. ${uniqueExercises.length} unique exercises found.`,
    )

    // Fetch existing exercise names
    const existingExercises = await Exercise.find({}, { name: 1 }).lean()

    const existingNames = new Set(
      existingExercises.map((ex: any) => ex.name.trim().toLowerCase()),
    )

    // Filter only new exercises
    const exercisesToInsert = uniqueExercises.filter(
      (ex) => !existingNames.has(ex.name.trim().toLowerCase()),
    )

    if (exercisesToInsert.length === 0) {
      console.log('⚠️ No new exercises to insert.')
      process.exit(0)
    }

    console.log(`🚀 Inserting ${exercisesToInsert.length} new exercises...`)

    const result = await Exercise.insertMany(exercisesToInsert)

    console.log(`✅ Successfully seeded ${result.length} exercises!`)

    console.log('📋 Sample inserted exercises:')
    result.slice(0, 5).forEach((ex) => {
      console.log(
        `  - ${ex.name} (${ex.category}, ${ex.muscle_groups.join(', ')})`,
      )
    })

    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding exercises:', error)
    process.exit(1)
  }
}

seedExercises()
