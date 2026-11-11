import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { chargerService } from '../services/charger.service.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';
import { successResponse, paginatedResponse } from '../utils/apiResponse.js';
import { createAuditLog, AuditActions } from '../services/audit.service.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();

// ===========================================
// PHOTO UPLOAD (local disk storage)
// ===========================================

export const UPLOAD_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
const CHARGER_PHOTO_DIR = path.join(UPLOAD_ROOT, 'chargers');
fs.mkdirSync(CHARGER_PHOTO_DIR, { recursive: true });

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const PHOTO_EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: CHARGER_PHOTO_DIR,
    // Random name; extension comes from the checked mime type, never the client filename
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${PHOTO_EXTENSIONS[file.mimetype]}`),
  }),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS },
  fileFilter: (req, file, cb) => {
    if (PHOTO_EXTENSIONS[file.mimetype]) return cb(null, true);
    cb(new ValidationError('Only JPG, PNG or WebP images are allowed'));
  },
}).array('photos', MAX_PHOTOS);

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const searchChargersSchema = z.object({
  lat: z.string().transform(Number).optional(),
  lng: z.string().transform(Number).optional(),
  radius: z.string().transform(Number).optional().default('10'),
  connector: z.enum(['Type2', 'CCS2', 'CHAdeMO', 'Type1', 'GBT']).optional(),
  minKw: z.string().transform(Number).optional(),
  maxPrice: z.string().transform(Number).optional(),
  availableFrom: z.string().optional(),
  availableTo: z.string().optional(),
  page: z.string().transform(Number).optional().default('1'),
  limit: z.string().transform(Number).optional().default('20'),
});

const createChargerSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  address: z.string().min(10, 'Address must be at least 10 characters'),
  city: z.string().optional().default('Bengaluru'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  connectorType: z.enum(['Type2', 'CCS2', 'CHAdeMO', 'Type1', 'GBT']),
  kwTier: z.enum(['kW3_3', 'kW7_4', 'kW11', 'kW22', 'kW50', 'kW150']),
  amenities: z.array(z.string()).optional().default([]),
  photos: z.array(z.string().url()).max(5, 'Up to 5 photos allowed').optional().default([]),
  packages: z.array(z.object({
    name: z.string().min(1),
    durationMin: z.number().min(15).max(720), // 15 min to 12 hours
    price: z.number().min(0),
    currency: z.string().optional().default('USD'),
  })).min(1, 'At least one package is required'),
  availability: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isAvailable: z.boolean().optional().default(true),
  })).optional(),
});

const updateChargerSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional().nullable(),
  address: z.string().min(10).optional(),
  amenities: z.array(z.string()).optional(),
  photos: z.array(z.string().url()).max(5, 'Up to 5 photos allowed').optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
});

const updatePackagesSchema = z.object({
  packages: z.array(z.object({
    name: z.string().min(1),
    durationMin: z.number().min(15).max(720),
    price: z.number().min(0),
    currency: z.string().optional().default('USD'),
    isActive: z.boolean().optional().default(true),
  })).min(1),
});

const updateAvailabilitySchema = z.object({
  availability: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isAvailable: z.boolean().optional().default(true),
  })),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/chargers
 * Search chargers with filters
 */
router.get('/', optionalAuth, validateQuery(searchChargersSchema), async (req, res, next) => {
  try {
    const result = await chargerService.searchChargers({
      latitude: req.query.lat,
      longitude: req.query.lng,
      radius: req.query.radius,
      connectorType: req.query.connector,
      minKw: req.query.minKw,
      maxPrice: req.query.maxPrice,
      availableFrom: req.query.availableFrom,
      availableTo: req.query.availableTo,
      page: req.query.page,
      limit: req.query.limit,
    });

    paginatedResponse(res, result.chargers, result.pagination);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chargers/my
 * Get host's own chargers
 */
router.get('/my', authenticate, requireRole('host'), async (req, res, next) => {
  try {
    const chargers = await chargerService.getHostChargers(req.user.id);
    successResponse(res, { chargers });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chargers/:id
 * Get charger by ID
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const charger = await chargerService.getChargerById(
      req.params.id,
      req.user?.id
    );
    successResponse(res, { charger });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chargers/photos
 * Upload up to 5 charger photos (multipart field "photos"). Returns public URLs.
 */
router.post('/photos', authenticate, requireRole('host'), (req, res, next) => {
  photoUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
          ? 'Each photo must be 5 MB or smaller'
          : `You can upload up to ${MAX_PHOTOS} photos`;
        return next(new ValidationError(message));
      }
      return next(err);
    }
    if (!req.files?.length) {
      return next(new ValidationError('No photos uploaded'));
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    successResponse(res, {
      photos: req.files.map(f => `${baseUrl}/uploads/chargers/${f.filename}`),
    }, 201);
  });
});

/**
 * POST /api/chargers
 * Create a new charger listing
 */
router.post('/', authenticate, requireRole('host'), validateBody(createChargerSchema), async (req, res, next) => {
  try {
    const result = await chargerService.createCharger(req.user.id, req.body);

    // Audit log for charger creation
    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.CHARGER_CREATE,
      resource: 'charger',
      resourceId: result.charger?.id,
      details: {
        name: req.body.name,
        address: req.body.address,
        connectorType: req.body.connectorType,
        kwTier: req.body.kwTier,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/chargers/:id
 * Update charger details
 */
router.put('/:id', authenticate, requireRole('host'), validateBody(updateChargerSchema), async (req, res, next) => {
  try {
    const charger = await chargerService.updateCharger(
      req.params.id,
      req.user.id,
      req.body
    );

    // Audit log for charger update
    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.CHARGER_UPDATE,
      resource: 'charger',
      resourceId: req.params.id,
      details: { updatedFields: Object.keys(req.body) },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, { charger });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/chargers/:id/packages
 * Update charger packages
 */
router.put('/:id/packages', authenticate, requireRole('host'), validateBody(updatePackagesSchema), async (req, res, next) => {
  try {
    const packages = await chargerService.updatePackages(
      req.params.id,
      req.user.id,
      req.body.packages
    );
    successResponse(res, { packages });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/chargers/:id/availability
 * Update charger availability
 */
router.put('/:id/availability', authenticate, requireRole('host'), validateBody(updateAvailabilitySchema), async (req, res, next) => {
  try {
    const availability = await chargerService.updateAvailability(
      req.params.id,
      req.user.id,
      req.body.availability
    );
    successResponse(res, { availability });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/chargers/:id
 * Delete a charger
 */
router.delete('/:id', authenticate, requireRole('host'), async (req, res, next) => {
  try {
    await chargerService.deleteCharger(req.params.id, req.user.id);

    // Audit log for charger deletion
    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.CHARGER_DELETE,
      resource: 'charger',
      resourceId: req.params.id,
      details: {},
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, { message: 'Charger deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
