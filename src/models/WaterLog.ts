import mongoose, { Schema, model, models } from 'mongoose';

export interface IWaterLog {
  _id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  date: Date;
  amount_ml: number;
  created_at: Date;
}

const WaterLogSchema = new Schema<IWaterLog>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      index: true,
    },
    amount_ml: {
      type: Number,
      required: [true, 'Water amount is required'],
      min: 1,
      max: 10000,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

WaterLogSchema.index({ user_id: 1, date: -1 });

const WaterLog = models.WaterLog || model<IWaterLog>('WaterLog', WaterLogSchema);

export default WaterLog;
