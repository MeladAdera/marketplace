// src/types/express.d.ts
import 'express';
import { TFunction } from 'i18next';

declare global {
  namespace Express {
    interface Request {
      t: TFunction;
    }
  }
}