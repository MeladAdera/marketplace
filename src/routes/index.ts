//src/routes/index.ts
import { Router } from "express";
import authRoutes from "./auth.routes";
import vendorRoutes from "./vendor.routes";

const router = Router();

// Mount auth routes
router.use("/auth", authRoutes);
router.use("/vendors", vendorRoutes); 


export default router;