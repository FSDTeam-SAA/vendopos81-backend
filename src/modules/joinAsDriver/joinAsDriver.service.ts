import { IJoinAsDriver } from './joinAsDriver.interface';
import { JoinAsDriver } from './joinAsDriver.model';

const createDriverRequestIntoDB = async (payload: IJoinAsDriver) => {
  const result = await JoinAsDriver.create(payload);
  return result;
};

const getAllDriverRequestsFromDB = async () => {
  const result = await JoinAsDriver.find().sort({ createdAt: -1 });
  return result;
};

export const DriverService = {
  createDriverRequestIntoDB,
  getAllDriverRequestsFromDB,
};