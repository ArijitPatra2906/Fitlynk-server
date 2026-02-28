import { Router } from 'express';
import Workout from '../models/Workout';
import { errorResponse, successResponse } from '../utils/auth';
import { authenticateUser, AuthRequest } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// GET /api/workouts
router.get('/', async (req: AuthRequest, res) => {
  try {

    const { is_template, limit = '50', skip = '0' } = req.query;

    const filter: any = { user_id: req.user._id };

    if (is_template !== undefined) {
      filter.is_template = is_template === 'true';
    }

    const workouts = await Workout.find(filter)
      .populate('exercises.exercise_id', 'name category muscle_groups')
      .sort({ started_at: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(skip as string));

    const total = await Workout.countDocuments(filter);

    return successResponse(res, {
      workouts,
      pagination: {
        total,
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
      },
    });
  } catch (error: any) {
    console.error('Get workouts error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// POST /api/workouts
router.post('/', async (req: AuthRequest, res) => {
  try {

    let workout = await Workout.create({
      ...req.body,
      user_id: req.user._id,
    });

    // Populate exercise references
    workout = await Workout.findById(workout._id)
      .populate('exercises.exercise_id', 'name category muscle_groups equipment') as any;

    return successResponse(res, workout, 201);
  } catch (error: any) {
    console.error('Create workout error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// GET /api/workouts/:id
router.get('/:id', async (req: AuthRequest, res) => {
  try {

    const workout = await Workout.findOne({
      _id: req.params.id,
      user_id: req.user._id,
    }).populate('exercises.exercise_id', 'name category muscle_groups equipment');

    if (!workout) {
      return errorResponse(res, 'Workout not found', 404);
    }

    return successResponse(res, workout);
  } catch (error: any) {
    console.error('Get workout error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// PUT /api/workouts/:id
router.put('/:id', async (req: AuthRequest, res) => {
  try {

    const workout = await Workout.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      req.body,
      { new: true, runValidators: true }
    ).populate('exercises.exercise_id', 'name category muscle_groups equipment');

    if (!workout) {
      return errorResponse(res, 'Workout not found', 404);
    }

    return successResponse(res, workout);
  } catch (error: any) {
    console.error('Update workout error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// DELETE /api/workouts/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {

    const workout = await Workout.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user._id,
    });

    if (!workout) {
      return errorResponse(res, 'Workout not found', 404);
    }

    return successResponse(res, { message: 'Workout deleted successfully' });
  } catch (error: any) {
    console.error('Delete workout error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

export default router;
