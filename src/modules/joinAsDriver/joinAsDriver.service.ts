import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { uploadToCloudinary, deleteFromCloudinary } from '../../utils/cloudinary';
import sendEmail from '../../utils/sendEmail';
import sendTemplateMail from '../../utils/sendTamplateMail';
import { User } from '../user/user.model';
import { IDriverQuery, IJoinAsDriver } from './joinAsDriver.interface';
import JoinAsDriver from './joinAsDriver.model';
import mongoose from 'mongoose';

const getAllDrivers = async (query: IDriverQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter: any = {};
  if (query.status) filter.status = query.status;

  // Search Logic Fix: If searching by name/email, we usually search the User collection
  // and then filter the Driver profiles. For now, let's stick to driver-specific fields
  // or use a more advanced aggregation if needed.
  const search = query.search
    ? {
        $or: [
          { firstName: { $regex: query.search, $options: 'i' } }, // Driver profile name
          { email: { $regex: query.search, $options: 'i' } }, // Driver profile email
        ],
      }
    : {};

  const drivers = await JoinAsDriver.find({ ...filter, ...search })
    .populate('userId', 'firstName lastName email image')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await JoinAsDriver.countDocuments({ ...filter, ...search });
  return {
    data: drivers,
    meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
  };
};

const getMyDriverInfoFromDB = async (userIdFromToken: string) => {
  // Use the ID from JWT to find the document where userId matches
  const result = await JoinAsDriver.findOne({ userId: userIdFromToken }).populate(
    'userId',
    'firstName lastName email image role',
  );

  if (!result) {
    throw new AppError(
      'Driver profile not found. Please register as a driver.',
      StatusCodes.NOT_FOUND,
    );
  }
  return result;
};

const updateDriverStatus = async (id: string, status: 'approved' | 'rejected') => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const driverApp = await JoinAsDriver.findById(id).session(session);
    if (!driverApp) throw new AppError('Application not found', StatusCodes.NOT_FOUND);

    if (status === 'approved') {
      const user = await User.findById(driverApp.userId).session(session);
      if (!user) throw new AppError('User not found', StatusCodes.NOT_FOUND);

      const tempPassword = Math.random().toString(36).slice(-8);

      // 1. Promote User & Set Password (Model hashes this automatically)
      user.role = 'driver';
      user.password = tempPassword;
      user.isVerified = true;
      await user.save({ session });

      // 2. Update Application Status
      driverApp.status = 'approved';
      await driverApp.save({ session });

      // 3. Send Unified Approval Email
      await sendEmail({
        to: driverApp.email,
        subject: 'Application Approved - Welcome to Vendo Food Distribution System!',
        html: sendTemplateMail({
          type: 'success',
          email: driverApp.email,
          subject: 'Welcome to the Team!',
          message: `
            <h1 style="color: #2ecc71;">Congratulations!</h1>
            <p>Your application is approved. Use these credentials to log in to the Driver Dashboard:</p>
            <div style="background: #f4f4f4; padding: 10px; border-radius: 5px;">
              <p><b>Email:</b> ${driverApp.email}</p>
              <p><b>Temporary Password:</b> ${tempPassword}</p>
            </div>
            <p>Please change your password immediately after your first login.</p>
          `,
        }),
      });
    } else {
      // Handle Rejection
      driverApp.status = 'rejected';
      await driverApp.save({ session });

      await sendEmail({
        to: driverApp.email,
        subject: 'Driver Application Update',
        html: `<p>Hello ${driverApp.firstName}, unfortunately your application was not approved at this time.</p>`,
      });
    }

    await session.commitTransaction();
    return { success: true, status };
  } catch (error) {
    await session.abortTransaction(); // If anything (including email) fails, nothing changes
    throw error;
  } finally {
    session.endSession();
  }
};

const suspendDriver = async (id: string) => {
  const driver = await JoinAsDriver.findById(id);
  if (!driver) {
    throw new AppError('Driver not found', StatusCodes.NOT_FOUND);
  }

  if (driver.isSuspended) {
    throw new AppError('Driver is already suspended', StatusCodes.BAD_REQUEST);
  }

  driver.isSuspended = true;
  await driver.save();

  await sendEmail({
    to: driver.email,
    subject: 'Account Suspended',
    html: `
      <h3>Account Suspended</h3>
      <p>Your driver account has been suspended by the admin.</p>
      <p>If you believe this is a mistake, please contact support.</p>
    `,
  });

  return { success: true };
};

const unsuspendDriver = async (id: string) => {
  const driver = await JoinAsDriver.findById(id);
  if (!driver) {
    throw new AppError('Driver not found', StatusCodes.NOT_FOUND);
  }

  if (!driver.isSuspended) {
    throw new AppError('Driver is not suspended', StatusCodes.BAD_REQUEST);
  }

  driver.isSuspended = false;
  await driver.save();

  await sendEmail({
    to: driver.email,
    subject: 'Account Reactivated',
    html: `
      <h3>Account Reactivated</h3>
      <p>Your driver account has been reactivated.</p>
      <p>You can now start accepting orders again.</p>
    `,
  });

  return { success: true };
};

