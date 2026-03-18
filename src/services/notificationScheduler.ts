/**
 * Notification Scheduler
 * Handles scheduled notifications using cron jobs
 * All times are in IST (Indian Standard Time - Asia/Kolkata)
 */

import * as cron from 'node-cron';
import NotificationPreferences from '../models/NotificationPreferences';
import NotificationHelpers from './notificationHelpers';
import Workout from '../models/Workout';
import StepLog from '../models/StepLog';
import MealLog from '../models/MealLog';
import Goal from '../models/Goal';
import WaterLog from '../models/WaterLog';
import Todo from '../models/Todo';
import mongoose from 'mongoose';
import { getISTDate, getISTDateString, getISTTimeString, getISTHour, getISTMinute } from '../utils/timezone';

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

    // Recurring todos creation (midnight daily)
    this.scheduleRecurringTodosCreation();

    console.log('✅ Notification scheduler initialized');
  }

  /**
   * Check every 30 minutes for time-based reminders
   * Runs at :00 and :30 of each hour to match IST timezone (which is UTC+5:30)
   */
  private scheduleHourlyChecks() {
    const job = cron.schedule('*/30 * * * *', async () => {
      // Get current time in IST
      const currentHour = getISTHour();
      const currentMinute = getISTMinute();
      const currentTime = getISTTimeString();

      console.log(`⏰ Running hourly notification check at ${currentTime} IST (Hour: ${currentHour}, Minute: ${currentMinute})`);

      try {
        // Get all users with notification preferences
        const allPrefs = await NotificationPreferences.find({
          push_notifications_enabled: true,
        });

        console.log(`Found ${allPrefs.length} users with push notifications enabled`);

        for (const prefs of allPrefs) {
          // Skip if in quiet hours
          if (this.isInQuietHours(prefs, currentHour, currentMinute)) {
            console.log(`User ${prefs.user_id} in quiet hours, skipping...`);
            continue;
          }

          const userId = prefs.user_id;

          // Morning check-in - compare time strings
          if (prefs.morning_checkin.enabled) {
            console.log(`User ${userId}: Morning check-in enabled=${prefs.morning_checkin.enabled}, time=${prefs.morning_checkin.time}, currentTime=${currentTime}`);
            if (prefs.morning_checkin.time === currentTime) {
              console.log(`✅ Sending morning check-in to user ${userId} at ${currentTime} IST`);
              await NotificationHelpers.notifyMorningCheckin(userId);
            }
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

          // Todo reminder (check at 10 PM daily)
          if (currentTime === '22:00') {
            await this.sendTodoReminderIfIncomplete(userId);
          }
        }
      } catch (error) {
        console.error('Error in hourly notification check:', error);
      }
    });

    this.jobs.set('hourly_checks', job);
  }

  /**
   * Weekly summary (Sunday at 8 PM IST)
   */
  private scheduleWeeklySummary() {
    // Run every Sunday at 20:00 IST (8 PM IST = 14:30 UTC)
    const job = cron.schedule('30 14 * * 0', async () => {
      console.log('📊 Running weekly summary notifications at 8 PM IST...');

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
   * Monthly goal update reminder (1st of month at 9 AM IST)
   */
  private scheduleMonthlyGoalReminder() {
    // Run on the 1st of each month at 09:00 IST (9 AM IST = 03:30 UTC)
    const job = cron.schedule('30 3 1 * *', async () => {
      console.log('🎯 Running monthly goal update reminders at 9 AM IST...');

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
   * Recurring todos creation (midnight IST daily at 00:00 IST)
   */
  private scheduleRecurringTodosCreation() {
    // Run every day at midnight IST (00:00 IST = 18:30 UTC previous day)
    const job = cron.schedule('30 18 * * *', async () => {
      console.log('🔄 Creating recurring todos for today at midnight IST...');

      try {
        // Get today's date in IST timezone in YYYY-MM-DD format
        const todayStr = getISTDateString();
        console.log(`IST Date: ${todayStr}`);

        // Find all recurring todos
        const recurringTodos = await Todo.find({
          recurs_daily: true,
        });

        console.log(`Found ${recurringTodos.length} recurring todos to process`);

        // For each recurring todo, check if today's instance exists
        for (const recurringTodo of recurringTodos) {
          // Check if today's instance already exists
          const existingToday = await Todo.findOne({
            user_id: recurringTodo.user_id,
            title: recurringTodo.title,
            due_date: todayStr,
            recurs_daily: true,
          });

          // Only create if it doesn't exist
          if (!existingToday) {
            await Todo.create({
              user_id: recurringTodo.user_id,
              title: recurringTodo.title,
              description: recurringTodo.description,
              priority: recurringTodo.priority,
              due_date: todayStr,
              recurs_daily: true,
              completed: false,
            });
            console.log(`Created recurring todo "${recurringTodo.title}" for ${todayStr} IST`);
          }
        }

        console.log('✅ Recurring todos creation completed');
      } catch (error) {
        console.error('Error creating recurring todos:', error);
      }
    });

    this.jobs.set('recurring_todos_creation', job);
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
      // Get start and end of today in local timezone
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const [goal, waterLogs] = await Promise.all([
        Goal.findOne({ user_id: userId }),
        WaterLog.find({
          user_id: userId,
          date: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        }),
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

  private async sendTodoReminderIfIncomplete(userId: mongoose.Types.ObjectId) {
    try {
      // Get today's date string in YYYY-MM-DD format
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Find incomplete todos with today's due date
      const incompleteTodos = await Todo.countDocuments({
        user_id: userId,
        completed: false,
        due_date: todayStr,
      });

      // Only send reminder if there are incomplete todos
      if (incompleteTodos > 0) {
        await NotificationHelpers.notifyTodoReminder(userId, incompleteTodos);
      }
    } catch (error) {
      console.error('Error sending todo reminder:', error);
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
      // TEMPORARILY DISABLED - Step tracking not working properly
      // const stepsToday = stepLog?.steps || 0;

      const goalsRemaining: string[] = [];
      if (caloriesLogged < goal.calorie_target) goalsRemaining.push('calories');
      // TEMPORARILY DISABLED - Step tracking not working properly
      // if (stepsToday < goal.step_target) goalsRemaining.push('steps');
      if (workouts === 0) goalsRemaining.push('workout');

      await NotificationHelpers.notifyEveningSummary(userId, {
        caloriesLogged,
        // TEMPORARILY DISABLED - Step tracking not working properly
        // stepsToday,
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
