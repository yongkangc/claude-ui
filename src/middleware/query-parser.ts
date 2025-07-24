import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to parse and convert query parameters to their proper types
 * 
 * This middleware automatically converts:
 * - Numeric strings to numbers
 * - Boolean strings ('true', 'false') to booleans
 * - Preserves other types as-is
 */
export function queryParser(req: Request, res: Response, next: NextFunction): void {
  if (!req.query || typeof req.query !== 'object') {
    return next();
  }

  // Create a new object to store converted values
  const convertedQuery: Record<string, any> = {};

  for (const [key, value] of Object.entries(req.query)) {
    // Handle array values (e.g., ?key=1&key=2)
    if (Array.isArray(value)) {
      convertedQuery[key] = value.map(v => convertValue(v));
    } else {
      convertedQuery[key] = convertValue(value);
    }
  }

  // Replace the original query with converted values
  req.query = convertedQuery;
  next();
}

/**
 * Convert a single value to its appropriate type
 */
function convertValue(value: any): any {
  // If not a string, return as-is
  if (typeof value !== 'string') {
    return value;
  }

  // Empty string remains empty string
  if (value === '') {
    return value;
  }

  // Boolean conversion
  if (value.toLowerCase() === 'true') {
    return true;
  }
  if (value.toLowerCase() === 'false') {
    return false;
  }

  // Number conversion
  // Check if it's a valid number (including decimals)
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const num = Number(value);
    // Ensure the conversion didn't produce NaN or Infinity
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }

  // Return original string if no conversion applied
  return value;
}