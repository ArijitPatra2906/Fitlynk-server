import { Router } from 'express';
import Exercise from '../models/Exercise';
import { errorResponse, successResponse } from '../utils/auth';
import { authenticateUser, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateUser);

// GET /api/exercises
router.get('/', async (req: AuthRequest, res) => {
  try {

    const { category, muscle_group, search } = req.query;

    const filter: any = {
      $or: [
        { is_custom: false },
        { is_custom: true, created_by: req.user._id },
      ],
    };

    if (category) {
      filter.category = category;
    }

    if (muscle_group) {
      filter.muscle_groups = muscle_group;
    }

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const exercises = await Exercise.find(filter).sort({ name: 1 });

    return successResponse(res, exercises);
  } catch (error: any) {
    console.error('Get exercises error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// POST /api/exercises
router.post('/', async (req: AuthRequest, res) => {
  try {

    const exercise = await Exercise.create({
      ...req.body,
      created_by: req.user._id,
      is_custom: true,
    });

    return successResponse(res, exercise, 201);
  } catch (error: any) {
    console.error('Create exercise error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

export default router;
