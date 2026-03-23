import mongoose, { Schema, model, models } from 'mongoose';
import { NotificationType } from './Notification';

export interface IReminderSchedule {
  enabled: boolean;
  time: string; // Format: "HH:MM" (24-hour)
}

export interface INotificationPreferences {
  _id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  fcm_token?: string; // Firebase Cloud Messaging token
  fcm_token_updated_at?: Date;

  // Global settings
  push_notifications_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // Format: "HH:MM"
  quiet_hours_end: string; // Format: "HH:MM"

  // Achievement notifications
  workout_completed: boolean;
  pr_achieved: boolean;
  calorie_goal_reached: boolean;
  macro_goal_reached: boolean;
  step_goal_reached: boolean;
  water_goal_reached: boolean;
  perfect_day: boolean;
  streak_milestone: boolean;
  volume_milestone: boolean;
  weight_milestone: boolean;
  total_workouts_milestone: boolean;

  // Reminder notifications with scheduling
  morning_checkin: IReminderSchedule;
  workout_reminder: IReminderSchedule;
  water_reminder: {
    enabled: boolean;
    times: string[]; // Multiple times: ["09:00", "14:00", "19:00"]
  };
  meal_reminder: {
    enabled: boolean;
    breakfast_time: string;
    lunch_time: string;
    dinner_time: string;
  };
  evening_summary: IReminderSchedule;
  streak_protection: boolean;
  incomplete_goals: boolean;
  template_reminder: boolean;
  rest_day_suggestion: boolean;

  // Progress & Insights
  weekly_summary: boolean;
  personal_best: boolean;
  consistency_insight: boolean;
  improvement_detected: boolean;

  // System notifications
  step_sync_complete: boolean;
  goal_update_reminder: boolean;

  // Tracking for preventing duplicate reminders
  last_water_reminder_sent?: string; // Format: "YYYY-MM-DD:HH:MM"
  last_morning_checkin_sent?: string; // Format: "YYYY-MM-DD"
  last_workout_reminder_sent?: string; // Format: "YYYY-MM-DD"
  last_meal_reminder_sent?: {
    breakfast?: string; // Format: "YYYY-MM-DD"
    lunch?: string;
    dinner?: string;
  };

  created_at: Date;
  updated_at: Date;
}

const NotificationPreferencesSchema = new Schema<INotificationPreferences>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    fcm_token: {
      type: String,
      sparse: true, // Allow multiple nulls but unique non-null values
    },
    fcm_token_updated_at: {
      type: Date,
    },

    // Global settings
    push_notifications_enabled: {
      type: Boolean,
      default: true,
    },
    quiet_hours_enabled: {
      type: Boolean,
      default: false,
    },
    quiet_hours_start: {
      type: String,
      default: '22:00', // 10 PM
    },
    quiet_hours_end: {
      type: String,
      default: '08:00', // 8 AM
    },

    // Achievement notifications (default: all enabled)
    workout_completed: { type: Boolean, default: true },
    pr_achieved: { type: Boolean, default: true },
    calorie_goal_reached: { type: Boolean, default: true },
    macro_goal_reached: { type: Boolean, default: true },
    step_goal_reached: { type: Boolean, default: true },
    water_goal_reached: { type: Boolean, default: true },
    perfect_day: { type: Boolean, default: true },
    streak_milestone: { type: Boolean, default: true },
    volume_milestone: { type: Boolean, default: true },
    weight_milestone: { type: Boolean, default: true },
    total_workouts_milestone: { type: Boolean, default: true },

    // Reminder notifications
    morning_checkin: {
      type: {
        enabled: { type: Boolean, default: true },
        time: { type: String, default: '08:00' },
      },
      default: { enabled: true, time: '08:00' },
    },
    workout_reminder: {
      type: {
        enabled: { type: Boolean, default: true },
        time: { type: String, default: '18:00' },
      },
      default: { enabled: true, time: '18:00' },
    },
    water_reminder: {
      type: {
        enabled: { type: Boolean, default: true },
        times: { type: [String], default: ['10:00', '14:00', '18:00'] },
      },
      default: { enabled: true, times: ['10:00', '14:00', '18:00'] },
    },
    meal_reminder: {
      type: {
        enabled: { type: Boolean, default: false },
        breakfast_time: { type: String, default: '08:00' },
        lunch_time: { type: String, default: '12:30' },
        dinner_time: { type: String, default: '19:00' },
      },
      default: {
        enabled: false,
        breakfast_time: '08:00',
        lunch_time: '12:30',
        dinner_time: '19:00',
      },
    },
    evening_summary: {
      type: {
        enabled: { type: Boolean, default: true },
        time: { type: String, default: '21:00' },
      },
      default: { enabled: true, time: '21:00' },
    },
    streak_protection: { type: Boolean, default: true },
    incomplete_goals: { type: Boolean, default: true },
    template_reminder: { type: Boolean, default: true },
    rest_day_suggestion: { type: Boolean, default: true },

    // Progress & Insights
    weekly_summary: { type: Boolean, default: true },
    personal_best: { type: Boolean, default: true },
    consistency_insight: { type: Boolean, default: true },
    improvement_detected: { type: Boolean, default: true },

    // System
    step_sync_complete: { type: Boolean, default: false }, // Default off (can be noisy)
    goal_update_reminder: { type: Boolean, default: true },

    // Tracking for preventing duplicate reminders
    last_water_reminder_sent: { type: String }, // Format: "YYYY-MM-DD:HH:MM"
    last_morning_checkin_sent: { type: String }, // Format: "YYYY-MM-DD"
    last_workout_reminder_sent: { type: String }, // Format: "YYYY-MM-DD"
    last_meal_reminder_sent: {
      type: {
        breakfast: { type: String },
        lunch: { type: String },
        dinner: { type: String },
      },
      default: {},
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Index for FCM token lookups
NotificationPreferencesSchema.index({ fcm_token: 1 }, { sparse: true });

const NotificationPreferences =
  models.NotificationPreferences ||
  model<INotificationPreferences>('NotificationPreferences', NotificationPreferencesSchema);

export default NotificationPreferences;
