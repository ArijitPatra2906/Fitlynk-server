import { Router } from 'express'
import Workout from '../models/Workout'
import User from '../models/User'
import Exercise from '../models/Exercise'
import { errorResponse, successResponse } from '../utils/auth'
import { authenticateUser, AuthRequest } from '../middleware/auth'
import NotificationHelpers from '../services/notificationHelpers'

const router = Router()

const STRENGTH_MET = 5
const CARDIO_MET = 8
const MIXED_MET = (STRENGTH_MET + CARDIO_MET) / 2

const calculateWorkoutVolume = (exercises: any[] = []): number => {
  return exercises.reduce((totalVolume, exercise) => {
    const setVolume = (exercise.sets || []).reduce((acc: number, set: any) => {
      return acc + (set.weight_kg || 0) * (set.reps || 0)
    }, 0)
    return totalVolume + setVolume
  }, 0)
}

const calculateWorkoutCalories = async (
  userId: string,
  workoutData: any,
): Promise<number> => {
  if (workoutData.is_template) {
    return 0
  }

  if (!workoutData.started_at || !workoutData.ended_at) {
    return 0
  }

  const start = new Date(workoutData.started_at).getTime()
  const end = new Date(workoutData.ended_at).getTime()

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0
  }

  const durationHours = (end - start) / (1000 * 60 * 60)
  const exercises = workoutData.exercises || []
  const exerciseIds = exercises
    .map((exercise: any) => exercise.exercise_id?.toString())
    .filter((id: string | undefined) => !!id)

  const [user, exerciseDocs] = await Promise.all([
    User.findById(userId).select('weight_kg'),
    exerciseIds.length > 0
      ? Exercise.find({ _id: { $in: exerciseIds } }).select('category')
      : Promise.resolve([]),
  ])

  const userWeight = user?.weight_kg

  if (!userWeight || userWeight <= 0) {
    const totalVolume = calculateWorkoutVolume(exercises)
    return Math.round(totalVolume * 0.05)
  }

  const categoryMap = new Map(
    exerciseDocs.map((doc: any) => [doc._id.toString(), doc.category]),
  )

  const cardioCount = exerciseIds.reduce((count: number, id: string) => {
    return categoryMap.get(id) === 'cardio' ? count + 1 : count
  }, 0)

  const strengthCount = exerciseIds.length - cardioCount

  let met = STRENGTH_MET
  if (cardioCount > 0) {
    met = cardioCount > strengthCount ? CARDIO_MET : MIXED_MET
  }

  return Math.round(met * userWeight * durationHours)
}

const buildWorkoutPayload = async (req: AuthRequest, existingWorkout?: any) => {
  const {
    _id: _existingId,
    created_at: _existingCreatedAt,
    updated_at: _existingUpdatedAt,
    __v: _existingV,
    ...existingData
  } = existingWorkout || {}

  const {
    _id: _incomingId,
    created_at: _incomingCreatedAt,
    updated_at: _incomingUpdatedAt,
    __v: _incomingV,
    user_id: _incomingUserId,
    ...incomingData
  } = req.body || {}

  const basePayload = {
    ...existingData,
    ...incomingData,
    user_id: req.user._id,
  }

  console.log('[BUILD_PAYLOAD] is_template:', basePayload.is_template)
  console.log('[BUILD_PAYLOAD] Before cleanup:', {
    has_started_at: !!basePayload.started_at,
    has_ended_at: !!basePayload.ended_at,
    has_template_id: !!basePayload.template_id,
  })

  // If this is a template, remove workout-specific fields
  if (basePayload.is_template) {
    delete basePayload.started_at
    delete basePayload.ended_at
    delete basePayload.template_id
    console.log('[BUILD_PAYLOAD] Cleaned up template fields')
  }

  // Use calories from request body if provided, otherwise calculate it
  if (incomingData.calories !== undefined && incomingData.calories !== null) {
    basePayload.calories = incomingData.calories
  } else {
    basePayload.calories = await calculateWorkoutCalories(
      req.user._id.toString(),
      basePayload,
    )
  }

  return basePayload
}

// All routes require authentication
router.use(authenticateUser)

