import { Router } from 'express'
import { createHash } from 'crypto'
import { OAuth2Client } from 'google-auth-library'
import User from '../models/User'
import {
  hashPassword,
  comparePassword,
  generateToken,
  errorResponse,
  successResponse,
} from '../utils/auth'
import { authenticateUser, AuthRequest } from '../middleware/auth'

const router = Router()

// Use Web client for OAuth - works with browser-based OAuth flow on mobile
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
)

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const {
      email,
      name,
      password,
      height,
      weight_kg,
      date_of_birth,
      gender,
      units,
    } = req.body

    if (!email || !name || !password) {
      return errorResponse(res, 'Email, name, and password are required', 400)
    }

    if (password.length < 6) {
      return errorResponse(
        res,
        'Password must be at least 6 characters long',
        400,
      )
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return errorResponse(res, 'User with this email already exists', 409)
    }

    const hashedPassword = await hashPassword(password)

    // Check if user has completed onboarding (has all profile data)
    const hasCompletedOnboarding = !!(
      height &&
      weight_kg &&
      date_of_birth &&
      gender
    )

    const user = await User.create({
      email: email.toLowerCase(),
      name,
      password: hashedPassword,
      height: height || null,
      weight_kg: weight_kg || null,
      date_of_birth: date_of_birth || null,
      gender: gender || null,
      units: units || 'metric',
      auth_provider: 'email',
      onboarding_completed: hasCompletedOnboarding,
    })

    const token = generateToken(user._id.toString())

    return successResponse(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          height: user.height,
          weight_kg: user.weight_kg,
          date_of_birth: user.date_of_birth,
          gender: user.gender,
          units: user.units,
          avatar_url: user.avatar_url,
        },
        token,
        needsOnboarding: !user.onboarding_completed,
      },
      201,
    )
  } catch (error: any) {
    console.error('Register error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400)
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password',
    )

    if (!user) {
      return errorResponse(res, 'Invalid credentials', 401)
    }

    if (!user.password) {
      return errorResponse(res, 'Invalid credentials', 401)
    }

    const isPasswordCorrect = await comparePassword(password, user.password)

    if (!isPasswordCorrect) {
      return errorResponse(res, 'Invalid credentials', 401)
    }

    const token = generateToken(user._id.toString())

    return successResponse(res, {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        height: user.height,
        date_of_birth: user.date_of_birth,
        gender: user.gender,
        units: user.units,
        avatar_url: user.avatar_url,
      },
      token,
      needsOnboarding: !user.onboarding_completed,
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

// GET /api/auth/google/callback - OAuth callback endpoint
router.get('/google/callback', async (req, res) => {
  try {
    const { code, error } = req.query

    if (error) {
      // Return HTML that closes the browser and shows error
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Authentication Error</title>
            <script>
              window.close();
            </script>
          </head>
          <body>
            <p>Authentication failed. You can close this window.</p>
          </body>
        </html>
      `)
    }

    if (!code) {
      return errorResponse(res, 'No authorization code provided', 400)
    }

    // Exchange code for tokens
    const { tokens } = await googleClient.getToken({
      code: code as string,
      redirect_uri: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/google/callback`,
    })

    if (!tokens.id_token) {
      return errorResponse(res, 'No ID token received', 400)
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload) {
      return errorResponse(res, 'Invalid token payload', 400)
    }

    const { sub: googleId, email, name, picture } = payload

    if (!email) {
      return errorResponse(res, 'Email not provided by Google', 400)
    }

    let user = await User.findOne({ $or: [{ google_id: googleId }, { email }] })

    if (!user) {
      user = await User.create({
        email,
        name: name || email.split('@')[0],
        avatar_url: picture,
        google_id: googleId,
        auth_provider: 'google',
        units: 'metric',
        onboarding_completed: false,
      })
    } else if (!user.google_id) {
      user.google_id = googleId
      user.avatar_url = picture || user.avatar_url
      await user.save()
    }

    const authToken = generateToken(user._id.toString())
    const needsOnboarding = !user.onboarding_completed

    // Return HTML that closes the browser and communicates with the app
    const redirectUrl = needsOnboarding
      ? 'com.fitlynk.app://oauth?onboarding=true'
      : 'com.fitlynk.app://oauth'

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful</title>
          <script>
            // Try to send message to Capacitor app
            window.location.href = '${redirectUrl}&token=${authToken}';

            // Also close the browser after a short delay
            setTimeout(() => {
              window.close();
            }, 100);
          </script>
        </head>
        <body>
          <p>Authentication successful! Redirecting...</p>
        </body>
      </html>
    `)
  } catch (error: any) {
    console.error('Google OAuth callback error:', error)
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Error</title>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </head>
        <body>
          <p>Authentication failed: ${error.message}</p>
          <p>This window will close automatically.</p>
        </body>
      </html>
    `)
  }
})

