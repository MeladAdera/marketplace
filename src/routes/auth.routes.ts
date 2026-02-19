import { Router } from "express";
import {
  loginController,
  logoutController,
  signupController,
  refreshController,
} from "../controllers/auth.controller";
import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware";

const router = Router();

router.post("/login", loginController);
router.post("/signup", signupController);
router.post("/logout", logoutController);

// ✅ new
router.post("/refresh", refreshController);

router.get("/me", authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

export default router;
