/**
 * Notification Helper Functions
 * Pre-defined notification payloads for different events
 */

import notificationService from './notificationService';
import mongoose from 'mongoose';
import Workout from '../models/Workout';
import Goal from '../models/Goal';
import MealLog from '../models/MealLog';
import StepLog from '../models/StepLog';
import WaterLog from '../models/WaterLog';

export class NotificationHelpers {
  /**
   * ACHIEVEMENT NOTIFICATIONS
   */

  // Workout completed
  static async notifyWorkoutCompleted(
    userId: mongoose.Types.ObjectId | string,
    workoutData: {
      name: string;
      duration_minutes: number;
      total_sets: number;
      volume_kg: number;
      calories?: number;
    }
  ) {
    const duration = Math.round(workoutData.duration_minutes);
    const volume = Math.round(workoutData.volume_kg);

    await notificationService.sendNotification({
      userId,
      type: 'workout_completed',
      title: '💪 Workout Finished!',
      body: `${workoutData.name} - ${duration} min, ${workoutData.total_sets} sets, ${volume.toLocaleString()} kg volume. Beast mode!`,
      data: workoutData,
    });
  }

  // New Personal Record
  static async notifyPR(
    userId: mongoose.Types.ObjectId | string,
    exerciseName: string,
    newMax: number,
    previousMax: number
  ) {
    const improvement = Math.round(newMax - previousMax);

    await notificationService.sendNotification({
      userId,
      type: 'pr_achieved',
      title: '🏆 New Personal Record!',
      body: `You just ${exerciseName.toLowerCase()} ${newMax}kg - a new PR! (+${improvement}kg)`,
      data: { exerciseName, newMax, previousMax, improvement },
    });
  }

  // Calorie goal reached
  static async notifyCalorieGoalReached(userId: mongoose.Types.ObjectId | string, calories: number) {
    await notificationService.sendNotification({
      userId,
      type: 'calorie_goal_reached',
      title: '🎯 Calorie Goal Reached!',
      body: `You've hit your ${Math.round(calories)} cal target. Great job!`,
      data: { calories },
    });
  }

  // Macro goal reached (protein, carbs, or fat)
  static async notifyMacroGoalReached(
    userId: mongoose.Types.ObjectId | string,
    macroType: 'protein' | 'carbs' | 'fat',
    amount: number
  ) {
    const emoji = macroType === 'protein' ? '🥩' : macroType === 'carbs' ? '🍞' : '🥑';
    const macroName = macroType.charAt(0).toUpperCase() + macroType.slice(1);

    await notificationService.sendNotification({
      userId,
      type: 'macro_goal_reached',
      title: `${emoji} ${macroName} Goal Reached!`,
      body: `You've hit your ${Math.round(amount)}g ${macroType} target for today!`,
      data: { macroType, amount },
    });
  }

  // Step goal achieved
  static async notifyStepGoalReached(userId: mongoose.Types.ObjectId | string, steps: number) {
    await notificationService.sendNotification({
      userId,
      type: 'step_goal_reached',
      title: '👟 Step Goal Achieved!',
      body: `${steps.toLocaleString()} steps today! You're on fire!`,
      data: { steps },
    });
  }

  // Water goal complete
  static async notifyWaterGoalReached(
    userId: mongoose.Types.ObjectId | string,
    waterMl: number
  ) {
    const liters = (waterMl / 1000).toFixed(1);

    await notificationService.sendNotification({
      userId,
      type: 'water_goal_reached',
      title: '💧 Hydration Goal Complete!',
      body: `You've logged ${liters}L of water today. Stay hydrated!`,
      data: { waterMl, liters },
    });
  }

  // Perfect Day (all goals met)
  static async notifyPerfectDay(userId: mongoose.Types.ObjectId | string) {
    await notificationService.sendNotification({
      userId,
      type: 'perfect_day',
      title: '🌟 Perfect Day!',
      body: 'You hit ALL your goals today: calories, macros, steps, water, and workout. Legendary!',
      data: { date: new Date().toISOString().split('T')[0] },
    });
  }

  // Streak milestone
  static async notifyStreakMilestone(
    userId: mongoose.Types.ObjectId | string,
    days: number
  ) {
    const emoji = days >= 30 ? '🔥' : days >= 14 ? '🎉' : '⭐';

    await notificationService.sendNotification({
      userId,
      type: 'streak_milestone',
      title: `${emoji} ${days}-Day Streak!`,
      body: `You've worked out for ${days} days straight! Unstoppable!`,
      data: { days },
    });
  }

  // Volume milestone (total weight lifted)
  static async notifyVolumeMilestone(
    userId: mongoose.Types.ObjectId | string,
    totalVolumeKg: number
  ) {
    const volumeFormatted = (totalVolumeKg / 1000).toFixed(0);

    await notificationService.sendNotification({
      userId,
      type: 'volume_milestone',
      title: '💪 Volume Milestone!',
      body: `You've lifted ${volumeFormatted},000 kg total! Incredible strength!`,
      data: { totalVolumeKg },
    });
  }

