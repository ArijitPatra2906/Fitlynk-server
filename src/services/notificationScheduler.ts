/**
 * Notification Scheduler
 * Handles scheduled notifications using cron jobs
 */

import * as cron from 'node-cron';
import NotificationPreferences from '../models/NotificationPreferences';
import NotificationHelpers from './notificationHelpers';
import Workout from '../models/Workout';
import StepLog from '../models/StepLog';
import MealLog from '../models/MealLog';
import Goal from '../models/Goal';
import WaterLog from '../models/WaterLog';
import mongoose from 'mongoose';

class NotificationScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize all scheduled notifications
   */
  init() {
    console.log('🔔 Initializing notification scheduler...');

    // Run every hour to check for scheduled reminders
    this.scheduleHourlyChecks();

    // Weekly summary (Sunday at 8 PM)
    this.scheduleWeeklySummary();

    // Daily goal update reminder (1st of each month at 9 AM)
    this.scheduleMonthlyGoalReminder();

    console.log('✅ Notification scheduler initialized');
  }

  /**
   * Check every hour for time-based reminders
   * Runs at the top of each hour
   */
  private scheduleHourlyChecks() {
    const job = cron.schedule('0 * * * *', async () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = `${currentHour.toString().padStart(2, '0')}:00`;

      console.log(`⏰ Running hourly notification check at ${currentTime}`);

      try {
        // Get all users with notification preferences
        const allPrefs = await NotificationPreferences.find({
          push_notifications_enabled: true,
        });

        for (const prefs of allPrefs) {
          // Skip if in quiet hours
          if (this.isInQuietHours(prefs, currentHour, currentMinute)) {
            continue;
          }

          const userId = prefs.user_id;

          // Morning check-in
          if (prefs.morning_checkin.enabled && prefs.morning_checkin.time === currentTime) {
            await NotificationHelpers.notifyMorningCheckin(userId);
          }

          // Workout reminder
          if (prefs.workout_reminder.enabled && prefs.workout_reminder.time === currentTime) {
            await NotificationHelpers.notifyWorkoutReminder(userId);
          }

          // Water reminders (can have multiple times)
          if (prefs.water_reminder.enabled && prefs.water_reminder.times.includes(currentTime)) {
            await this.sendWaterReminderIfNeeded(userId);
          }

          // Meal reminders
          if (prefs.meal_reminder.enabled) {
            if (prefs.meal_reminder.breakfast_time === currentTime) {
              await this.sendMealReminderIfNotLogged(userId, 'breakfast');
            }
            if (prefs.meal_reminder.lunch_time === currentTime) {
              await this.sendMealReminderIfNotLogged(userId, 'lunch');
            }
            if (prefs.meal_reminder.dinner_time === currentTime) {
              await this.sendMealReminderIfNotLogged(userId, 'dinner');
            }
          }

          // Evening summary
          if (prefs.evening_summary.enabled && prefs.evening_summary.time === currentTime) {
            await this.sendEveningSummary(userId);
          }

          // Streak protection (check at 6 PM if enabled)
          if (prefs.streak_protection && currentTime === '18:00') {
            await this.sendStreakProtectionIfNeeded(userId);
          }

          // Incomplete goals reminder (check at 8 PM if enabled)
          if (prefs.incomplete_goals && currentTime === '20:00') {
            await this.sendIncompleteGoalsReminder(userId);
          }
        }
      } catch (error) {
        console.error('Error in hourly notification check:', error);
      }
    });

    this.jobs.set('hourly_checks', job);
  }

  /**
   * Weekly summary (Sunday at 8 PM)
   */
  private scheduleWeeklySummary() {
    // Run every Sunday at 20:00 (8 PM)
    const job = cron.schedule('0 20 * * 0', async () => {
      console.log('📊 Running weekly summary notifications...');

      try {
        const allPrefs = await NotificationPreferences.find({
          push_notifications_enabled: true,
          weekly_summary: true,
        });

        for (const prefs of allPrefs) {
          await this.sendWeeklySummary(prefs.user_id);
        }
      } catch (error) {
        console.error('Error sending weekly summaries:', error);
      }
    });

    this.jobs.set('weekly_summary', job);
  }

  /**
   * Monthly goal update reminder (1st of month at 9 AM)
   */
  private scheduleMonthlyGoalReminder() {
    // Run on the 1st of each month at 09:00
    const job = cron.schedule('0 9 1 * *', async () => {
      console.log('🎯 Running monthly goal update reminders...');

      try {
        const allPrefs = await NotificationPreferences.find({
          push_notifications_enabled: true,
          goal_update_reminder: true,
        });

        for (const prefs of allPrefs) {
          await NotificationHelpers.notifyGoalUpdateReminder(prefs.user_id);
        }
      } catch (error) {
        console.error('Error sending goal update reminders:', error);
      }
    });

    this.jobs.set('monthly_goal_reminder', job);
  }

  /**
   * HELPER FUNCTIONS
   */

  private isInQuietHours(prefs: any, hour: number, minute: number): boolean {
    if (!prefs.quiet_hours_enabled) return false;

    const currentTime = hour * 60 + minute;
    const [startHour, startMinute] = prefs.quiet_hours_start.split(':').map(Number);
    const [endHour, endMinute] = prefs.quiet_hours_end.split(':').map(Number);

    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    // Handle overnight quiet hours
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    }

    return currentTime >= startTime && currentTime < endTime;
  }

  private async sendWaterReminderIfNeeded(userId: mongoose.Types.ObjectId) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [goal, waterLogs] = await Promise.all([
        Goal.findOne({ user_id: userId }),
        WaterLog.find({ user_id: userId, date: today }),
      ]);

      if (!goal) return;

      const totalWater = waterLogs.reduce((sum, log) => sum + log.amount_ml, 0);
      const percentage = (totalWater / goal.water_target_ml) * 100;

      // Only send reminder if less than 50% of goal
      if (percentage < 50) {
        await NotificationHelpers.notifyWaterReminder(userId, totalWater, goal.water_target_ml);
      }
    } catch (error) {
      console.error('Error sending water reminder:', error);
    }
  }

  private async sendMealReminderIfNotLogged(
    userId: mongoose.Types.ObjectId,
    mealType: 'breakfast' | 'lunch' | 'dinner'
  ) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const mealLogged = await MealLog.findOne({
        user_id: userId,
        date: today,
        meal_type: mealType,
      });

      // Only send reminder if meal not logged
      if (!mealLogged) {
        await NotificationHelpers.notifyMealReminder(userId, mealType);
      }
    } catch (error) {
      console.error('Error sending meal reminder:', error);
    }
  }

  private async sendEveningSummary(userId: mongoose.Types.ObjectId) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [goal, meals, stepLog, workouts] = await Promise.all([
        Goal.findOne({ user_id: userId }),
        MealLog.find({ user_id: userId, date: today }),
        StepLog.findOne({ user_id: userId, date: today }),
        Workout.countDocuments({
          user_id: userId,
          started_at: { $gte: new Date(today) },
          ended_at: { $ne: null },
        }),
      ]);

      if (!goal) return;

      const caloriesLogged = meals.reduce((sum, meal) => sum + meal.calories, 0);
      const stepsToday = stepLog?.steps || 0;

      const goalsRemaining: string[] = [];
      if (caloriesLogged < goal.calorie_target) goalsRemaining.push('calories');
      if (stepsToday < goal.step_target) goalsRemaining.push('steps');
      if (workouts === 0) goalsRemaining.push('workout');

      await NotificationHelpers.notifyEveningSummary(userId, {
        caloriesLogged,
        stepsToday,
        workoutsToday: workouts,
        goalsRemaining,
      });
    } catch (error) {
      console.error('Error sending evening summary:', error);
    }
  }

  private async sendStreakProtectionIfNeeded(userId: mongoose.Types.ObjectId) {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Check if workout done today
      const workoutToday = await Workout.findOne({
        user_id: userId,
        started_at: { $gte: new Date(todayStr) },
        ended_at: { $ne: null },
      });

      if (workoutToday) return; // Already worked out today

      // Calculate current streak
      const streak = await this.calculateWorkoutStreak(userId);

      // Only notify if streak >= 3 days
      if (streak >= 3) {
        await NotificationHelpers.notifyStreakProtection(userId, streak);
      }
    } catch (error) {
      console.error('Error sending streak protection:', error);
    }
  }

  private async sendIncompleteGoalsReminder(userId: mongoose.Types.ObjectId) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [goal, meals, stepLog, waterLogs] = await Promise.all([
        Goal.findOne({ user_id: userId }),
        MealLog.find({ user_id: userId, date: today }),
        StepLog.findOne({ user_id: userId, date: today }),
        WaterLog.find({ user_id: userId, date: today }),
      ]);

      if (!goal) return;

      const incompleteGoals: string[] = [];

      const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
      if (totalCalories < goal.calorie_target) {
        incompleteGoals.push('calories');
      }

      if (!stepLog || stepLog.steps < goal.step_target) {
        incompleteGoals.push('steps');
      }

      const totalWater = waterLogs.reduce((sum, log) => sum + log.amount_ml, 0);
      if (totalWater < goal.water_target_ml) {
        incompleteGoals.push('water');
      }

      if (incompleteGoals.length > 0) {
        await NotificationHelpers.notifyIncompleteGoals(userId, incompleteGoals);
      }
    } catch (error) {
      console.error('Error sending incomplete goals reminder:', error);
    }
  }

  private async sendWeeklySummary(userId: mongoose.Types.ObjectId) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [workouts, stepLogs, mealLogs] = await Promise.all([
        Workout.find({
          user_id: userId,
          started_at: { $gte: sevenDaysAgo },
          ended_at: { $ne: null },
        }).populate('exercises.exercise_id'),
        StepLog.find({
          user_id: userId,
          created_at: { $gte: sevenDaysAgo },
        }),
        MealLog.find({
          user_id: userId,
          created_at: { $gte: sevenDaysAgo },
        }),
      ]);

      const totalWorkouts = workouts.length;
      const totalSteps = stepLogs.reduce((sum, log) => sum + log.steps, 0);
      const avgCalories =
        mealLogs.length > 0
          ? mealLogs.reduce((sum, meal) => sum + meal.calories, 0) / 7
          : 0;

      // Find most frequent exercise
      const exerciseCounts: Record<string, number> = {};
      workouts.forEach((workout) => {
        workout.exercises.forEach((ex: any) => {
          const name = typeof ex.exercise_id === 'object' ? ex.exercise_id.name : 'Unknown';
          exerciseCounts[name] = (exerciseCounts[name] || 0) + 1;
        });
      });

      const topExercise = Object.entries(exerciseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

      await NotificationHelpers.notifyWeeklySummary(userId, {
        totalWorkouts,
        totalSteps,
        avgCalories,
        topExercise,
        newPRs: 0, // TODO: Calculate PRs from workout history
      });
    } catch (error) {
      console.error('Error sending weekly summary:', error);
    }
  }

  private async calculateWorkoutStreak(userId: mongoose.Types.ObjectId): Promise<number> {
    try {
      let streak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      while (true) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const nextDay = new Date(currentDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const workout = await Workout.findOne({
          user_id: userId,
          started_at: { $gte: currentDate, $lt: nextDay },
          ended_at: { $ne: null },
        });

        if (workout) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }

        // Safety limit to prevent infinite loop
        if (streak > 1000) break;
      }

      return streak;
    } catch (error) {
      console.error('Error calculating streak:', error);
      return 0;
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped job: ${name}`);
    });
    this.jobs.clear();
  }
}

export default new NotificationScheduler();