const getSingleDriver = async (id: string) => {
  const result = await JoinAsDriver.findById(id).populate(
    'userId',
    'firstName lastName email image',
  );
  if (!result) {
    throw new AppError('Driver application not found', StatusCodes.NOT_FOUND);
  }
  return result;
};

const deleteDriver = async (id: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const driver = await JoinAsDriver.findById(id).session(session);
    if (!driver) throw new AppError('Driver not found', StatusCodes.NOT_FOUND);

    // 1. Delete associated images from Cloudinary
    if (driver.documentUrl?.length) {
      for (const doc of driver.documentUrl) {
        await deleteFromCloudinary(doc.public_id);
      }
    }

    // 2. Decide: Delete User or just revert Role?
    // Usually, revert the role back to 'customer'
    await User.findByIdAndUpdate(driver.userId, { role: 'customer' }, { session });

    // 3. Delete the Driver Application
    await JoinAsDriver.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    return { message: 'Driver reverted to customer and application deleted' };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const updateMyProfileInDB = async (id: string, payload: Partial<IJoinAsDriver>) => {
  // 1. Check if the driver profile exists
  const isDriverExist = await JoinAsDriver.findOne({ userId: id });
  if (!isDriverExist) {
    throw new AppError('Driver profile not found', StatusCodes.NOT_FOUND);
  }

  // 2. SECURITY: Remove fields the driver is NOT allowed to change
  const restrictedFields = ['status', 'userId', 'isSuspended', 'suspendedUntil'];
  restrictedFields.forEach((field) => delete (payload as any)[field]);

  // 3. Update the document
  const result = await JoinAsDriver.findOneAndUpdate(
    { userId: id }, // Match by the User ID from token
    payload,
    {
      new: true,
      runValidators: true,
    },
  ).populate('userId', 'firstName lastName email image');

  return result;
};

const registerDriverUnified = async (payload: any, files: any, currentUser?: any) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  const uploadedImages: { public_id: string; url: string }[] = [];
  const generatedPassword = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    let userId: string;

    if (currentUser) {
      const user = await User.findOne({ email: currentUser.email });

      if (!user) {
        throw new AppError('User not found', StatusCodes.NOT_FOUND);
      }

      if (user.role === 'driver') {
        throw new AppError('You are already a registered driver', StatusCodes.BAD_REQUEST);
      }

      const existingApp = await JoinAsDriver.findOne({ userId: user._id });
      if (existingApp) {
        throw new AppError(
          `Application already exists: ${existingApp.status}`,
          StatusCodes.BAD_REQUEST,
        );
      }

      userId = user._id;
    } else {
      const isExist = await User.findOne({
        $or: [{ email: payload.email }, { phone: payload.phone }],
      });

      if (isExist) {
        throw new AppError('Email or Phone already exists', StatusCodes.CONFLICT);
      }

      const { password: _, ...safePayload } = payload;

      const [newUser] = await User.create(
        [
          {
            ...safePayload,
            password: generatedPassword,
            role: 'customer',
            isVerified: false,
          },
        ],
        { session },
      );

      userId = newUser._id;
    }

    const documentFiles = files?.documents || [];
    if (documentFiles.length === 0) {
      throw new AppError('Please upload required documents', StatusCodes.BAD_REQUEST);
    }

    for (const file of documentFiles) {
      const uploaded = await uploadToCloudinary(file.path, 'drivers/documents');

      uploadedImages.push({
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
      });
    }

    const { password: __, ...safePayloadForApp } = payload;
    const [newDriverApplication] = await JoinAsDriver.create(
      [
        {
          ...safePayloadForApp,
          userId,
          documentUrl: uploadedImages,
          status: 'pending',
        },
      ],
      { session },
    );

    await session.commitTransaction();

    return {
      userId,
      applicationId: newDriverApplication._id,
      currentRole: 'customer',
      applicationStatus: 'pending',
    };
  } catch (error) {
    await session.abortTransaction();
    for (const img of uploadedImages) {
      await deleteFromCloudinary(img.public_id);
    }

    throw error;
  } finally {
    session.endSession();
  }
};

const approveDriverApplication = async (applicationId: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Find the application
    const application = await JoinAsDriver.findById(applicationId).session(session);
    if (!application) {
      throw new AppError('Application not found', StatusCodes.NOT_FOUND);
    }

    if (application.status === 'approved') {
      throw new AppError('Application is already approved', StatusCodes.BAD_REQUEST);
    }

    // 2. Update Application Status
    application.status = 'approved';
    await application.save({ session });

    // 3. Update User Role (The fix for your problem)
    const user = await User.findByIdAndUpdate(
      application.userId,
      { role: 'driver' }, // Elevate the role here
      { session, new: true },
    );

    if (!user) {
      throw new AppError('Associated user not found', StatusCodes.NOT_FOUND);
    }

    // 4. Commit everything
    await session.commitTransaction();
    return { application, user };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const joinAsDriverService = {
  getMyDriverInfoFromDB,
  getAllDrivers,
  updateDriverStatus,
  suspendDriver,
  unsuspendDriver,
  getSingleDriver,
  deleteDriver,
  registerDriverUnified,
  updateMyProfileInDB,
  approveDriverApplication,
};
