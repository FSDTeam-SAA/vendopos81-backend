import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import { User } from "../user/user.model";

const createConnectedAccount = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }

  



};

const onboardService = {
  createConnectedAccount,
};

export default onboardService;
