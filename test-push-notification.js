/**
 * Push Notification Test Script
 *
 * This script sends a test push notification to a user's device.
 * The app does NOT need to be running for this to work.
 *
 * Prerequisites:
 * 1. User must be logged in at least once to register FCM token
 * 2. User must have granted notification permissions
 * 3. Backend must be running
 * 4. FCM credentials must be configured in backend
 *
 * Usage:
 *   node test-push-notification.js <user_id> [notification_type]
 *
 * Examples:
 *   node test-push-notification.js 65f1234567890abcdef12345
 *   node test-push-notification.js 65f1234567890abcdef12345 workout_reminder
 */

const axios = require('axios')
const readline = require('readline')

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'
const API_URL = `${BACKEND_URL}/api`

// Available notification types
const NOTIFICATION_TYPES = {
  // Workout notifications
  workout_completed: {
    title: '🏋️ Workout Complete!',
    body: 'Great job! You completed your Push A workout with 8 exercises.',
  },
  pr_achieved: {
    title: '🎉 New Personal Record!',
    body: 'You hit a new PR on Bench Press - 225 lbs!',
  },
  workout_reminder: {
    title: '💪 Time to Train!',
    body: "Don't forget your scheduled Push A workout today.",
  },

  // Nutrition notifications
  calorie_goal_reached: {
    title: '🎯 Calorie Goal Reached!',
    body: "You've hit your daily calorie target of 2400 kcal.",
  },
  macro_goal_reached: {
    title: '🥗 Macro Goals Complete!',
    body: 'All your macro targets for today are met!',
  },
  meal_reminder: {
    title: '🍽️ Meal Time!',
    body: "It's time to log your lunch.",
  },

  // Step notifications
  step_goal_reached: {
    title: '👟 Step Goal Achieved!',
    body: "You've walked 10,000 steps today!",
  },
  step_sync_complete: {
    title: '✅ Steps Synced',
    body: 'Your step data has been synced successfully.',
  },

  // Water notifications
  water_goal_reached: {
    title: '💧 Hydration Goal Met!',
    body: "You've reached your daily water intake goal!",
  },
  water_reminder: {
    title: '💦 Stay Hydrated!',
    body: "Don't forget to drink water.",
  },

  // Achievement notifications
  perfect_day: {
    title: '⭐ Perfect Day!',
    body: 'You hit all your goals today - amazing work!',
  },
  streak_milestone: {
    title: '🔥 7 Day Streak!',
    body: "You've logged for 7 days straight. Keep it up!",
  },

  // Summary notifications
  morning_checkin: {
    title: '☀️ Good Morning!',
    body: 'Ready to crush your goals today?',
  },
  evening_summary: {
    title: '🌙 Daily Summary',
    body: 'You completed 3 out of 4 goals today!',
  },
  weekly_summary: {
    title: '📊 Weekly Progress',
    body: 'This week you worked out 5 times and hit your calorie goals 6 times!',
  },

  // Reminders
  goal_update_reminder: {
    title: '🎯 Update Your Goals',
    body: "It's been 30 days - time to review your fitness goals!",
  },
}

// Helper function to create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const question = (query) => {
  return new Promise((resolve) => rl.question(query, resolve))
}

// Get auth token
async function getAuthToken(email, password) {
  try {
    console.log('\n🔐 Logging in...')
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password,
    })

    if (response.data.success && response.data.data.token) {
      console.log('✅ Login successful')
      return response.data.data.token
    } else {
      throw new Error('Invalid login response')
    }
  } catch (error) {
    console.error(
      '❌ Login failed:',
      error.response?.data?.error || error.message,
    )
    throw error
  }
}

// Get user ID from token
async function getUserId(token) {
  try {
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.data.success && response.data.data._id) {
      return response.data.data._id
    } else {
      throw new Error('Could not get user ID')
    }
  } catch (error) {
    console.error(
      '❌ Failed to get user ID:',
      error.response?.data?.error || error.message,
    )
    throw error
  }
}

