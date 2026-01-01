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
  caseQuantity: number;
  unitsPerCase: number;
  baseCasePrice: number;
  sellingCasePrice: number;
  discountPercent?: number;
  isActive?: boolean;
}

export interface IPalletItem {
  productId: Types.ObjectId;
  caseQuantity: number;
}

export interface IWholesalePallet {
  palletName: string;
  items: IPalletItem[];
  totalCases: number;
  palletPrice: number;
  estimatedWeight?: number;
  isMixed: boolean;
  isActive?: boolean;
}

export interface IWholesale {
  type: "case" | "pallet" | "fastMoving";
  caseItems?: IWholesaleCaseItem[];
  palletItems?: IWholesalePallet[];
  fastMovingItems?: [
    {
      productId: Types.ObjectId;
    }
  ];
  isActive?: boolean;
}
