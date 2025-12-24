import slugify from "slugify";

const generateShopSlug = (name: string) => {
  return slugify(name, {
    lower: true,
    strict: true, // removes special chars
    trim: true,
  });
};

export default generateShopSlug;