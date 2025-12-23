import { z } from "zod";

const joinAsSupplierValidation = z.object({
  body: z.object({
    shopName: z.string({
      required_error: "Shop name is required",
    }),
    brandName: z.string({
      required_error: "Brand name is required",
    }),
    shopSlug: z.string({
      required_error: "Shop slug is required",
    }),
    description: z.string({
      required_error: "Description is required",
    }),
    phone: z.string({
      required_error: "Phone number is required",
    }),
    email: z.string({
      required_error: "Email is required",
    }),
    warehouseLocation: z.string({
      required_error: "Warehouse location is required",
    }),
    address: z.string({
      required_error: "Address is required",
    }),
    city: z.string({
      required_error: "City is required",
    }),
    state: z.string({
      required_error: "State is required",
    }),
    zipCode: z.string({
      required_error: "Zip code is required",
    }),
    documentUrl: z.object({
      public_id: z.string({
        required_error: "Document public_id is required",
      }),
      url: z.string({
        required_error: "Document url is required",
      }),
    }),
  }),
});

const joinAsSupplierValidationSchema = {
  joinAsSupplierValidation,
};

export default joinAsSupplierValidationSchema;
