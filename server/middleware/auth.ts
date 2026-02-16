import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";
import type { AuthenticatedRequest } from "../types";

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    if (!decoded.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
