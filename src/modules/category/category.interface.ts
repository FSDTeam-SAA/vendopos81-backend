export interface IImage {
  public_id: string;
  url: string;
}

export interface IProductCategory {
  productType: string;
  productName: string[];
  productImage: IImage;
}

export interface ICategory {
  region: string;
  categories: IProductCategory[];
  productImage?: {
    public_id?: string;
    url?: string;
  };
  regionImage?: {
    public_id?: string;
    url?: string;
  };
  country?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