// GET /api/workouts
router.get('/', async (req: AuthRequest, res) => {
  try {
    const {
      is_template,
      search,
      page = '1',
      limit = '20',
      skip = '0',
      completed,
      startDate,
      endDate,
    } = req.query

    const filter: any = { user_id: req.user._id }

    if (is_template !== undefined) {
      filter.is_template = is_template === 'true'
    }

    if (search) {
      filter.name = { $regex: search, $options: 'i' }
    }

    // Filter by completed status (has ended_at)
    if (completed === 'true') {
      filter.ended_at = { $ne: null }
    } else if (completed === 'false') {
      // `null` query matches both explicit null and missing field.
      filter.ended_at = null
    }

    if (startDate && endDate) {
      const start = new Date(startDate as string)
      start.setHours(0, 0, 0, 0)
      const end = new Date(endDate as string)
      end.setHours(23, 59, 59, 999)

      // For completed workout views, filter by ended_at. Otherwise use started_at.
      const dateField = completed === 'true' ? 'ended_at' : 'started_at'
      const existingDateFilter = filter[dateField]

      if (
        existingDateFilter &&
        typeof existingDateFilter === 'object' &&
        !Array.isArray(existingDateFilter)
      ) {
        filter[dateField] = {
          ...existingDateFilter,
          $gte: start,
          $lte: end,
        }
      } else {
        filter[dateField] = {
          $gte: start,
          $lte: end,
        }
      }
    }

    // Support both page-based and skip-based pagination
    const limitNum = parseInt(limit as string)
    const skipNum =
      skip !== '0'
        ? parseInt(skip as string)
        : (parseInt(page as string) - 1) * limitNum
    const pageNum =
      skip !== '0'
        ? Math.floor(skipNum / limitNum) + 1
        : parseInt(page as string)

    const [workouts, total] = await Promise.all([
      Workout.find(filter)
        .populate('exercises.exercise_id', 'name category muscle_groups')
        .sort({ started_at: -1 })
        .limit(limitNum)
        .skip(skipNum),
      Workout.countDocuments(filter),
    ])

    return successResponse(res, {
      workouts,
      pagination: {
        page: pageNum,
        total,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        skip: skipNum,
      },
    })
  } catch (error: any) {
    console.error('Get workouts error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

// POST /api/workouts
router.post('/', async (req: AuthRequest, res) => {
  try {
    const payload = await buildWorkoutPayload(req)
    let workout = await Workout.create(payload)

    // Populate exercise references
    workout = (await Workout.findById(workout._id).populate(
      'exercises.exercise_id',
      'name category muscle_groups equipment',
    )) as any

    return successResponse(res, workout, 201)
  } catch (error: any) {
    console.error('Create workout error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

// GET /api/workouts/:id
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const workout = await Workout.findOne({
      _id: req.params.id,
      user_id: req.user._id,
    }).populate(
      'exercises.exercise_id',
      'name category muscle_groups equipment',
    )

    if (!workout) {
      return errorResponse(res, 'Workout not found', 404)
    }

    return successResponse(res, workout)
  } catch (error: any) {
    console.error('Get workout error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

// PUT /api/workouts/:id
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const existingWorkout = await Workout.findOne({
      _id: req.params.id,
      user_id: req.user._id,
    })

    if (!existingWorkout) {
      return errorResponse(res, 'Workout not found', 404)
    }

    const payload = await buildWorkoutPayload(req, existingWorkout.toObject())

    const workout = await Workout.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      payload,
      { new: true, runValidators: true },
    ).populate('exercises.exercise_id', 'name category muscle_groups equipment')

    if (!workout) {
      return errorResponse(res, 'Workout not found', 404)
    }

    // Trigger notifications if workout was just completed (ended_at was set)
    const wasCompleted = !existingWorkout.ended_at && workout.ended_at
    if (wasCompleted && !workout.is_template) {
      // Calculate workout stats
      const durationMs = new Date(workout.ended_at!).getTime() - new Date(workout.started_at).getTime()
      const durationMinutes = durationMs / (1000 * 60)
      const totalSets = workout.exercises.reduce((sum: number, ex: any) => sum + (ex.sets?.length || 0), 0)
      const volumeKg = calculateWorkoutVolume(workout.exercises)

      // Send workout completion notification
      NotificationHelpers.notifyWorkoutCompleted(req.user._id, {
        name: workout.name,
        duration_minutes: durationMinutes,
        total_sets: totalSets,
        volume_kg: volumeKg,
        calories: workout.calories,
      }).catch(err => console.error('Error sending workout notification:', err))

      // Check for PRs
      for (const exercise of workout.exercises) {
        if (!exercise.sets || exercise.sets.length === 0) continue

        const exerciseId = exercise.exercise_id
        const maxWeight = Math.max(...exercise.sets.map((s: any) => s.weight_kg || 0))

        if (maxWeight > 0 && exerciseId) {
          // Find historical max for this exercise
          const historicalWorkouts = await Workout.find({
            user_id: req.user._id,
            'exercises.exercise_id': exerciseId,
            ended_at: { $ne: null, $lt: workout.ended_at },
          })

          let previousMax = 0
          for (const hw of historicalWorkouts) {
            const ex = hw.exercises.find((e: any) => e.exercise_id?.toString() === exerciseId.toString())
            if (ex && ex.sets) {
              const hwMax = Math.max(...ex.sets.map((s: any) => s.weight_kg || 0))
              previousMax = Math.max(previousMax, hwMax)
            }
          }

          // If current weight is heavier than previous max, it's a PR!
          if (maxWeight > previousMax && previousMax > 0) {
            const exerciseName = typeof exerciseId === 'object' ? (exerciseId as any).name : 'Exercise'
            NotificationHelpers.notifyPR(req.user._id, exerciseName, maxWeight, previousMax)
              .catch(err => console.error('Error sending PR notification:', err))
          }
        }
      }

      // Check if all daily goals met
      NotificationHelpers.checkAndNotifyDailyGoals(req.user._id)
        .catch(err => console.error('Error checking daily goals:', err))

      // Auto-complete workout todo based on duration
      const Todo = (await import('../models/Todo')).default
      const todayStr = new Date().toISOString().split('T')[0]

      console.log(`🔍 [WORKOUT TODO AUTO-COMPLETE] Starting check for user ${req.user._id}`)
      console.log(`📅 Today's date string: ${todayStr}`)
      console.log(`⏱️  Workout duration: ${Math.round(durationMinutes)} minutes`)

      // Find incomplete workout-related todos for today
      const workoutTodos = await Todo.find({
        user_id: req.user._id,
        completed: false,
        due_date: todayStr,
        $or: [
          { title: /workout/i },
          { title: /exercise/i },
          { title: /gym/i },
          { title: /training/i },
        ],
      })

      console.log(`📝 Found ${workoutTodos.length} incomplete workout-related todos for today`)

      // Helper function to extract duration target from todo title/description
      const extractDurationTarget = (text: string): number | null => {
        // Match patterns like: "1 hour", "2 hours", "60 min", "90 minutes", "1hr", "1.5 hours"
        const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr)s?/i)
        if (hourMatch) {
          return parseFloat(hourMatch[1]) * 60 // Convert to minutes
        }

        const minMatch = text.match(/(\d+)\s*(?:min|minute)s?/i)
        if (minMatch) {
          return parseInt(minMatch[1])
        }

        return null
      }

      // Mark them as completed if duration target is met
      for (const todo of workoutTodos) {
        console.log(`\n📋 Checking todo: "${todo.title}"`)
        console.log(`   Due date: ${todo.due_date}`)
        console.log(`   Description: ${todo.description || 'N/A'}`)

        const combinedText = `${todo.title} ${todo.description || ''}`
        const targetMinutes = extractDurationTarget(combinedText)

        console.log(`   Extracted target: ${targetMinutes !== null ? targetMinutes + ' minutes' : 'None (will use default 60min)'}`)

        let shouldComplete = false

        if (targetMinutes !== null) {
          // Todo has a specific duration target - check if workout meets it
          if (durationMinutes >= targetMinutes) {
            shouldComplete = true
            console.log(`   ✅ COMPLETING: workout duration ${Math.round(durationMinutes)}min >= target ${targetMinutes}min`)
          } else {
            console.log(`   ⏭️  SKIPPING: workout duration ${Math.round(durationMinutes)}min < target ${targetMinutes}min`)
          }
        } else {
          // No specific target mentioned - use default 60 minute threshold
          if (durationMinutes >= 60) {
            shouldComplete = true
            console.log(`   ✅ COMPLETING: workout duration ${Math.round(durationMinutes)}min >= default 60min`)
          } else {
            console.log(`   ⏭️  SKIPPING: workout duration ${Math.round(durationMinutes)}min < default 60min`)
          }
        }

        if (shouldComplete) {
          try {
            const result = await Todo.findByIdAndUpdate(todo._id, {
              completed: true,
              completed_at: new Date(),
            })
            console.log(`   ✨ Successfully updated todo ${todo._id} in database`)
          } catch (err) {
            console.error(`   ❌ Error updating todo ${todo._id}:`, err)
          }
        }
      }

      console.log(`\n🏁 [WORKOUT TODO AUTO-COMPLETE] Check complete\n`)
    }

    return successResponse(res, workout)
  } catch (error: any) {
    console.error('Update workout error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

// DELETE /api/workouts/:id
router.post('/:id/to-template', async (req: AuthRequest, res) => {
  try {
    const existingWorkout = await Workout.findOne({
      _id: req.params.id,
      user_id: req.user._id,
    })

    if (!existingWorkout) {
      return errorResponse(res, 'Workout not found', 404)
    }

    // Create a new template based on the existing workout
    const templateName = req.body.name || `${existingWorkout.name} Template`

    const newTemplate = await Workout.create({
      user_id: req.user._id,
      name: templateName,
      is_template: true,
      exercises: existingWorkout.exercises.map((exercise: any) => ({
        exercise_id: exercise.exercise_id,
        order_index: exercise.order_index,
        notes: exercise.notes,
        sets: exercise.sets.map((set: any) => ({
          set_number: set.set_number,
          reps: set.reps,
          weight_kg: set.weight_kg,
          duration_s: set.duration_s,
          distance_m: set.distance_m,
          is_warmup: set.is_warmup,
          // Don't copy completed_at for templates
        })),
      })),
      notes: existingWorkout.notes,
    })

    const populatedTemplate = await Workout.findById(newTemplate._id).populate(
      'exercises.exercise_id',
    )

    return successResponse(res, populatedTemplate)
  } catch (error: any) {
    console.error('Create template from workout error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const workout = await Workout.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user._id,
    })

    if (!workout) {
      return errorResponse(res, 'Workout not found', 404)
    }

    return successResponse(res, { message: 'Workout deleted successfully' })
  } catch (error: any) {
    console.error('Delete workout error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

export default router
