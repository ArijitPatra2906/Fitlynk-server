import { Router } from 'express'
import SupportRequest from '../models/SupportRequest'
import { errorResponse, successResponse } from '../utils/auth'
import { authenticateUser, AuthRequest } from '../middleware/auth'

const router = Router()

// POST /api/support - Create a support request
router.post('/', async (req, res) => {
  try {
    const { email, category, subject, message } = req.body

    // Validation
    if (!email || !category || !subject || !message) {
      return errorResponse(
        res,
        'Email, category, subject, and message are required',
        400,
      )
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return errorResponse(res, 'Invalid email address', 400)
    }

    // Category validation
    if (!['bug', 'feature', 'account', 'other'].includes(category)) {
      return errorResponse(res, 'Invalid category', 400)
    }

    // Length validation
    if (subject.length > 200) {
      return errorResponse(res, 'Subject cannot exceed 200 characters', 400)
    }

    if (message.length > 5000) {
      return errorResponse(res, 'Message cannot exceed 5000 characters', 400)
    }

    // Create support request
    const supportRequest = new SupportRequest({
      email: email.toLowerCase().trim(),
      category,
      subject: subject.trim(),
      message: message.trim(),
      status: 'open',
    })

    await supportRequest.save()

    // In a real application, you would:
    // 1. Send an email to the support team
    // 2. Send a confirmation email to the user
    // 3. Create a ticket in your support system (e.g., Zendesk, Intercom)

    return successResponse(res, {
      message: 'Support request submitted successfully',
      request_id: supportRequest._id,
    })
  } catch (error: any) {
    console.error('Support request error:', error)
    return errorResponse(
      res,
      error.message || 'Failed to submit support request',
      500,
    )
  }
})

// POST /api/support/authenticated - Create a support request (authenticated)
router.post('/authenticated', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const { category, subject, message } = req.body
    const user = req.user

    if (!user) {
      return errorResponse(res, 'User not authenticated', 401)
    }

    // Validation
    if (!category || !subject || !message) {
      return errorResponse(
        res,
        'Category, subject, and message are required',
        400,
      )
    }

    // Category validation
    if (!['bug', 'feature', 'account', 'other'].includes(category)) {
      return errorResponse(res, 'Invalid category', 400)
    }

    // Length validation
    if (subject.length > 200) {
      return errorResponse(res, 'Subject cannot exceed 200 characters', 400)
    }

    if (message.length > 5000) {
      return errorResponse(res, 'Message cannot exceed 5000 characters', 400)
    }

    // Create support request with user association
    const supportRequest = new SupportRequest({
      user_id: user._id,
      email: user.email,
      category,
      subject: subject.trim(),
      message: message.trim(),
      status: 'open',
    })

    await supportRequest.save()

    return successResponse(res, {
      message: 'Support request submitted successfully',
      request_id: supportRequest._id,
    })
  } catch (error: any) {
    console.error('Support request error:', error)
    return errorResponse(
      res,
      error.message || 'Failed to submit support request',
      500,
    )
  }
})

// GET /api/support/my-requests - Get user's support requests (authenticated)
router.get('/my-requests', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const user = req.user

    if (!user) {
      return errorResponse(res, 'User not authenticated', 401)
    }

    const requests = await SupportRequest.find({ user_id: user._id })
      .sort({ created_at: -1 })
      .limit(50)

    return successResponse(res, requests)
  } catch (error: any) {
    console.error('Fetch support requests error:', error)
    return errorResponse(
      res,
      error.message || 'Failed to fetch support requests',
      500,
    )
  }
})

export default router