// POST /api/auth/google-mobile
router.post('/google-mobile', async (req, res) => {
  try {
    const { idToken } = req.body

    if (!idToken) {
      return errorResponse(res, 'ID token required', 400)
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_ANDROID_CLIENT_ID, // ANDROID CLIENT ID
    })

    const payload = ticket.getPayload()
    if (!payload) {
      return errorResponse(res, 'Invalid Google token', 401)
    }

    const { sub: googleId, email, name, picture } = payload

    if (!email) {
      return errorResponse(res, 'Email not provided', 400)
    }

    let user = await User.findOne({ $or: [{ google_id: googleId }, { email }] })

    if (!user) {
      user = await User.create({
        email,
        name: name || email.split('@')[0],
        avatar_url: picture,
        google_id: googleId,
        auth_provider: 'google',
        units: 'metric',
        onboarding_completed: false,
      })
    }

    const token = generateToken(user._id.toString())

    return successResponse(res, {
      token,
      needsOnboarding: !user.onboarding_completed,
      user,
    })
  } catch (err: any) {
    console.error('Google mobile auth error:', err)
    return errorResponse(res, 'Google authentication failed', 401)
  }
})

// POST /api/auth/google-web
router.post('/google-web', async (req, res) => {
  try {
    const { access_token } = req.body

    if (!access_token) {
      return errorResponse(res, 'Access token required', 400)
    }

    // Fetch user info from Google using access token
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      },
    )

    if (!userInfoResponse.ok) {
      return errorResponse(res, 'Invalid access token', 401)
    }

    const googleUserInfo: any = await userInfoResponse.json()
    const {
      id: googleId,
      email,
      name,
      picture,
    } = googleUserInfo as {
      id: string
      email?: string
      name?: string
      picture?: string
    }

    if (!email) {
      return errorResponse(res, 'Email not provided by Google', 400)
    }

    let user = await User.findOne({ $or: [{ google_id: googleId }, { email }] })

    if (!user) {
      user = await User.create({
        email,
        name: name || email.split('@')[0],
        avatar_url: picture,
        google_id: googleId,
        auth_provider: 'google',
        units: 'metric',
        onboarding_completed: false,
      })
    } else if (!user.google_id) {
      user.google_id = googleId
      user.avatar_url = picture || user.avatar_url
      await user.save()
    }

    const token = generateToken(user._id.toString())

    return successResponse(res, {
      token,
      needsOnboarding: !user.onboarding_completed,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        height: user.height,
        weight_kg: user.weight_kg,
        date_of_birth: user.date_of_birth,
        gender: user.gender,
        units: user.units,
      },
    })
  } catch (err: any) {
    console.error('Google web auth error:', err)
    return errorResponse(res, 'Google authentication failed', 401)
  }
})

// GET /api/auth/me
router.get('/me', authenticateUser, async (req: AuthRequest, res) => {
  try {
    return successResponse(res, req.user)
  } catch (error: any) {
    console.error('Get user error:', error)
    return errorResponse(res, error.message || 'Unauthorized', 401)
  }
})

// PUT /api/auth/profile
router.put('/profile', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const allowedUpdates = [
      'name',
      'height',
      'weight_kg',
      'date_of_birth',
      'gender',
      'units',
      'avatar_url',
    ]

    const updates: any = {}

    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key]
      }
    })

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-password')

    if (!updatedUser) {
      return errorResponse(res, 'User not found', 404)
    }

    return successResponse(res, updatedUser)
  } catch (error: any) {
    console.error('Update profile error:', error)
    return errorResponse(res, error.message || 'Internal server error', 500)
  }
})

