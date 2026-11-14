/**
 * Base Application Error
 * All domain and application-level errors inherit from this class.
 */
export class AppError extends Error {
  public readonly isOperational: boolean;

  constructor(message: string, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Thrown when a requested domain entity is not found.
 */
export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(message);
  }
}

/**
 * Thrown when business validation fails inside the service layer.
 */
export class ValidationError extends AppError {
  constructor(message = "Validation failed.") {
    super(message);
  }
}

/**
 * Thrown when database configuration is missing or invalid.
 */
export class DatabaseConfigurationError extends AppError {
  constructor(
    message = "Database connection is not configured. Please provide a valid DATABASE_URL in your environment."
  ) {
    super(message);
  }
}
