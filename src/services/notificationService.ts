import admin from 'firebase-admin';
import Notification, { NotificationType } from '../models/Notification';
import NotificationPreferences from '../models/NotificationPreferences';
import mongoose from 'mongoose';

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized) return;

  console.log('[DEBUG] FIREBASE_ADMIN_KEY_PATH:', process.env.FIREBASE_ADMIN_KEY_PATH);
  console.log('[DEBUG] FIREBASE_ADMIN_KEY:', process.env.FIREBASE_ADMIN_KEY ? 'SET' : 'NOT SET');

  try {
    // Try to initialize from environment variable (for production)
    if (process.env.FIREBASE_ADMIN_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized from environment variable');
    }
    // Try to initialize from file (for local development)
    else if (process.env.FIREBASE_ADMIN_KEY_PATH) {
      const serviceAccount = require('../config/firebase-admin-key.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized from file');
    } else {
      console.warn('⚠️ Firebase Admin not initialized - no credentials found');
      console.warn('Push notifications will be disabled. In-app notifications will still work.');
      return;
    }

    firebaseInitialized = true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    console.warn('Push notifications will be disabled. In-app notifications will still work.');
  }
};

// Initialize on first use (delayed initialization to allow env vars to load)
// initializeFirebase() will be called when first notification is sent

interface NotificationPayload {
  userId: mongoose.Types.ObjectId | string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

class NotificationService {
  /**
   * Send a notification to a user (both push and in-app)
   */
  async sendNotification(payload: NotificationPayload): Promise<boolean> {
    // Initialize Firebase on first use
    if (!firebaseInitialized) {
      initializeFirebase();
    }

    try {
      const userId =
        typeof payload.userId === 'string'
          ? new mongoose.Types.ObjectId(payload.userId)
          : payload.userId;

      // Get user notification preferences
      const prefs = await NotificationPreferences.findOne({ user_id: userId });

      // Check if notifications are enabled globally
      if (!prefs || !prefs.push_notifications_enabled) {
        console.log(`Notifications disabled for user ${userId}`);
        // Still create in-app notification even if push is disabled
        await this.createInAppNotification(payload);
        return false;
      }

      // Check if this specific notification type is enabled
      const notificationEnabled = prefs[payload.type as keyof typeof prefs];
      if (
        notificationEnabled !== undefined &&
        typeof notificationEnabled === 'boolean' &&
        !notificationEnabled
      ) {
        console.log(`Notification type ${payload.type} disabled for user ${userId}`);
        return false;
      }

      // Check quiet hours
      if (this.isQuietHours(prefs)) {
        console.log(`User ${userId} is in quiet hours - skipping push notification`);
        await this.createInAppNotification(payload);
        return false;
      }

      // Create in-app notification first
      await this.createInAppNotification(payload);

      // Send push notification if FCM token exists
      if (prefs.fcm_token) {
        await this.sendPushNotification(prefs.fcm_token, payload);
      } else {
        console.log(`No FCM token for user ${userId} - in-app notification created only`);
      }

      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  /**
   * Send push notification via FCM
   */
  private async sendPushNotification(
    fcmToken: string,
    payload: NotificationPayload
  ): Promise<void> {
    if (!firebaseInitialized) {
      console.warn('Firebase not initialized - skipping push notification');
      return;
    }

    try {
      // Convert all data values to strings (FCM requirement)
      const stringifiedData: Record<string, string> = {
        type: payload.type,
      };

      // Stringify any additional data
      if (payload.data) {
        Object.entries(payload.data).forEach(([key, value]) => {
          stringifiedData[key] = typeof value === 'string' ? value : JSON.stringify(value);
        });
      }

      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: stringifiedData,
        android: {
          notification: {
            channelId: 'fitlynk_default',
            priority: 'high' as const,
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log(`✅ Push notification sent successfully:`, response);
    } catch (error: any) {
      console.error('❌ Error sending push notification:', error);

      // If token is invalid, remove it from preferences
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        console.log(`Removing invalid FCM token: ${fcmToken}`);
        await NotificationPreferences.updateOne(
          { fcm_token: fcmToken },
          { $unset: { fcm_token: '', fcm_token_updated_at: '' } }
        );
      }
    }
  }

  /**
   * Create in-app notification record
   */
  private async createInAppNotification(payload: NotificationPayload): Promise<void> {
    try {
      const userId =
        typeof payload.userId === 'string'
          ? new mongoose.Types.ObjectId(payload.userId)
          : payload.userId;

      await Notification.create({
        user_id: userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        read: false,
        sent_at: new Date(),
      });

      console.log(`✅ In-app notification created for user ${userId}`);
    } catch (error) {
      console.error('Error creating in-app notification:', error);
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(prefs: any): boolean {
    if (!prefs.quiet_hours_enabled) return false;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = prefs.quiet_hours_start.split(':').map(Number);
    const [endHour, endMinute] = prefs.quiet_hours_end.split(':').map(Number);

    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    }

    return currentTime >= startTime && currentTime < endTime;
  }

  /**
   * Register or update FCM token for a user
   */
  async registerFCMToken(
    userId: mongoose.Types.ObjectId | string,
    fcmToken: string
  ): Promise<void> {
    try {
      const userIdObj =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      await NotificationPreferences.findOneAndUpdate(
        { user_id: userIdObj },
        {
          fcm_token: fcmToken,
          fcm_token_updated_at: new Date(),
        },
        { upsert: true, new: true }
      );

      console.log(`✅ FCM token registered for user ${userIdObj}`);
    } catch (error) {
      console.error('Error registering FCM token:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: mongoose.Types.ObjectId | string): Promise<void> {
    try {
      const userIdObj =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      await Notification.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(notificationId), user_id: userIdObj },
        { read: true, read_at: new Date() }
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: mongoose.Types.ObjectId | string): Promise<void> {
    try {
      const userIdObj =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      await Notification.updateMany(
        { user_id: userIdObj, read: false },
        { read: true, read_at: new Date() }
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: mongoose.Types.ObjectId | string): Promise<number> {
    try {
      const userIdObj =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      return await Notification.countDocuments({ user_id: userIdObj, read: false });
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    notificationId: string,
    userId: mongoose.Types.ObjectId | string
  ): Promise<void> {
    try {
      const userIdObj =
        typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      await Notification.findOneAndDelete({
        _id: new mongoose.Types.ObjectId(notificationId),
        user_id: userIdObj,
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }
}

export default new NotificationService();
