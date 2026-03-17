import mongoose, { Schema, Document } from 'mongoose';

export interface ITodo extends Document {
  user_id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  completed: boolean;
  completed_at?: Date;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
  recurs_daily?: boolean;
  created_at: Date;
  updated_at: Date;
}

const TodoSchema = new Schema<ITodo>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    completed_at: {
      type: Date,
    },
    due_date: {
      type: String,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    recurs_daily: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

// Index for efficient querying
TodoSchema.index({ user_id: 1, created_at: -1 });
TodoSchema.index({ user_id: 1, completed: 1, created_at: -1 });

export default mongoose.model<ITodo>('Todo', TodoSchema);
