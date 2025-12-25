import { z } from 'zod';

const createDriverValidationSchema = z.object({
  body: z.object({
    firstName: z.string({ required_error: 'First name is required' }),
    lastName: z.string({ required_error: 'Last name is required' }),
    phoneNumber: z.string({ required_error: 'Phone number is required' }),
    email: z.string().email('Invalid email address'),
    yearsOfExperience: z.preprocess((val) => Number(val), z.number().min(0)),
    licenseExpiryDate: z.string({ required_error: 'License expiry date is required' }),
    streetAddress: z.string({ required_error: 'Street address is required' }),
    city: z.string({ required_error: 'City is required' }),
    state: z.string({ required_error: 'State is required' }),
    zipCode: z.string({ required_error: 'Zip code is required' }),
    documents: z.array(z.string()).optional(),
  }),
});

export const DriverValidation = {
  createDriverValidationSchema,
};