export const companyName = "Vendo Pos";



export const regionMap: Record<string, string> = {
  "east africa": "Eastern Africa",
  "west africa": "Western Africa",
  "north africa": "Northern Africa",
  "southern africa": "Southern Africa",
  "central africa": "Middle Africa",
  africa: "Africa",
  "southern asia": "Southern Asia",
  "southeast asia": "Southeast Asia",
  "eastern asia": "Eastern Asia",
  "western asia": "Western Asia",
  asia: "Asia",
  "northern europe": "Northern Europe",
  "southern europe": "Southern Europe",
  "eastern europe": "Eastern Europe",
  "western europe": "Western Europe",
  europe: "Europe",
  "north america": "Americas",
  "south america": "Americas",
  caribbean: "Caribbean",
  "central america": "Central America",
  americas: "Americas",
  "australia and new zealand": "Australia and New Zealand",
  melanesia: "Melanesia",
  micronesia: "Micronesia",
  polynesia: "Polynesia",
  oceania: "Oceania",
  antarctica: "Antarctica",
};



export interface IGetWholesaleParams {
  type?: string;
  page?: number;
  limit?: number;
}


import { Types } from "mongoose";


export interface IWholesalePopulated {
  _id: Types.ObjectId;
  type: "case" | "pallet";
  caseItems?: {
    productId: Types.ObjectId;
    quantity: number;
    price: number;
    discount?: number;
  }[];
  palletItems?: {
    palletName: string;
    items: {
      productId: Types.ObjectId;
      caseQuantity: number;
    }[];
    totalCases: number;
    price: number;
  }[];
}
