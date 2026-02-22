// src/controllers/product.controller.ts

import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { asyncHandler } from "../middlewares/errorHandler.middleware";
import {
  UnauthorizedError,
  ForbiddenError,
  NoOrganizationError
} from "../errors";

import {
  createProductWithVariantsService,
  getVendorProductsService,
  getVendorProductByIdService,
  updateProductService,
  deleteProductService
} from "../services/vendor/product.service"

/**
 * 1️⃣ POST /vendors/products
 */
export const createProductController = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  if (!['vendor_admin', 'vendor_staff'].includes(req.user.role)) {
    throw new ForbiddenError('Insufficient permissions');
  }

  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const result = await createProductWithVariantsService(
    req.user.organization_id,
    req.body,
    req.user.id
  );

  return res.status(201).json({
    success: true,
    message: req.t('created', { ns: 'product' }), 
    data: result
  });
});

/**
 * 2️⃣ GET /vendors/products
 */
export const getVendorProductsController = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  if (!['vendor_admin', 'vendor_staff', 'platform_admin'].includes(req.user.role)) {
    throw new ForbiddenError('Insufficient permissions');
  }

  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const { page, limit, active, search } = req.query;

  const filters = {
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 10,
    active: active === 'true' ? true : active === 'false' ? false : undefined,
    search: search as string
  };

  const result = await getVendorProductsService(
    req.user.organization_id,
    filters
  );

  return res.status(200).json({
    success: true,
    message: req.t('list_retrieved', { ns: 'product' }), 
    data: result
  });
});

/**
 * 3️⃣ GET /vendors/products/:id
 */
export const getVendorProductByIdController = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  if (!['vendor_admin', 'vendor_staff', 'platform_admin'].includes(req.user.role)) {
    throw new ForbiddenError('Insufficient permissions');
  }

  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const id = req.params.id as string;
  
  const result = await getVendorProductByIdService(
    req.user.organization_id,
    id
  );

  return res.status(200).json({
    success: true,
    message: req.t('retrieved', { ns: 'product' }), 
    data: result
  });
});

/**
 * 4️⃣ PATCH /vendors/products/:id
 */
export const updateProductController = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  if (req.user.role !== 'vendor_admin') {
    throw new ForbiddenError('Only vendor admin can update products');
  }

  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const id = req.params.id as string;
  
  const updated = await updateProductService(
    req.user.organization_id,  
    id,                        
    req.body,                   
    req.user.id                 
  );

  return res.status(200).json({
    success: true,
    message: req.t('updated', { ns: 'product' }), 
    data: updated
  });
});

/**
 * 5️⃣ DELETE /vendors/products/:id
 */
export const deleteProductController = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  if (req.user.role !== 'vendor_admin') {
    throw new ForbiddenError('Only vendor admin can delete products');
  }

  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const id = req.params.id as string;

  await deleteProductService(
    req.user.organization_id, 
    id,                       
    req.user.id              
  );

  return res.status(200).json({
    success: true,
    message: req.t('deleted', { ns: 'product' }) 
  });
});