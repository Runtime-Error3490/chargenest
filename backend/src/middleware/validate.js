import { ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * Middleware to validate request body against a Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 */
export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return next(new ValidationError('Validation failed', details));
      }
      next(error);
    }
  };
}

/**
 * Middleware to validate request query params against a Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return next(new ValidationError('Invalid query parameters', details));
      }
      next(error);
    }
  };
}

/**
 * Middleware to validate request params against a Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 */
export function validateParams(schema) {
  return (req, res, next) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return next(new ValidationError('Invalid path parameters', details));
      }
      next(error);
    }
  };
}
