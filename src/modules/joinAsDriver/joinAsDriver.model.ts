import { Schema, model } from 'mongoose';
import { IJoinAsDriver } from './joinAsDriver.interface';

const joinAsDriverSchema = new Schema<IJoinAsDriver>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    yearsOfExperience: { type: Number, required: true },
    licenseExpiryDate: { type: String, required: true },
    streetAddress: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    documents: [
      {
        url: { type: String, required: true },
      },
    ],
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'pending' 
    },
  },
  { timestamps: true }
);

export const JoinAsDriver = model<IJoinAsDriver>('JoinAsDriver', joinAsDriverSchema);