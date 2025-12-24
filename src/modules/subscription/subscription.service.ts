import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import Subscription from './subscription.model'

const createSubscription = async (email: string) => {
  const isSubscribe = await Subscription.findOne({ email });

  if (isSubscribe) {
    throw new AppError("This email is already subscribed!", StatusCodes.CONFLICT);
  }
  const result = await Subscription.create({ email });
  return result;

};

const getAllSubscriptionFromDb = async () => {
  return await Subscription.find().sort({ createdAt: -1 });
}

const deleteSubcriptionFromDb = async (id: string) => {
  return await Subscription.findByIdAndDelete(id);
}

const subscriptionService = {
  createSubscription,
  getAllSubscriptionFromDb,
  deleteSubcriptionFromDb
};

export default subscriptionService;
