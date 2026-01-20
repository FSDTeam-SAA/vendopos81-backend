import { Types } from "mongoose";

// export interface IWholeSaleProduct {
//   productId: Types.ObjectId;
//   categoryType: "case" | "pallet" | "fastMoving";
//   quantity?: number;
//   setPrice?: number;
//   customPrice?: number;
//   discount?: number;
//   isActive?: boolean;
// }

// export interface IWholeSale {
//   products: IWholeSaleProduct[];
//   isActive?: boolean;
// }

export interface IWholesaleCaseItem {
  productId: Types.ObjectId;
  quantity: number;
  price: number;
  discount?: number;
  isActive?: boolean;
}

export interface IPalletItem {
  productId: Types.ObjectId;
  // caseQuantity: number;
}

export interface IWholesalePallet {
  palletName: string;
  items: IPalletItem[];
  totalCases: number;
  price: number;
  estimatedWeight?: number;
  discount?: number;
  isMixed: boolean;
  isActive?: boolean;
}

export interface IFastMovingItem {
  productId: Types.ObjectId;
}

export interface IWholesale {
  type: "case" | "pallet" | "fastMoving";
  label: string;
  caseItems?: IWholesaleCaseItem[];
  palletItems?: IWholesalePallet[];
  fastMovingItems?: IFastMovingItem[];
  isActive?: boolean;
}
