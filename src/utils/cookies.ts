import { Response } from "express";

const COOKIE_NAME = "session_token";

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
  });
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}