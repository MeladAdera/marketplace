//src/routes/auth.routes.ts
import { Router } from "express";
import { loginController, logoutController, signupController } from "../controllers/auth.controller";
import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware";

const router = Router();


router.post("/login", loginController);
router.post("/signup", signupController);
router.post("/logout", logoutController);


router.get("/me", authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

export default router;