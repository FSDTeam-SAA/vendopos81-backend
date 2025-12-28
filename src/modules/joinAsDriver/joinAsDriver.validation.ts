
import { z } from 'zod';

export const DriverValidation = {
  registerDriverUnifiedSchema: z.object({
    body: z.object({
      firstName: z.string({ required_error: 'First name is required' }),
      lastName: z.string({ required_error: 'Last name is required' }),
      phone: z.string({ required_error: 'Phone number is required' }),
      email: z.string().email('Invalid email address'),
      password: z.string().min(6).optional(), // Required only for guests (checked in service)
      yearsOfExperience: z.preprocess((val) => Number(val), z.number().min(0)),
      licenseExpiryDate: z.string({ required_error: 'License expiry date is required' }),
      address: z.string({ required_error: 'Street address is required' }),
      city: z.string({ required_error: 'City is required' }),
      state: z.string({ required_error: 'State is required' }),
      zipCode: z.string({ required_error: 'Zip code is required' }),
    }),
  }),
};