// POST /api/auth/avatar/upload
router.post(
  '/avatar/upload',
  authenticateUser,
  async (req: AuthRequest, res) => {
    try {
      const imageData = String(req.body?.imageData || '')
      if (!imageData || !imageData.startsWith('data:image/')) {
        return errorResponse(res, 'Valid imageData is required', 400)
      }

      // Basic guard to prevent very large base64 payloads.
      if (imageData.length > 1_800_000) {
        return errorResponse(res, 'Image payload is too large', 413)
      }

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME
      const apiKey = process.env.CLOUDINARY_API_KEY
      const apiSecret = process.env.CLOUDINARY_API_SECRET
      if (!cloudName || !apiKey || !apiSecret) {
        return errorResponse(
          res,
          'Cloudinary env is not configured on server',
          500,
        )
      }

      const timestamp = Math.floor(Date.now() / 1000)
      const folder = 'fitlynk/avatars'
      const publicId = `fitlynk_${req.user?._id}_${Date.now()}`
      const transformation = 'c_limit,w_512,h_512,q_auto,f_auto'

      const signatureBase = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}&transformation=${transformation}${apiSecret}`
      const signature = createHash('sha1').update(signatureBase).digest('hex')

      const body = new URLSearchParams()
      body.append('file', imageData)
      body.append('api_key', apiKey)
      body.append('timestamp', String(timestamp))
      body.append('folder', folder)
      body.append('public_id', publicId)
      body.append('transformation', transformation)
      body.append('signature', signature)

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        },
      )

      const uploadPayload: any = await uploadRes.json()
      if (!uploadRes.ok || !uploadPayload?.secure_url) {
        return errorResponse(
          res,
          uploadPayload?.error?.message || 'Cloudinary upload failed',
          uploadRes.status || 500,
        )
      }

      return successResponse(res, { avatar_url: uploadPayload.secure_url })
    } catch (error: any) {
      console.error('Avatar upload error:', error)
      return errorResponse(
        res,
        error.message || 'Failed to upload avatar',
        500,
      )
    }
  },
)

// POST /api/auth/avatar/generate
router.post(
  '/avatar/generate',
  authenticateUser,
  async (req: AuthRequest, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        return errorResponse(res, 'GEMINI_API_KEY is not configured', 500)
      }

      const baseUrl =
        process.env.GEMINI_API_BASE_URL ||
        'https://generativelanguage.googleapis.com'
      const model =
        process.env.GEMINI_AVATAR_MODEL || 'gemini-2.0-flash-exp'
      const count = Math.max(1, Math.min(4, Number(req.body?.count || 1)))
      const stylePrompt = String(req.body?.prompt || '').trim()
      const userName = req.user?.name || 'athlete'

      const promptBase =
        `Create a clean, modern fitness app profile avatar for ${userName}. ` +
        `Headshot only, centered face, sportswear or gym aesthetic, high contrast, no text, no watermark, plain background, app-icon friendly. ` +
        (stylePrompt ? `Style hint: ${stylePrompt}.` : '')

      const avatars: string[] = []

      for (let i = 0; i < count; i += 1) {
        const response = await fetch(
          `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `${promptBase} Variant ${i + 1}.`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.9,
                responseModalities: ['IMAGE', 'TEXT'],
              },
            }),
          },
        )

        if (!response.ok) {
          const errText = await response.text()
          return errorResponse(
            res,
            `Gemini avatar generation failed: ${errText}`,
            response.status,
          )
        }

        const data: any = await response.json()
        const parts: any[] =
          data?.candidates?.[0]?.content?.parts ||
          data?.candidates?.flatMap((c: any) => c?.content?.parts || []) ||
          []

        const inlineImage = parts.find(
          (p) => p?.inlineData?.data && p?.inlineData?.mimeType?.startsWith('image/'),
        )?.inlineData

        if (!inlineImage?.data) {
          continue
        }

        avatars.push(
          `data:${inlineImage.mimeType || 'image/png'};base64,${inlineImage.data}`,
        )
      }

      if (avatars.length === 0) {
        return errorResponse(
          res,
          'No avatar image returned by Gemini for this prompt',
          502,
        )
      }

      return successResponse(res, { avatars })
    } catch (error: any) {
      console.error('Generate avatar error:', error)
      return errorResponse(
        res,
        error.message || 'Failed to generate avatar',
        500,
      )
    }
  },
)

export default router
