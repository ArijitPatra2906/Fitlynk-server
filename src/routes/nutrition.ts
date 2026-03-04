import { Router } from 'express';
import Food from '../models/Food';
import MealLog from '../models/MealLog';
import { errorResponse, successResponse } from '../utils/auth';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import foodApiService from '../services/foodApiService';
import NotificationHelpers from '../services/notificationHelpers';

const router = Router();

router.use(authenticateUser);

// GET /api/nutrition/foods/search
router.get('/foods/search', async (req: AuthRequest, res) => {
  try {
    const { query, limit = '20' } = req.query;

    if (!query) {
      return errorResponse(res, 'Search query is required', 400);
    }

    const searchQuery = query as string;
    const searchLimit = parseInt(limit as string);

    // First, search local database (fast and free!)
    const localFoods = await Food.find({
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { brand: { $regex: searchQuery, $options: 'i' } },
      ],
    })
      .limit(searchLimit)
      .sort({ name: 1 })
      .lean<any>();

    // If we have enough local results, return them immediately
    if (localFoods.length >= Math.min(5, searchLimit)) {
      return successResponse(
        res,
        localFoods.map((food: any) => ({
          ...food,
          _id: food._id.toString(),
          isLocal: true,
        }))
      );
    }

    // Only query external APIs if local results are insufficient
    const apiFoods = await foodApiService.searchAll(
      searchQuery,
      searchLimit - localFoods.length
    );

    // Combine results, prioritizing local foods
    const combinedResults = [
      ...localFoods.map((food: any) => ({
        ...food,
        _id: food._id.toString(),
        isLocal: true,
      })),
      ...apiFoods.map((food: any, index: number) => ({
        ...food,
        // Generate temporary ID for API results
        _id: `api-${food.source}-${index}`,
        isLocal: false,
      })),
    ];

    return successResponse(res, combinedResults);
  } catch (error: any) {
    console.error('Search foods error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// GET /api/nutrition/foods/barcode/:barcode
router.get('/foods/barcode/:barcode', async (req: AuthRequest, res) => {
  try {
    const { barcode } = req.params;

    // First check local database
    let food = await Food.findOne({ barcode }).lean<any>();

    if (!food) {
      // If not found locally, search Open Food Facts
      const apiFood = await foodApiService.getFoodByBarcode(barcode);

      if (apiFood) {
        // Save to local database for future use
        food = await Food.create({
          ...apiFood,
          user_id: undefined, // Not user-specific
        });
      }
    }

    if (!food) {
      return errorResponse(res, 'Food not found', 404);
    }

    return successResponse(res, food);
  } catch (error: any) {
    console.error('Barcode lookup error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// GET /api/nutrition/meals
router.get('/meals', async (req: AuthRequest, res) => {
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

    const mealLogs = await MealLog.find(filter)
      .populate('food_id', 'name brand')
      .sort({ date: -1, created_at: -1 });

    return successResponse(res, mealLogs);
  } catch (error: any) {
    console.error('Get meal logs error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// POST /api/nutrition/meals
router.post('/meals', async (req: AuthRequest, res) => {
  try {
    let { food_id } = req.body;

    // If food_id is a temporary API ID (starts with 'api-'), save the food first
    if (typeof food_id === 'string' && food_id.startsWith('api-')) {
      const { food_data } = req.body;

      if (!food_data) {
        return errorResponse(res, 'Food data is required for API foods', 400);
      }

      // Save the food to our database
      const savedFood = await Food.create({
        name: food_data.name,
        brand: food_data.brand,
        barcode: food_data.barcode,
        calories_per_100g: food_data.calories_per_100g,
        protein_per_100g: food_data.protein_per_100g,
        carbs_per_100g: food_data.carbs_per_100g,
        fat_per_100g: food_data.fat_per_100g,
        source: food_data.source,
      });

      food_id = savedFood._id;
    }

    const mealLog = await MealLog.create({
      ...req.body,
      food_id,
      user_id: req.user._id,
    });

    await mealLog.populate('food_id', 'name brand');

    // Check if calorie/macro goals were reached after logging this meal
    NotificationHelpers.checkAndNotifyDailyGoals(req.user._id)
      .catch(err => console.error('Error checking daily goals:', err));

    return successResponse(res, mealLog, 201);
  } catch (error: any) {
    console.error('Create meal log error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

// DELETE /api/nutrition/meals/:id
router.delete('/meals/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const mealLog = await MealLog.findOneAndDelete({
      _id: id,
      user_id: req.user._id,
    });

    if (!mealLog) {
      return errorResponse(res, 'Meal log not found', 404);
    }

    return successResponse(res, { message: 'Meal log deleted successfully' });
  } catch (error: any) {
    console.error('Delete meal log error:', error);
    return errorResponse(res, error.message || 'Internal server error', 500);
  }
});

export default router;
