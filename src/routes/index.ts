//src/routes/index.ts
import { Router } from "express";
import authRoutes from "./auth.routes";
import vendorRoutes from "./vendor.routes";
import publicRoutes from "./public.routes";
import cartRoutes from "./cart.routes";

const router = Router();

// Mount auth routes
router.use("/auth", authRoutes);
router.use("/vendors", vendorRoutes);
router.use("/products", publicRoutes); 
router.use("/cart", cartRoutes);


export default router;