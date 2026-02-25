//src/routes/index.ts
import { Router } from "express";
import authRoutes from "./auth.routes";
import vendorRoutes from "./vendor.routes";
import publicRoutes from "./public.routes";

const router = Router();

// Mount auth routes
router.use("/auth", authRoutes);
router.use("/vendors", vendorRoutes);
router.use("/products", publicRoutes);  // ✅ Public catalog at /products



export default router;