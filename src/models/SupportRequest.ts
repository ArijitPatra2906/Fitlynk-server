import mongoose, { Schema, model, models } from 'mongoose'

export interface ISupportRequest {
  _id: mongoose.Types.ObjectId
  user_id?: mongoose.Types.ObjectId
  email: string
  category: 'bug' | 'feature' | 'account' | 'other'
  subject: string
  message: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  created_at: Date
  updated_at: Date
}

const SupportRequestSchema = new Schema<ISupportRequest>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['bug', 'feature', 'account', 'other'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    status: {
      type: String,
      default: 'open',
      enum: ['open', 'in_progress', 'resolved', 'closed'],
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
)

const SupportRequest =
  models.SupportRequest ||
  model<ISupportRequest>('SupportRequest', SupportRequestSchema)

export default SupportRequest
