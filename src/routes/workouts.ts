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

  basePayload.calories = await calculateWorkoutCalories(
    req.user._id.toString(),
    basePayload,
  )

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
      const totalSets = workout.exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0)
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
    }

    return successResponse(res, workout)
  } catch (error: any) {
    console.error('Update workout error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

// DELETE /api/workouts/:id
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
