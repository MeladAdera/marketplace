//src/routes/index.ts
import { Router } from "express";
import authRoutes from "./auth.routes";
import vendorRoutes from "./vendor.routes";
import publicRoutes from "./public.routes";
import cartRoutes from "./cart.routes";
import orderRoutes from "./order.routes";
import ordervendorRoutes from "./vendor/order.routes"
import adminRoutes from "./vendor/admin.routes"
import platformAdminRoutes from "./platform-admin.routes";


const router = Router();

// Mount auth routes
router.use("/auth", authRoutes);
router.use("/vendors", vendorRoutes);
router.use("/products", publicRoutes); 
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes); 
router.use("/vendor",ordervendorRoutes);   
router.use("/vendor",adminRoutes);        
router.use("/platform/admin", platformAdminRoutes);






export default router;