const mongoose = require('mongoose');

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = {
      message,
      statusCode: 404
    };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `${field} '${value}' already exists`;
    error = {
      message,
      statusCode: 400
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      message,
      statusCode: 400
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = {
      message,
      statusCode: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = {
      message,
      statusCode: 401
    };
  }

  // Mongoose connection error
  if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    const message = 'Database connection error';
    error = {
      message,
      statusCode: 503
    };
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File size too large';
    error = {
      message,
      statusCode: 400
    };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const message = 'Too many files uploaded';
    error = {
      message,
      statusCode: 400
    };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = {
      message,
      statusCode: 400
    };
  }

  // Custom application errors
  if (err.isOperational) {
    error = {
      message: err.message,
      statusCode: err.statusCode || 500
    };
  }

  // Default error response
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err
    }),
    ...(process.env.NODE_ENV === 'development' && {
      details: {
        name: err.name,
        code: err.code,
        keyValue: err.keyValue,
        errors: err.errors
      }
    })
  });
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// 404 handler
const notFound = (req, res, next) => {
  const error = new AppError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};

// Validation error helper
const validationError = (errors) => {
  const message = errors.map(error => error.msg).join(', ');
  return new AppError(message, 400);
};

// Database error helper
const databaseError = (message = 'Database operation failed') => {
  return new AppError(message, 500);
};

// Authentication error helper
const authenticationError = (message = 'Authentication failed') => {
  return new AppError(message, 401);
};

// Authorization error helper
const authorizationError = (message = 'Access denied') => {
  return new AppError(message, 403);
};

// Not found error helper
const notFoundError = (resource = 'Resource') => {
  return new AppError(`${resource} not found`, 404);
};

// Conflict error helper
const conflictError = (message = 'Resource conflict') => {
  return new AppError(message, 409);
};

// Rate limit error helper
const rateLimitError = (message = 'Too many requests') => {
  return new AppError(message, 429);
};

// Service unavailable error helper
const serviceUnavailableError = (message = 'Service temporarily unavailable') => {
  return new AppError(message, 503);
};

// Request validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(message, 400));
    }
    
    next();
  };
};

// Request query validation middleware
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(message, 400));
    }
    
    next();
  };
};

// Request params validation middleware
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.params);
    
    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(message, 400));
    }
    
    next();
  };
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name
    },
    user: req.user ? {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role
    } : null
  };

  console.error('ERROR LOG:', JSON.stringify(logData, null, 2));
  
  // In production, you might want to send this to a logging service
  // like Winston, Sentry, or CloudWatch
  
  next(err);
};

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  notFound,
  validationError,
  databaseError,
  authenticationError,
  authorizationError,
  notFoundError,
  conflictError,
  rateLimitError,
  serviceUnavailableError,
  validateRequest,
  validateQuery,
  validateParams,
  errorLogger
};
