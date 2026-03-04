import express from 'express';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import Notification from '../models/Notification';
import NotificationPreferences from '../models/NotificationPreferences';
import notificationService from '../services/notificationService';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * GET /api/notifications
 * Get notifications for authenticated user
 */
router.get('/', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: any = { user_id: new mongoose.Types.ObjectId(userId) };

    // Filter by read status if specified
    if (req.query.read === 'true') {
      filter.read = true;
    } else if (req.query.read === 'false') {
      filter.read = false;
    }

    // Filter by type if specified
    if (req.query.type) {
      filter.type = req.query.type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user_id: new mongoose.Types.ObjectId(userId), read: false }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        unreadCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
router.patch('/:id/read', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const notificationId = req.params.id;

    await notificationService.markAsRead(notificationId, userId);

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
router.patch('/read-all', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    await notificationService.markAllAsRead(userId);

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const notificationId = req.params.id;

    await notificationService.deleteNotification(notificationId, userId);

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/notifications/preferences
 * Get notification preferences for authenticated user
 */
router.get('/preferences', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    let prefs = await NotificationPreferences.findOne({
      user_id: new mongoose.Types.ObjectId(userId),
    }).lean();

    // Create default preferences if none exist
    if (!prefs) {
      prefs = await NotificationPreferences.create({
        user_id: new mongoose.Types.ObjectId(userId),
      });
    }

    res.json({ success: true, data: prefs });
  } catch (error: any) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update notification preferences
 */
router.put('/preferences', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const updates = req.body;

    // Don't allow updating user_id or fcm_token through this endpoint
    delete updates.user_id;
    delete updates.fcm_token;
    delete updates.fcm_token_updated_at;

    const prefs = await NotificationPreferences.findOneAndUpdate(
      { user_id: new mongoose.Types.ObjectId(userId) },
      { $set: updates },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: prefs });
  } catch (error: any) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/register-token
 * Register FCM token for push notifications
 */
router.post('/register-token', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { fcm_token } = req.body;

    if (!fcm_token) {
      return res.status(400).json({ success: false, error: 'FCM token is required' });
    }

    await notificationService.registerFCMToken(userId, fcm_token);

    res.json({ success: true, message: 'FCM token registered successfully' });
  } catch (error: any) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/test
 * Send a test notification (for development)
 */
router.post('/test', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, error: 'Not available in production' });
    }

    const { type, title, body, data } = req.body;

    await notificationService.sendNotification({
      userId,
      type: type || 'workout_completed',
      title: title || '🎉 Test Notification',
      body: body || 'This is a test notification from Fitlynk!',
      data: data || { test: true },
    });

    res.json({ success: true, message: 'Test notification sent' });
  } catch (error: any) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/send-test
 * Send a test notification to a specific user (for development/testing)
 */
router.post('/send-test', authenticateUser, async (req, res) => {
  try {
    const requesterId = req.user?._id;
    if (!requesterId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, error: 'Not available in production' });
    }

    const { user_id, type, title, body, data } = req.body;

    // Use provided user_id or default to requester's ID
    const targetUserId = user_id || requesterId;

    await notificationService.sendNotification({
      userId: targetUserId,
      type: type || 'workout_completed',
      title: title || '🎉 Test Notification',
      body: body || 'This is a test notification from Fitlynk!',
      data: data || { test: true },
    });

    res.json({
      success: true,
      message: 'Test notification sent',
      data: {
        user_id: targetUserId,
        type: type || 'workout_completed',
        title: title || '🎉 Test Notification',
        body: body || 'This is a test notification from Fitlynk!',
      }
    });
  } catch (error: any) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
