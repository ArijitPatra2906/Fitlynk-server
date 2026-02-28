# Fitlynk Backend API

Express.js backend server for the Fitlynk fitness tracking application.

## Features

- User authentication (Email/Password & Google OAuth)
- Workout tracking and templates
- Exercise library management
- Nutrition tracking (meals and food search)
- Body metrics tracking
- Step counting and water intake logging
- Goal setting and tracking

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT + Google OAuth 2.0
- **Security**: Helmet, CORS

## Setup Instructions

### 1. Install Dependencies

```bash
cd fitlynk-backend
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/fitlynk

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Google OAuth
NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-google-android-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# CORS (comma-separated origins)
ALLOWED_ORIGINS=http://localhost:3000,capacitor://localhost,http://localhost
```

### 3. Run Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000`

### 4. Build for Production

```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google-mobile` - Google OAuth for mobile
- `GET /api/auth/me` - Get current user (requires auth)
- `PUT /api/auth/profile` - Update user profile (requires auth)

### Workouts
- `GET /api/workouts` - List workouts
- `POST /api/workouts` - Create workout
- `GET /api/workouts/:id` - Get workout details
- `PUT /api/workouts/:id` - Update workout
- `DELETE /api/workouts/:id` - Delete workout

### Exercises
- `GET /api/exercises` - List exercises
- `POST /api/exercises` - Create custom exercise

### Metrics
- `GET /api/metrics/goals` - Get goals
- `POST /api/metrics/goals` - Create/update goal
- `GET /api/metrics/goals/current` - Get current goal
- `GET /api/metrics/body` - Get body metrics
- `POST /api/metrics/body` - Log body metrics
- `GET /api/metrics/steps` - Get step logs
- `POST /api/metrics/steps` - Log steps
- `GET /api/metrics/water` - Get water logs
- `POST /api/metrics/water` - Log water intake

### Nutrition
- `GET /api/nutrition/foods/search` - Search foods
- `GET /api/nutrition/meals` - Get meal logs
- `POST /api/nutrition/meals` - Log meal

All endpoints except `/api/auth/register`, `/api/auth/login`, and `/api/auth/google-mobile` require authentication via Bearer token.

## Deployment to Render

### 1. Create New Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the `fitlynk-backend` directory as root

### 2. Configure Service

- **Name**: `fitlynk-backend`
- **Environment**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Instance Type**: Choose based on your needs (Free tier available)

### 3. Environment Variables

Add these in Render's Environment Variables section:

```
NODE_ENV=production
PORT=10000
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<generate-a-strong-secret>
NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
ALLOWED_ORIGINS=https://your-frontend-domain.com,capacitor://localhost,http://localhost
```

### 4. MongoDB Setup

You can use:
- **MongoDB Atlas** (recommended): Free tier available at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
- **Render's MongoDB** (if available in your plan)

### 5. Deploy

Click "Create Web Service" - Render will automatically deploy your backend.

Your API will be available at: `https://your-app-name.onrender.com`

## Security Notes

- Always use HTTPS in production
- Use strong JWT secrets (minimum 32 characters, random)
- Keep environment variables secure
- Regularly update dependencies
- Enable MongoDB authentication
- Use MongoDB Atlas IP whitelist for added security

## Testing

Check if the server is running:

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-..."
}
```

## Troubleshooting

### MongoDB Connection Issues

- Check if MongoDB is running
- Verify MONGODB_URI is correct
- Check network/firewall settings
- For MongoDB Atlas, whitelist your IP

### CORS Errors

- Add your frontend domain to ALLOWED_ORIGINS
- Ensure origins don't have trailing slashes
- For Capacitor, include `capacitor://localhost`

### Google OAuth Not Working

- Verify client ID and secret
- Check redirect URI matches: `com.fitlynk.app:/oauth2redirect`
- Ensure credentials are for Android OAuth client

## Support

For issues, please create a GitHub issue or contact support.
