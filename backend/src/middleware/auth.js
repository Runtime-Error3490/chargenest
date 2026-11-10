import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.js';
import { AuthError, ForbiddenError } from '../utils/errors.js';

/**
 * Verify JWT token and attach user to request
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('AUTH_UNAUTHORIZED', 'No token provided');
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Get user with roles
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        roles: true,
      },
    });

    if (!user) {
      throw new AuthError('AUTH_UNAUTHORIZED', 'User not found');
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map(r => r.role),
      totpEnabled: user.totpEnabled,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AuthError('AUTH_TOKEN_INVALID', 'Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AuthError('AUTH_TOKEN_EXPIRED', 'Token has expired'));
    }
    next(error);
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        roles: true,
      },
    });

    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles.map(r => r.role),
        totpEnabled: user.totpEnabled,
      };
    }

    next();
  } catch (error) {
    // Ignore token errors for optional auth
    next();
  }
}

/**
 * Check if user has required role(s)
 * @param {string|string[]} roles - Required role(s)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthError('AUTH_UNAUTHORIZED', 'Authentication required'));
    }

    const userRoles = req.user.roles;
    const hasRole = roles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return next(new ForbiddenError(`Requires one of these roles: ${roles.join(', ')}`));
    }

    next();
  };
}

/**
 * Check if user owns the resource or is admin
 * @param {Function} getOwnerId - Function to extract owner ID from request
 */
export function requireOwnership(getOwnerId) {
  return async (req, res, next) => {
    if (!req.user) {
      return next(new AuthError('AUTH_UNAUTHORIZED', 'Authentication required'));
    }

    // Admins can access anything
    if (req.user.roles.includes('admin')) {
      return next();
    }

    try {
      const ownerId = await getOwnerId(req);
      
      if (ownerId !== req.user.id) {
        return next(new ForbiddenError('You do not have access to this resource'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
