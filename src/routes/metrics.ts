import { Router } from 'express';
import Goal from '../models/Goal';
import BodyMetrics from '../models/BodyMetrics';
import StepLog from '../models/StepLog';
import WaterLog from '../models/WaterLog';
import User from '../models/User';
import { errorResponse, successResponse } from '../utils/auth';
import { authenticateUser, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateUser);

// GET /api/metrics/goals
router.get('/goals', async (req: AuthRequest, res) => {
  try {
    const goals = await Goal.find({ user_id: req.user._id }).sort({ created_at: -1 });
    return successResponse(res, goals);
  } catch (error: any) {
    console.error('Get goals error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// POST /api/metrics/goals
router.post('/goals', async (req: AuthRequest, res) => {
  try {

    const goal = await Goal.findOneAndUpdate(
      { user_id: req.user._id },
      {
        ...req.body,
        user_id: req.user._id,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    // Mark onboarding as complete when user sets their goals
    // Goals are the final step of onboarding
    await User.findByIdAndUpdate(req.user._id, {
      onboarding_completed: true,
    });

    return successResponse(res, goal);
  } catch (error: any) {
    console.error('Create/update goal error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// GET /api/metrics/goals/current
router.get('/goals/current', async (req: AuthRequest, res) => {
  try {
    const goal = await Goal.findOne({ user_id: req.user._id }).sort({ created_at: -1 });
    return successResponse(res, goal);
  } catch (error: any) {
    console.error('Get current goal error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// GET /api/metrics/body
router.get('/body', async (req: AuthRequest, res) => {
  try {

    const { startDate, endDate, limit = '50' } = req.query;

    const filter: any = { user_id: req.user._id };

    if (startDate && endDate) {
      filter.recorded_at = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const metrics = await BodyMetrics.find(filter)
      .sort({ recorded_at: -1 })
      .limit(parseInt(limit as string));

    return successResponse(res, metrics);
  } catch (error: any) {
    console.error('Get body metrics error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// POST /api/metrics/body
router.post('/body', async (req: AuthRequest, res) => {
  try {

    const metric = await BodyMetrics.create({
      ...req.body,
      user_id: req.user._id,
    });

    return successResponse(res, metric, 201);
  } catch (error: any) {
    console.error('Create body metric error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// GET /api/metrics/steps
router.get('/steps', async (req: AuthRequest, res) => {
  try {

    const { date, startDate, endDate } = req.query;

    const filter: any = { user_id: req.user._id };

    if (date) {
      const targetDate = new Date(date as string);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      filter.date = {
        $gte: targetDate,
        $lt: nextDate,
      };
    } else if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const stepLogs = await StepLog.find(filter).sort({ date: -1 });

    return successResponse(res, stepLogs);
  } catch (error: any) {
    console.error('Get step logs error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// POST /api/metrics/steps
router.post('/steps', async (req: AuthRequest, res) => {
  try {

    const { date, steps, distance_km, calories_burned, source } = req.body;

    const logDate = new Date(date);
    logDate.setHours(0, 0, 0, 0);

    const stepLog = await StepLog.findOneAndUpdate(
      {
        user_id: req.user._id,
        date: logDate,
      },
      {
        steps,
        distance_km,
        calories_burned,
        source,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return successResponse(res, stepLog);
  } catch (error: any) {
    console.error('Upsert step log error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// GET /api/metrics/water
router.get('/water', async (req: AuthRequest, res) => {
  try {

    const { date, startDate, endDate } = req.query;

    const filter: any = { user_id: req.user._id };

    if (date) {
      const targetDate = new Date(date as string);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      filter.date = {
        $gte: targetDate,
        $lt: nextDate,
      };
    } else if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const waterLogs = await WaterLog.find(filter).sort({ date: -1, created_at: -1 });

    const total = waterLogs.reduce((sum, log) => sum + log.amount_ml, 0);

    return successResponse(res, {
      logs: waterLogs,
      total_ml: total,
    });
  } catch (error: any) {
    console.error('Get water logs error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// POST /api/metrics/water
router.post('/water', async (req: AuthRequest, res) => {
  try {

    const waterLog = await WaterLog.create({
      ...req.body,
      user_id: req.user._id,
    });

    return successResponse(res, waterLog, 201);
  } catch (error: any) {
    console.error('Create water log error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

export default router;
