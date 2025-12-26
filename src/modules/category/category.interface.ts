// export type CategoryType =
//   | "REGION"
//   | "PRODUCT_TYPE"
//   | "WHOLESALE"
//   | "STORE_TYPE"
//   | "FILTER_ONLY";

export interface ICategory {
  name: string;
  slug: string;
  subcategories?: string[];
  isActive?: boolean;
}
