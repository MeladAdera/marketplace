// src/controllers/public.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler.middleware";
import { 
  listPublicProductsService, 
  getPublicProductByIdService 
} from "../services/public.product.service";
import { ProductNotFoundError } from "../errors/product.errors";

/**
 * GET /products
 * List all public products (Marketplace mode)
 * Query params: ?page=1&limit=20&vendor=slug&min_price=1000&max_price=5000&search=laptop
 */
export const listProductsController = asyncHandler(async (req: Request, res: Response) => {
  // 1️⃣ Call service (it handles parsing + validation)
  const { products, pagination } = await listPublicProductsService(req.query);

  // 2️⃣ Return standardized response
  return res.status(200).json({
    success: true,
    data: {
      products,
      pagination,
    },
  });
});

/**
 * GET /products/:id
 * Get single product details with variants
 */
export const getProductByIdController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as {id:string};

  try {
    // 1️⃣ Call service
    const product = await getPublicProductByIdService(id);

    // 2️⃣ Return standardized response
    return res.status(200).json({
      success: true,
      data: product,
    });

  } catch (error) {
    // 3️⃣ Handle not found (service throws ProductNotFoundError)
    if (error instanceof ProductNotFoundError) {
      return res.status(404).json({
        success: false,
        message: req.t("product.not_found", { ns: "errors" }),
        error: "PRODUCT_NOT_FOUND",
      });
    }
    // Re-throw other errors to be caught by errorHandler middleware
    throw error;
  }
});