  // Weight milestone
  static async notifyWeightMilestone(
    userId: mongoose.Types.ObjectId | string,
    currentWeight: number,
    goalType: 'lose' | 'gain' | 'maintain',
    progressKg: number
  ) {
    const action = goalType === 'lose' ? 'lost' : 'gained';

    await notificationService.sendNotification({
      userId,
      type: 'weight_milestone',
      title: '📊 Weight Milestone!',
      body: `You've ${action} ${Math.abs(progressKg)}kg! Keep up the great work!`,
      data: { currentWeight, goalType, progressKg },
    });
  }

  // Total workouts milestone
  static async notifyTotalWorkoutsMilestone(
    userId: mongoose.Types.ObjectId | string,
    totalWorkouts: number
  ) {
    const emoji = totalWorkouts >= 100 ? '🏆' : totalWorkouts >= 50 ? '🎖️' : '🎉';

    await notificationService.sendNotification({
      userId,
      type: 'total_workouts_milestone',
      title: `${emoji} ${totalWorkouts} Workouts!`,
      body: `You've completed ${totalWorkouts} workouts! That's dedication!`,
      data: { totalWorkouts },
    });
  }

  /**
   * REMINDER NOTIFICATIONS
   */

  // Morning check-in
  static async notifyMorningCheckin(userId: mongoose.Types.ObjectId | string) {
    const greetings = [
      "Good morning! Ready to crush your goals today? 💪",
      "Rise and shine! Today is a great day to make progress! 🌅",
      "Morning! Let's make today count! 🎯",
      "New day, new opportunities! Let's go! ☀️",
    ];

    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    await notificationService.sendNotification({
      userId,
      type: 'morning_checkin',
      title: '🌄 Good Morning!',
      body: greeting,
      data: {},
    });
  }

  // Workout reminder
  static async notifyWorkoutReminder(userId: mongoose.Types.ObjectId | string) {
    await notificationService.sendNotification({
      userId,
      type: 'workout_reminder',
      title: '🏋️ Gym Time!',
      body: "Your workout is scheduled for now. Let's get it done!",
      data: {},
    });
  }

  // Water reminder
  static async notifyWaterReminder(
    userId: mongoose.Types.ObjectId | string,
    currentMl: number,
    goalMl: number
  ) {
    const percentage = Math.round((currentMl / goalMl) * 100);

    await notificationService.sendNotification({
      userId,
      type: 'water_reminder',
      title: '💧 Stay Hydrated',
      body: `You've logged ${percentage}% of your water goal. Time for a refill!`,
      data: { currentMl, goalMl, percentage },
    });
  }

  // Meal reminder
  static async notifyMealReminder(
    userId: mongoose.Types.ObjectId | string,
    mealType: 'breakfast' | 'lunch' | 'dinner'
  ) {
    const messages = {
      breakfast: 'Time to log your breakfast! 🍳',
      lunch: 'Lunch time! Don\'t forget to track your meal 🥗',
      dinner: 'Dinner time! Remember to log your food 🍽️',
    };

    await notificationService.sendNotification({
      userId,
      type: 'meal_reminder',
      title: `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Reminder`,
      body: messages[mealType],
      data: { mealType },
    });
  }

  // Evening summary
  static async notifyEveningSummary(
    userId: mongoose.Types.ObjectId | string,
    summary: {
      caloriesLogged: number;
      stepsToday: number;
      workoutsToday: number;
      goalsRemaining: string[];
    }
  ) {
    const { caloriesLogged, stepsToday, workoutsToday, goalsRemaining } = summary;

    let body = `Today: ${Math.round(caloriesLogged)} cal, ${stepsToday.toLocaleString()} steps, ${workoutsToday} workout${workoutsToday !== 1 ? 's' : ''}.`;

    if (goalsRemaining.length > 0) {
      body += ` Remaining: ${goalsRemaining.join(', ')}`;
    } else {
      body = 'Perfect day! All goals completed! 🌟';
    }

    await notificationService.sendNotification({
      userId,
      type: 'evening_summary',
      title: '📊 Your Day in Review',
      body,
      data: summary,
    });
  }

  // Streak protection
  static async notifyStreakProtection(
    userId: mongoose.Types.ObjectId | string,
    currentStreak: number
  ) {
    await notificationService.sendNotification({
      userId,
      type: 'streak_protection',
      title: '⚠️ Don\'t Break Your Streak!',
      body: `Your ${currentStreak}-day workout streak ends today. Quick workout to keep it alive?`,
      data: { currentStreak },
    });
  }

  // Incomplete goals reminder
  static async notifyIncompleteGoals(
    userId: mongoose.Types.ObjectId | string,
    incompleteGoals: string[]
  ) {
    await notificationService.sendNotification({
      userId,
      type: 'incomplete_goals',
      title: '🎯 Goals Remaining',
      body: `You still have time! Remaining: ${incompleteGoals.join(', ')}`,
      data: { incompleteGoals },
    });
  }

