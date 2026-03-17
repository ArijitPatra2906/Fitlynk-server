import { Router } from 'express';
import Todo from '../models/Todo';
import { errorResponse, successResponse } from '../utils/auth';
import { authenticateUser, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateUser);

// GET /api/todos - Get all todos with optional filters
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { completed, dateRange, startDate, endDate, search } = req.query;

    const filter: any = { user_id: req.user._id };

    // Filter by search query (title or description)
    if (search && typeof search === 'string' && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Filter by completion status
    if (completed !== undefined) {
      filter.completed = completed === 'true';
    }

    // Filter by date range
    if (dateRange) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (dateRange) {
        case 'today': {
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const todayStr = `${year}-${month}-${day}`;
          filter.due_date = todayStr;
          break;
        }
        case 'yesterday': {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const year = yesterday.getFullYear();
          const month = String(yesterday.getMonth() + 1).padStart(2, '0');
          const day = String(yesterday.getDate()).padStart(2, '0');
          const yesterdayStr = `${year}-${month}-${day}`;
          filter.due_date = yesterdayStr;
          break;
        }
        case 'tomorrow': {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const year = tomorrow.getFullYear();
          const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
          const day = String(tomorrow.getDate()).padStart(2, '0');
          const tomorrowStr = `${year}-${month}-${day}`;
          filter.due_date = tomorrowStr;
          break;
        }
        case '7days': {
          const rangeStartDate = new Date(today);
          rangeStartDate.setDate(rangeStartDate.getDate() - 7);
          filter.created_at = { $gte: rangeStartDate };
          break;
        }
        case '1month': {
          const rangeStartDate = new Date(today);
          rangeStartDate.setMonth(rangeStartDate.getMonth() - 1);
          filter.created_at = { $gte: rangeStartDate };
          break;
        }
        case '3months': {
          const rangeStartDate = new Date(today);
          rangeStartDate.setMonth(rangeStartDate.getMonth() - 3);
          filter.created_at = { $gte: rangeStartDate };
          break;
        }
        default:
          // All time - no filter
          break;
      }
    } else if (startDate && endDate) {
      // Custom date range
      filter.created_at = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const todos = await Todo.find(filter).sort({ completed: 1, created_at: -1 });

    return successResponse(res, todos);
  } catch (error: any) {
    console.error('Get todos error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// GET /api/todos/:id - Get single todo
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const todo = await Todo.findOne({
      _id: req.params.id,
      user_id: req.user._id,
    });

    if (!todo) {
      return errorResponse(res, 'Todo not found', 404);
    }

    return successResponse(res, todo);
  } catch (error: any) {
    console.error('Get todo error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// POST /api/todos - Create new todo
router.post('/', async (req: AuthRequest, res) => {
  try {
    const todo = await Todo.create({
      ...req.body,
      user_id: req.user._id,
    });

    // If this is a daily recurring todo, check if tomorrow's instance exists
    // If not, create it automatically
    if (req.body.recurs_daily && req.body.due_date) {
      const currentDate = new Date(req.body.due_date);
      const tomorrow = new Date(currentDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const tomorrowDateStr = `${year}-${month}-${day}`;

      // Check if tomorrow's instance already exists
      const existingTomorrow = await Todo.findOne({
        user_id: req.user._id,
        title: req.body.title,
        due_date: tomorrowDateStr,
        recurs_daily: true,
      });

      // Only create if it doesn't exist
      if (!existingTomorrow) {
        await Todo.create({
          user_id: req.user._id,
          title: req.body.title,
          description: req.body.description,
          priority: req.body.priority,
          due_date: tomorrowDateStr,
          recurs_daily: true,
          completed: false,
        });
      }
    }

    return successResponse(res, todo, 201);
  } catch (error: any) {
    console.error('Create todo error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// PUT /api/todos/:id - Update todo
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { completed, ...updateData } = req.body;

    // If marking as completed, set completed_at timestamp
    if (completed !== undefined) {
      updateData.completed = completed;
      updateData.completed_at = completed ? new Date() : null;
    }

    const todo = await Todo.findOneAndUpdate(
      {
        _id: req.params.id,
        user_id: req.user._id,
      },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!todo) {
      return errorResponse(res, 'Todo not found', 404);
    }

    return successResponse(res, todo);
  } catch (error: any) {
    console.error('Update todo error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// DELETE /api/todos/:id - Delete todo
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const todo = await Todo.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user._id,
    });

    if (!todo) {
      return errorResponse(res, 'Todo not found', 404);
    }

    return successResponse(res, { message: 'Todo deleted successfully' });
  } catch (error: any) {
    console.error('Delete todo error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// PATCH /api/todos/:id/toggle - Toggle completion status
router.patch('/:id/toggle', async (req: AuthRequest, res) => {
  try {
    const todo = await Todo.findOne({
      _id: req.params.id,
      user_id: req.user._id,
    });

    if (!todo) {
      return errorResponse(res, 'Todo not found', 404);
    }

    todo.completed = !todo.completed;
    todo.completed_at = todo.completed ? new Date() : undefined;
    await todo.save();

    return successResponse(res, todo);
  } catch (error: any) {
    console.error('Toggle todo error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

export default router;
