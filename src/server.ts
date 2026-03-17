// Load environment variables FIRST before any other imports
import dotenv from 'dotenv'
dotenv.config()

// Initialize Firebase Admin after env vars are loaded
import { initializeFirebaseAdmin } from './config/firebase-admin'
initializeFirebaseAdmin()

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import connectDB from './config/database'
import notificationScheduler from './services/notificationScheduler'

// Routes
import authRoutes from './routes/auth'
import workoutsRoutes from './routes/workouts'
import exercisesRoutes from './routes/exercises'
import metricsRoutes from './routes/metrics'
import nutritionRoutes from './routes/nutrition'
import testRoutes from './routes/test'
import notificationsRoutes from './routes/notifications'
import todosRoutes from './routes/todos'

const app = express()
const PORT = parseInt(process.env.PORT || '5000', 10)

// Middleware
app.use(helmet())
app.use(compression())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'capacitor://localhost',
      'https://localhost',
      'http://localhost',
    ]

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true)

      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        allowedOrigins.includes('*')
      ) {
        callback(null, true)
      } else {
        console.warn(`Blocked CORS request from origin: ${origin}`)
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)

// Accept larger payloads for profile avatar data URLs uploaded from mobile/web.
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/workouts', workoutsRoutes)
app.use('/api/exercises', exercisesRoutes)
app.use('/api/metrics', metricsRoutes)
app.use('/api/nutrition', nutritionRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/todos', todosRoutes)
app.use('/api/test', testRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  })
})

// Error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error('Server error:', err)
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error',
    })
  },
)

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB()

    // Initialize notification scheduler
    notificationScheduler.init()

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════════╗
║   🏋️  Fitlynk Backend Server Running   🏋️   ║
╠═══════════════════════════════════════════╣
║   Port: ${PORT.toString().padEnd(34)}║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(26)} ║
║   Database: Connected ✓                   ║
║   Notifications: Scheduled ✓              ║
╚═══════════════════════════════════════════╝
      `)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