  // Template workout reminder
  static async notifyTemplateReminder(
    userId: mongoose.Types.ObjectId | string,
    templateName: string,
    daysSinceLastDone: number
  ) {
    await notificationService.sendNotification({
      userId,
      type: 'template_reminder',
      title: '📋 Workout Suggestion',
      body: `You haven't done "${templateName}" in ${daysSinceLastDone} days. Time to hit it?`,
      data: { templateName, daysSinceLastDone },
    });
  }

  // Rest day suggestion
  static async notifyRestDaySuggestion(
    userId: mongoose.Types.ObjectId | string,
    consecutiveDays: number
  ) {
    await notificationService.sendNotification({
      userId,
      type: 'rest_day_suggestion',
      title: '😌 Rest Day Recommended',
      body: `You've worked out ${consecutiveDays} days in a row. Consider taking a rest day for recovery!`,
      data: { consecutiveDays },
    });
  }

  /**
   * PROGRESS & INSIGHTS
   */

  // Weekly summary
  static async notifyWeeklySummary(
    userId: mongoose.Types.ObjectId | string,
    summary: {
      totalWorkouts: number;
      totalSteps: number;
      avgCalories: number;
      topExercise: string;
      newPRs: number;
    }
  ) {
    const { totalWorkouts, totalSteps, avgCalories, topExercise, newPRs } = summary;

    let body = `${totalWorkouts} workouts, ${(totalSteps / 1000).toFixed(0)}k steps, ${Math.round(avgCalories)} avg calories`;

    if (newPRs > 0) {
      body += `, ${newPRs} new PR${newPRs !== 1 ? 's' : ''}! 🎉`;
    }

    await notificationService.sendNotification({
      userId,
      type: 'weekly_summary',
      title: '📊 Your Week in Review',
      body,
      data: summary,
    });
  }

  /**
   * SYSTEM NOTIFICATIONS
   */

  // Step sync complete
  static async notifyStepSyncComplete(
    userId: mongoose.Types.ObjectId | string,
    stepsSynced: number
  ) {
    await notificationService.sendNotification({
      userId,
      type: 'step_sync_complete',
      title: '🔄 Steps Synced',
      body: `Synced ${stepsSynced.toLocaleString()} steps from your device`,
      data: { stepsSynced },
    });
  }

  // Goal update reminder
  static async notifyGoalUpdateReminder(userId: mongoose.Types.ObjectId | string) {
    await notificationService.sendNotification({
      userId,
      type: 'goal_update_reminder',
      title: '🎯 Update Your Goals',
      body: 'It\'s been a while since you updated your goals. Time to reassess your progress!',
      data: {},
    });
  }

  /**
   * UTILITY FUNCTIONS FOR CHECKING IF GOALS ARE MET
   */

  // Check if daily goals are met and send notifications
  static async checkAndNotifyDailyGoals(userId: mongoose.Types.ObjectId | string) {
    try {
      const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      const today = new Date().toISOString().split('T')[0];

      // Get user goal
      const goal = await Goal.findOne({ user_id: userIdObj });
      if (!goal) return;

      // Check calorie goal
      const meals = await MealLog.find({
        user_id: userIdObj,
        date: today,
      });

      const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
      if (totalCalories >= goal.calorie_target && goal.calorie_target > 0) {
        await this.notifyCalorieGoalReached(userId, goal.calorie_target);
      }

      // Check macros
      const totalProtein = meals.reduce((sum, meal) => sum + meal.protein_g, 0);
      const totalCarbs = meals.reduce((sum, meal) => sum + meal.carbs_g, 0);
      const totalFat = meals.reduce((sum, meal) => sum + meal.fat_g, 0);

      if (totalProtein >= goal.protein_g) {
        await this.notifyMacroGoalReached(userId, 'protein', goal.protein_g);
      }
      if (totalCarbs >= goal.carbs_g) {
        await this.notifyMacroGoalReached(userId, 'carbs', goal.carbs_g);
      }
      if (totalFat >= goal.fat_g) {
        await this.notifyMacroGoalReached(userId, 'fat', goal.fat_g);
      }

      // Check step goal
      const stepLog = await StepLog.findOne({
        user_id: userIdObj,
        date: today,
      });

      if (stepLog && stepLog.steps >= goal.step_target) {
        await this.notifyStepGoalReached(userId, stepLog.steps);
      }

      // Check water goal
      const waterLogs = await WaterLog.find({
        user_id: userIdObj,
        date: today,
      });

      const totalWater = waterLogs.reduce((sum, log) => sum + log.amount_ml, 0);
      if (totalWater >= goal.water_target_ml) {
        await this.notifyWaterGoalReached(userId, totalWater);
      }

      // Check if all goals met (perfect day)
      const allGoalsMet =
        totalCalories >= goal.calorie_target &&
        totalProtein >= goal.protein_g &&
        totalCarbs >= goal.carbs_g &&
        totalFat >= goal.fat_g &&
        (stepLog ? stepLog.steps >= goal.step_target : false) &&
        totalWater >= goal.water_target_ml;

      if (allGoalsMet) {
        await this.notifyPerfectDay(userId);
      }
    } catch (error) {
      console.error('Error checking daily goals:', error);
    }
  }
}

export default NotificationHelpers;
