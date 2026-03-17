import mongoose, { Schema, model, models } from 'mongoose';

export type NotificationType =
  // Achievement Notifications
  | 'workout_completed'
  | 'pr_achieved'
  | 'calorie_goal_reached'
  | 'macro_goal_reached'
  | 'step_goal_reached'
  | 'water_goal_reached'
  | 'perfect_day'
  | 'streak_milestone'
  | 'volume_milestone'
  | 'weight_milestone'
  | 'total_workouts_milestone'
  // Reminder Notifications
  | 'morning_checkin'
  | 'workout_reminder'
  | 'water_reminder'
  | 'meal_reminder'
  | 'evening_summary'
  | 'streak_protection'
  | 'incomplete_goals'
  | 'template_reminder'
  | 'rest_day_suggestion'
  | 'todo_reminder'
  // Progress & Insights
  | 'weekly_summary'
  | 'personal_best'
  | 'consistency_insight'
  | 'improvement_detected'
  // System
  | 'step_sync_complete'
  | 'goal_update_reminder';

export interface INotification {
  _id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>; // Additional metadata (workout_id, exercise_name, etc.)
  read: boolean;
  sent_at?: Date; // When push notification was sent
  read_at?: Date; // When user marked as read
  created_at: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        // Achievement
        'workout_completed',
        'pr_achieved',
        'calorie_goal_reached',
        'macro_goal_reached',
        'step_goal_reached',
        'water_goal_reached',
        'perfect_day',
        'streak_milestone',
        'volume_milestone',
        'weight_milestone',
        'total_workouts_milestone',
        // Reminders
        'morning_checkin',
        'workout_reminder',
        'water_reminder',
        'meal_reminder',
        'evening_summary',
        'streak_protection',
        'incomplete_goals',
        'template_reminder',
        'rest_day_suggestion',
        'todo_reminder',
        // Insights
        'weekly_summary',
        'personal_best',
        'consistency_insight',
        'improvement_detected',
        // System
        'step_sync_complete',
        'goal_update_reminder',
      ],
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    body: {
      type: String,
      required: true,
      maxlength: 500,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    sent_at: {
      type: Date,
    },
    read_at: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

// Compound indexes for efficient queries
NotificationSchema.index({ user_id: 1, created_at: -1 });
NotificationSchema.index({ user_id: 1, read: 1, created_at: -1 });
NotificationSchema.index({ user_id: 1, type: 1 });

const Notification = models.Notification || model<INotification>('Notification', NotificationSchema);

export default Notification;
