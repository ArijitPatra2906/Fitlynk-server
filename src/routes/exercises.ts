import { Router } from 'express'
import Exercise from '../models/Exercise'
import { errorResponse, successResponse } from '../utils/auth'
import { authenticateUser, AuthRequest } from '../middleware/auth'

const router = Router()

router.use(authenticateUser)

// GET /api/exercises
router.get('/', async (req: AuthRequest, res) => {
  try {
    const {
      category,
      muscle_group,
      difficulty,
      search,
      page = '1',
      limit = '20',
    } = req.query

    const filter: any = {
      is_active: true,
      $or: [
        { is_custom: false },
        { is_custom: true, created_by: req.user._id },
      ],
    }

    if (category && category !== 'all') {
      filter.category = category
    }

    if (muscle_group && muscle_group !== 'all') {
      filter.muscle_groups = muscle_group
    }

    if (difficulty && difficulty !== 'all') {
      filter.difficulty = difficulty
    }

    if (search) {
      filter.name = { $regex: search, $options: 'i' }
    }

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const skip = (pageNum - 1) * limitNum

    const [exercises, total] = await Promise.all([
      Exercise.find(filter).sort({ name: 1 }).skip(skip).limit(limitNum),
      Exercise.countDocuments(filter),
    ])

    return successResponse(res, {
      exercises,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (error: any) {
    console.error('Get exercises error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

// POST /api/exercises
router.post('/', async (req: AuthRequest, res) => {
  try {
    const exercise = await Exercise.create({
      ...req.body,
      created_by: req.user._id,
      is_custom: true,
    })

    return successResponse(res, exercise, 201)
  } catch (error: any) {
    console.error('Create exercise error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

// PUT /api/exercises/:id
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params

    // Find the exercise
    const exercise = await Exercise.findById(id)

    if (!exercise) {
      return errorResponse(res, 'Exercise not found', 404)
    }

    // Check if user owns the exercise (only custom exercises can be edited)
    if (
      !exercise.is_custom ||
      exercise.created_by.toString() !== req.user._id.toString()
    ) {
      return errorResponse(
        res,
        'You can only edit your own custom exercises',
        403,
      )
    }

    // Update the exercise
    const updatedExercise = await Exercise.findByIdAndUpdate(
      id,
      { ...req.body },
      { new: true, runValidators: true },
    )

    return successResponse(res, updatedExercise)
  } catch (error: any) {
    console.error('Update exercise error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

// DELETE /api/exercises/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params

    // Find the exercise
    const exercise = await Exercise.findById(id)

    if (!exercise) {
      return errorResponse(res, 'Exercise not found', 404)
    }

    // Check if user owns the exercise (only custom exercises can be deleted)
    if (
      !exercise.is_custom ||
      exercise.created_by.toString() !== req.user._id.toString()
    ) {
      return errorResponse(
        res,
        'You can only delete your own custom exercises',
        403,
      )
    }

    // Delete the exercise
    await Exercise.findByIdAndDelete(id)

    return successResponse(res, { message: 'Exercise deleted successfully' })
  } catch (error: any) {
    console.error('Delete exercise error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

export default router
