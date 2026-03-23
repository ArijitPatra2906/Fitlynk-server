import { Router } from 'express';
import { createHash } from 'crypto';
import Goal from '../models/Goal';
import BodyMetrics from '../models/BodyMetrics';
import StepLog from '../models/StepLog';
import WaterLog from '../models/WaterLog';
import User from '../models/User';
import MealLog from '../models/MealLog';
import Workout from '../models/Workout';
import ProgressPhoto from '../models/ProgressPhoto';
import { errorResponse, successResponse } from '../utils/auth';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import NotificationHelpers from '../services/notificationHelpers';

const router = Router();

router.use(authenticateUser);

const toStartOfDay = (value: string) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toEndOfDay = (value: string) => {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
};

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

    const { startDate, endDate, page, limit } = req.query;

    const filter: any = { user_id: req.user._id };

    if (startDate && endDate) {
      filter.recorded_at = {
        $gte: toStartOfDay(startDate as string),
        $lte: toEndOfDay(endDate as string),
      };
    }

    const hasPagination = page !== undefined;
    const rawLimit = parseInt((limit as string) || '50', 10);
    const limitNum = Number.isFinite(rawLimit) ? Math.max(1, rawLimit) : 50;

    if (!hasPagination) {
      const metrics = await BodyMetrics.find(filter)
        .sort({ recorded_at: -1 })
        .limit(limitNum);
      return successResponse(res, metrics);
    }

    const rawPage = parseInt((page as string) || '1', 10);
    const pageNum = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
    const skip = (pageNum - 1) * limitNum;

    const [total, logs] = await Promise.all([
      BodyMetrics.countDocuments(filter),
      BodyMetrics.find(filter).sort({ recorded_at: -1 }).skip(skip).limit(limitNum),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    return successResponse(res, {
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
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

    // Note: We do NOT update user.weight_kg here
    // user.weight_kg represents the starting weight from onboarding
    // Current weight is tracked in BodyMetrics collection only

    return successResponse(res, metric, 201);
  } catch (error: any) {
    console.error('Create body metric error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// GET /api/metrics/recent-activity
router.get('/recent-activity', async (req: AuthRequest, res) => {
  try {
    const rawLimit = parseInt((req.query.limit as string) || '5', 10);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, rawLimit)) : 5;
    const perTypeFetch = Math.max(10, limit * 3);

    // Temporarily disabled - step log not working properly
    // const [meals, workouts, waters, weights, steps] = await Promise.all([
    const [meals, workouts, waters, weights] = await Promise.all([
      MealLog.find({ user_id: req.user._id })
        .populate('food_id', 'name')
        .sort({ created_at: -1 })
        .limit(perTypeFetch)
        .lean<any[]>(),
      Workout.find({
        user_id: req.user._id,
        is_template: false,
        ended_at: { $ne: null },
      })
        .populate('exercises.exercise_id', 'name')
        .sort({ ended_at: -1, updated_at: -1 })
        .limit(perTypeFetch)
        .lean<any[]>(),
      WaterLog.find({ user_id: req.user._id })
        .sort({ created_at: -1 })
        .limit(perTypeFetch)
        .lean<any[]>(),
      BodyMetrics.find({ user_id: req.user._id })
        .sort({ recorded_at: -1, created_at: -1 })
        .limit(perTypeFetch)
        .lean<any[]>(),
      // Temporarily disabled - step log not working properly
      // StepLog.find({ user_id: req.user._id })
      //   .sort({ updated_at: -1, date: -1 })
      //   .limit(perTypeFetch)
      //   .lean<any[]>(),
    ]);

    const activities = [
      ...meals.map((meal: any) => ({
        type: 'meal',
        name: meal.meal_type
          ? meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)
          : 'Meal',
        description: meal.food_id?.name || 'Food log',
        metadata: `${Math.round(meal.calories || 0)} kcal`,
        timestamp: meal.created_at || meal.date,
      })),
      ...workouts.map((workout: any) => {
        const exerciseNames = (workout.exercises || [])
          .slice(0, 3)
          .map((e: any) => e.exercise_id?.name || 'Exercise')
          .join(' | ');

        return {
          type: 'workout',
          name: workout.name || 'Workout',
          description: exerciseNames || 'Completed workout',
          metadata: `${Math.round(workout.calories || 0)} kcal`,
          timestamp: workout.ended_at || workout.updated_at || workout.started_at,
        };
      }),
      ...waters.map((water: any) => ({
        type: 'water',
        name: 'Water Log',
        description: 'Hydration entry',
        metadata: `${Math.round(water.amount_ml || 0)} ml`,
        timestamp: water.created_at || water.date,
      })),
      ...weights.map((metric: any) => ({
        type: 'weight',
        name: 'Weight Log',
        description: 'Body weight entry',
        metadata: `${Number(metric.weight_kg || 0).toFixed(1)} kg`,
        timestamp: metric.recorded_at || metric.created_at,
      })),
      // Temporarily disabled - step log not working properly
      // ...steps.map((step: any) => ({
      //   type: 'steps',
      //   name: 'Step Log',
      //   description: step.source ? `${step.source} sync` : 'Daily steps',
      //   metadata: `${Math.round(step.steps || 0).toLocaleString()} steps`,
      //   timestamp: step.updated_at || step.date,
      // })),
    ];

    activities.sort((a: any, b: any) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      const safeA = Number.isFinite(aTime) ? aTime : 0;
      const safeB = Number.isFinite(bTime) ? bTime : 0;
      return safeB - safeA;
    });

    return successResponse(res, activities.slice(0, limit));
  } catch (error: any) {
    console.error('Get recent activity error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// GET /api/metrics/steps
router.get('/steps', async (req: AuthRequest, res) => {
  try {

    const { date, startDate, endDate, page, limit } = req.query;

    const filter: any = { user_id: req.user._id };

    if (date) {
      const targetDate = toStartOfDay(date as string);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      filter.date = {
        $gte: targetDate,
        $lt: nextDate,
      };
    } else if (startDate && endDate) {
      filter.date = {
        $gte: toStartOfDay(startDate as string),
        $lte: toEndOfDay(endDate as string),
      };
    }

    const hasPagination = page !== undefined || limit !== undefined;
    const rawPage = parseInt((page as string) || '1', 10);
    const rawLimit = parseInt((limit as string) || '10', 10);
    const pageNum = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
    const limitNum = Number.isFinite(rawLimit) ? Math.max(1, rawLimit) : 10;

    if (!hasPagination) {
      const stepLogs = await StepLog.find(filter).sort({ date: -1 });
      return successResponse(res, stepLogs);
    }

    const skip = (pageNum - 1) * limitNum;

    const [total, logs] = await Promise.all([
      StepLog.countDocuments(filter),
      StepLog.find(filter).sort({ date: -1 }).skip(skip).limit(limitNum),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    return successResponse(res, {
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error: any) {
    console.error('Get step logs error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// POST /api/metrics/steps
router.post('/steps', async (req: AuthRequest, res) => {
  try {

    const {
      date,
      steps,
      distance_km,
      calories_burned,
      active_minutes,
      slow_minutes,
      brisk_minutes,
      slow_steps,
      brisk_steps,
      source,
    } = req.body;

    // Don't save step logs with 0 or negative steps
    if (!steps || steps <= 0) {
      return errorResponse(res, 'Steps must be greater than 0', 400);
    }

    const logDate = new Date(date);
    logDate.setHours(0, 0, 0, 0);

    // Find existing log for today
    const existingLog = await StepLog.findOne({
      user_id: req.user._id,
      date: logDate,
    });

    let stepLog;

    if (source === 'manual' && existingLog) {
      // Manual entry: ADD to existing steps
      stepLog = await StepLog.findOneAndUpdate(
        {
          user_id: req.user._id,
          date: logDate,
        },
        {
          $inc: {
            steps: steps,
            distance_km: distance_km || 0,
            calories_burned: calories_burned || 0,
            active_minutes: active_minutes || 0,
            slow_minutes: slow_minutes || 0,
            brisk_minutes: brisk_minutes || 0,
            slow_steps: slow_steps || 0,
            brisk_steps: brisk_steps || 0,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );
    } else {
      // Device sync or new entry: REPLACE values
      stepLog = await StepLog.findOneAndUpdate(
        {
          user_id: req.user._id,
          date: logDate,
        },
        {
          steps,
          distance_km,
          calories_burned,
          active_minutes,
          slow_minutes,
          brisk_minutes,
          slow_steps,
          brisk_steps,
          source,
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
        }
      );
    }

    // TEMPORARILY DISABLED - Step tracking not working properly
    // Check if step goal was reached (use final total)
    // if (stepLog) {
    //   const goal = await Goal.findOne({ user_id: req.user._id });
    //   if (goal && stepLog.steps >= goal.step_target && goal.step_target > 0) {
    //     NotificationHelpers.notifyStepGoalReached(req.user._id, stepLog.steps)
    //       .catch((err: any) => console.error('Error sending step goal notification:', err));

    //     // Check if all daily goals met
    //     NotificationHelpers.checkAndNotifyDailyGoals(req.user._id)
    //       .catch((err: any) => console.error('Error checking daily goals:', err));
    //   }
    // }

    return successResponse(res, stepLog);
  } catch (error: any) {
    console.error('Upsert step log error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// GET /api/metrics/water
router.get('/water', async (req: AuthRequest, res) => {
  try {

    const { date, startDate, endDate, page, limit } = req.query;

    const filter: any = { user_id: req.user._id };

    if (date) {
      const targetDate = toStartOfDay(date as string);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      filter.date = {
        $gte: targetDate,
        $lt: nextDate,
      };
    } else if (startDate && endDate) {
      filter.date = {
        $gte: toStartOfDay(startDate as string),
        $lte: toEndOfDay(endDate as string),
      };
    }

    const hasPagination = page !== undefined || limit !== undefined;
    const rawPage = parseInt((page as string) || '1', 10);
    const rawLimit = parseInt((limit as string) || '10', 10);
    const pageNum = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
    const limitNum = Number.isFinite(rawLimit) ? Math.max(1, rawLimit) : 10;

    if (!hasPagination) {
      const waterLogs = await WaterLog.find(filter).sort({ date: -1, created_at: -1 });
      const total = waterLogs.reduce((sum, log) => sum + log.amount_ml, 0);

      return successResponse(res, {
        logs: waterLogs,
        total_ml: total,
      });
    }

    const skip = (pageNum - 1) * limitNum;
    const [totalCount, logs, sumResult] = await Promise.all([
      WaterLog.countDocuments(filter),
      WaterLog.find(filter).sort({ date: -1, created_at: -1 }).skip(skip).limit(limitNum),
      WaterLog.aggregate([
        { $match: filter },
        { $group: { _id: null, total_ml: { $sum: '$amount_ml' } } },
      ]),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / limitNum));
    const totalMl = Number(sumResult?.[0]?.total_ml || 0);

    return successResponse(res, {
      logs,
      total_ml: totalMl,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
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

    // Check if water goal was reached
    const today = new Date().toISOString().split('T')[0];
    const [goal, waterLogs] = await Promise.all([
      Goal.findOne({ user_id: req.user._id }),
      WaterLog.find({ user_id: req.user._id, date: today }),
    ]);

    if (goal && goal.water_target_ml > 0) {
      const totalWater = waterLogs.reduce((sum, log) => sum + log.amount_ml, 0);

      if (totalWater >= goal.water_target_ml) {
        NotificationHelpers.notifyWaterGoalReached(req.user._id, totalWater)
          .catch(err => console.error('Error sending water goal notification:', err));

        // Check if all daily goals met
        NotificationHelpers.checkAndNotifyDailyGoals(req.user._id)
          .catch(err => console.error('Error checking daily goals:', err));
      }
    }

    return successResponse(res, waterLog, 201);
  } catch (error: any) {
    console.error('Create water log error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// GET /api/metrics/progress-photos
router.get('/progress-photos', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, page, limit } = req.query;

    const filter: any = { user_id: req.user._id };

    if (startDate && endDate) {
      filter.taken_at = {
        $gte: toStartOfDay(startDate as string),
        $lte: toEndOfDay(endDate as string),
      };
    }

    const hasPagination = page !== undefined;
    const rawLimit = parseInt((limit as string) || '50', 10);
    const limitNum = Number.isFinite(rawLimit) ? Math.max(1, rawLimit) : 50;

    if (!hasPagination) {
      const photos = await ProgressPhoto.find(filter)
        .sort({ taken_at: -1 })
        .limit(limitNum);
      return successResponse(res, photos);
    }

    const rawPage = parseInt((page as string) || '1', 10);
    const pageNum = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
    const skip = (pageNum - 1) * limitNum;

    const [total, photos] = await Promise.all([
      ProgressPhoto.countDocuments(filter),
      ProgressPhoto.find(filter).sort({ taken_at: -1 }).skip(skip).limit(limitNum),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    return successResponse(res, {
      photos,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error: any) {
    console.error('Get progress photos error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// POST /api/metrics/progress-photos
router.post('/progress-photos', async (req: AuthRequest, res) => {
  try {
    const { imageData, caption, taken_at, weight_kg, body_fat_pct, tags } = req.body;

    if (!imageData || !imageData.startsWith('data:image/')) {
      return errorResponse(res, 'Valid imageData is required', 400);
    }

    // Basic guard to prevent very large base64 payloads (max ~10MB)
    if (imageData.length > 10_000_000) {
      return errorResponse(res, 'Image payload is too large. Max 10MB', 413);
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return errorResponse(res, 'Cloudinary env is not configured on server', 500);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'fitlynk/progress-photos';
    const publicId = `progress_${req.user._id}_${Date.now()}`;

    // Original image
    const signatureBase = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = createHash('sha1').update(signatureBase).digest('hex');

    const body = new URLSearchParams();
    body.append('file', imageData);
    body.append('api_key', apiKey);
    body.append('timestamp', String(timestamp));
    body.append('folder', folder);
    body.append('public_id', publicId);
    body.append('signature', signature);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }
    );

    const uploadPayload: any = await uploadRes.json();
    if (!uploadRes.ok || !uploadPayload?.secure_url) {
      return errorResponse(
        res,
        uploadPayload?.error?.message || 'Cloudinary upload failed',
        uploadRes.status || 500
      );
    }

    // Generate thumbnail URL (300x300)
    const thumbnailUrl = uploadPayload.secure_url.replace(
      '/upload/',
      '/upload/c_fill,w_300,h_300,q_auto,f_auto/'
    );

    // Create progress photo record
    const photo = await ProgressPhoto.create({
      user_id: req.user._id,
      photo_url: uploadPayload.secure_url,
      thumbnail_url: thumbnailUrl,
      caption: caption || '',
      taken_at: taken_at || new Date(),
      weight_kg: weight_kg || undefined,
      body_fat_pct: body_fat_pct || undefined,
      tags: tags || [],
    });

    return successResponse(res, photo, 201);
  } catch (error: any) {
    console.error('Create progress photo error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// DELETE /api/metrics/progress-photos/:id
router.delete('/progress-photos/:id', async (req: AuthRequest, res) => {
  try {
    const photo = await ProgressPhoto.findOne({
      _id: req.params.id,
      user_id: req.user._id,
    });

    if (!photo) {
      return errorResponse(res, 'Progress photo not found', 404);
    }

    await ProgressPhoto.deleteOne({ _id: req.params.id });

    return successResponse(res, { message: 'Progress photo deleted successfully' });
  } catch (error: any) {
    console.error('Delete progress photo error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// PUT /api/metrics/progress-photos/:id
router.put('/progress-photos/:id', async (req: AuthRequest, res) => {
  try {
    const { caption, weight_kg, body_fat_pct, tags } = req.body;

    const photo = await ProgressPhoto.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      {
        caption,
        weight_kg,
        body_fat_pct,
        tags,
      },
      { new: true, runValidators: true }
    );

    if (!photo) {
      return errorResponse(res, 'Progress photo not found', 404);
    }

    return successResponse(res, photo);
  } catch (error: any) {
    console.error('Update progress photo error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

export default router;
