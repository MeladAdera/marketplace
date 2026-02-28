import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";

type SchemaInput =
  | AnyZodObject
  | {
      body?: AnyZodObject;
      params?: AnyZodObject;
      query?: AnyZodObject;
    };

export const validate = (schema: SchemaInput) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if ("parseAsync" in schema) {
  await schema.parseAsync({
    body: req.body,
    query: req.query,
    params: req.params,
    cookies: req.cookies ?? {},   
    headers: req.headers ?? {},  
  });
      } else {
        if (schema.body) {
          req.body = await schema.body.parseAsync(req.body);
        }

        if (schema.params) {
          req.params = await schema.params.parseAsync(req.params);
        }

        if (schema.query) {
          req.query = await schema.query.parseAsync(req.query);
        }
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: error.errors,
          },
        });
        return;
      }

      next(error);
    }
  };
};