// Send test notification
async function sendTestNotification(
  token,
  userId,
  notificationType,
  customTitle,
  customBody,
) {
  try {
    const notificationData = NOTIFICATION_TYPES[notificationType] || {
      title: customTitle || '🔔 Test Notification',
      body: customBody || 'This is a test notification from the test script.',
    }

    console.log('\n📤 Sending notification...')
    console.log('Type:', notificationType)
    console.log('Title:', notificationData.title)
    console.log('Body:', notificationData.body)

    const response = await axios.post(
      `${API_URL}/notifications/send-test`,
      {
        user_id: userId,
        type: notificationType,
        title: notificationData.title,
        body: notificationData.body,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )

    if (response.data.success) {
      console.log('\n✅ Notification sent successfully!')
      console.log('📱 Check your device for the notification.')
      console.log(
        '\nNote: If the app is closed, you should see a system notification.',
      )
      console.log(
        '      If the app is open, it will appear in the in-app notification list.',
      )
      return true
    } else {
      throw new Error(response.data.error || 'Unknown error')
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.error('\n❌ Test endpoint not available.')
      console.error('The backend needs to have a test notification endpoint.')
      console.error('Check the backend implementation.')
    } else {
      console.error(
        '\n❌ Failed to send notification:',
        error.response?.data?.error || error.message,
      )
    }
    throw error
  }
}

// Check if FCM token exists for user
async function checkFCMToken(token, userId) {
  try {
    const response = await axios.get(`${API_URL}/notifications/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.data.success) {
      const prefs = response.data.data
      if (prefs.fcm_token) {
        console.log('✅ FCM token found for user')
        return true
      } else {
        console.log('⚠️  No FCM token registered for this user')
        console.log('   The user needs to log in from the mobile app first.')
        return false
      }
    }
    return false
  } catch (error) {
    console.error(
      '❌ Could not check FCM token:',
      error.response?.data?.error || error.message,
    )
    return false
  }
}

// Interactive mode
async function interactiveMode() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════╗')
    console.log('║      Fitlynk Push Notification Test Script           ║')
    console.log('╚════════════════════════════════════════════════════════╝\n')

    // Get credentials
    const email = await question('Enter your email: ')
    const password = await question('Enter your password: ')

    // Login
    const token = await getAuthToken(email, password)
    const userId = await getUserId(token)
    console.log('✅ User ID:', userId)

    // Check FCM token
    await checkFCMToken(token, userId)

    // Show notification types
    console.log('\n📋 Available notification types:')
    console.log('─────────────────────────────────────────────────────────')
    Object.keys(NOTIFICATION_TYPES).forEach((type, index) => {
      const notification = NOTIFICATION_TYPES[type]
      console.log(`${index + 1}. ${type}`)
      console.log(`   ${notification.title} - ${notification.body}`)
      console.log('')
    })
    console.log(
      `${Object.keys(NOTIFICATION_TYPES).length + 1}. custom (Create your own)`,
    )
    console.log('─────────────────────────────────────────────────────────\n')

    // Get notification type
    const choice = await question(
      'Choose a notification type (number or name): ',
    )

    let notificationType
    let customTitle
    let customBody

    if (
      choice === 'custom' ||
      parseInt(choice) === Object.keys(NOTIFICATION_TYPES).length + 1
    ) {
      notificationType = await question(
        'Enter notification type (e.g., workout_reminder): ',
      )
      customTitle = await question('Enter notification title: ')
      customBody = await question('Enter notification body: ')
    } else {
      const types = Object.keys(NOTIFICATION_TYPES)
      const index = parseInt(choice) - 1
      notificationType = isNaN(index) ? choice : types[index]

      if (!NOTIFICATION_TYPES[notificationType]) {
        console.error('❌ Invalid notification type')
        rl.close()
        return
      }
    }

    // Send notification
    await sendTestNotification(
      token,
      userId,
      notificationType,
      customTitle,
      customBody,
    )

    // Ask to send another
    const another = await question('\nSend another notification? (y/n): ')
    if (another.toLowerCase() === 'y') {
      rl.close()
      await interactiveMode()
    } else {
      console.log('\n👋 Goodbye!\n')
      rl.close()
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    rl.close()
    process.exit(1)
  }
}

// Command line mode
async function commandLineMode() {
  const userId = process.argv[2]
  const notificationType = process.argv[3] || 'workout_reminder'

  if (!userId) {
    console.error(
      '\n❌ Usage: node test-push-notification.js <user_id> [notification_type]',
    )
    console.error(
      '\nExample: node test-push-notification.js 65f1234567890abcdef12345 workout_reminder\n',
    )
    process.exit(1)
  }

  try {
    console.log('\n╔════════════════════════════════════════════════════════╗')
    console.log('║      Fitlynk Push Notification Test Script           ║')
    console.log('╚════════════════════════════════════════════════════════╝\n')

    // Get credentials
    const email = await question('Enter your email: ')
    const password = await question('Enter your password: ')

    // Login
    const token = await getAuthToken(email, password)

    // Check FCM token
    await checkFCMToken(token, userId)

    // Send notification
    await sendTestNotification(token, userId, notificationType)

    console.log('\n👋 Done!\n')
    rl.close()
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    rl.close()
    process.exit(1)
  }
}

// Main
async function main() {
  if (process.argv.length <= 2) {
    // No arguments - run interactive mode
    await interactiveMode()
  } else {
    // Arguments provided - run command line mode
    await commandLineMode()
  }
}

main()
