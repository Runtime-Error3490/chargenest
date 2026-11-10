import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.js';
import { AuthError, ValidationError, ConflictError } from '../utils/errors.js';

const SALT_ROUNDS = 10;

/**
 * Encrypt TOTP secret for storage
 */
function encryptTotpSecret(secret) {
  const key = crypto.scryptSync(config.totp.encryptionKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt TOTP secret from storage
 */
function decryptTotpSecret(encrypted) {
  const key = crypto.scryptSync(config.totp.encryptionKey, 'salt', 32);
  const [ivHex, encryptedData] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generate JWT access token
 */
function generateAccessToken(user, roles) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: roles,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiry }
  );
}

/**
 * Generate JWT refresh token
 */
function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
    },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry }
  );
}

/**
 * Generate temporary token for MFA step
 */
function generateTempToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      type: 'temp_mfa',
    },
    config.jwt.secret,
    { expiresIn: '5m' }
  );
}

export const authService = {
  // Current terms and privacy policy versions
  CURRENT_TERMS_VERSION: '1.0',
  CURRENT_PRIVACY_VERSION: '1.0',

  /**
   * Register a new user
   */
  async register({ email, password, name, phone, roles = ['driver'], acceptTerms, acceptPrivacy }) {
    // Verify terms acceptance
    if (!acceptTerms || !acceptPrivacy) {
      throw new ValidationError('You must accept the Terms and Conditions and Privacy Policy to register');
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('USER_ALREADY_EXISTS', 'User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate TOTP secret
    const totpSecret = speakeasy.generateSecret({
      name: `${config.totp.issuer}:${email}`,
      issuer: config.totp.issuer,
    });

    // Encrypt and store
    const encryptedSecret = encryptTotpSecret(totpSecret.base32);

    // Create user with roles and terms acceptance
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone,
        totpSecret: encryptedSecret,
        totpEnabled: false, // Enable after first verification
        // Terms & conditions acceptance
        termsAccepted: true,
        termsAcceptedAt: new Date(),
        termsVersion: this.CURRENT_TERMS_VERSION,
        privacyAccepted: true,
        privacyAcceptedAt: new Date(),
        privacyVersion: this.CURRENT_PRIVACY_VERSION,
        roles: {
          create: roles.map(role => ({ role })),
        },
      },
      include: {
        roles: true,
      },
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(totpSecret.otpauth_url);

    return {
      userId: user.id,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles.map(r => r.role),
      },
      mfaSetupRequired: true,
      mfaQrCode: qrCodeUrl,
      mfaSecret: totpSecret.base32, // Show once for manual entry
      // Next step after signup: fund the wallet via PayPal. Booking and listing stay blocked until then.
      deposit: {
        required: true,
        minBalance: config.wallet.minBalance,
        deposit: config.wallet.deposit,
        currency: config.platform.defaultCurrency,
        topUpUrl: '/api/payments/wallet/topup',
      },
    };
  },

  /**
   * Login step 1 - verify credentials
   */
  async login({ email, password }) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (!user) {
      throw new AuthError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new AuthError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // If TOTP is enabled, require MFA
    if (user.totpEnabled) {
      const tempToken = generateTempToken(user);
      return {
        tempToken,
        mfaRequired: true,
      };
    }

    // If TOTP not yet enabled, still require setup verification
    if (user.totpSecret) {
      const tempToken = generateTempToken(user);
      return {
        tempToken,
        mfaRequired: true,
        mfaSetupPending: true,
      };
    }

    // No MFA configured (shouldn't happen with new users)
    const roles = user.roles.map(r => r.role);
    const accessToken = generateAccessToken(user, roles);
    const refreshToken = generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400, // 24 hours
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
      },
    };
  },

  /**
   * Login step 2 - verify TOTP code
   */
  async verifyMfa({ tempToken, totpCode }) {
    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, config.jwt.secret);
      if (decoded.type !== 'temp_mfa') {
        throw new Error('Invalid token type');
      }
    } catch (error) {
      throw new AuthError('AUTH_TOKEN_INVALID', 'Invalid or expired verification token');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { roles: true },
    });

    if (!user || !user.totpSecret) {
      throw new AuthError('AUTH_MFA_INVALID', 'MFA not configured for this user');
    }

    // Decrypt TOTP secret
    const secret = decryptTotpSecret(user.totpSecret);

    // Verify TOTP code
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: totpCode,
      window: 1, // Allow 1 step tolerance
    });

    if (!verified) {
      throw new AuthError('AUTH_MFA_INVALID', 'Invalid verification code');
    }

    // If first time verification, enable TOTP
    if (!user.totpEnabled) {
      await prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: true },
      });
    }

    // Generate tokens
    const roles = user.roles.map(r => r.role);
    const accessToken = generateAccessToken(user, roles);
    const refreshToken = generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
      },
    };
  },

  /**
   * Refresh access token
   */
  async refreshToken({ refreshToken }) {
    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
    } catch (error) {
      throw new AuthError('AUTH_TOKEN_INVALID', 'Invalid refresh token');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { roles: true },
    });

    if (!user) {
      throw new AuthError('AUTH_UNAUTHORIZED', 'User not found');
    }

    // Generate new access token
    const roles = user.roles.map(r => r.role);
    const accessToken = generateAccessToken(user, roles);

    return {
      accessToken,
      expiresIn: 86400,
    };
  },

  /**
   * Get MFA setup info (QR code) for existing user
   */
  async getMfaSetup(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuthError('AUTH_UNAUTHORIZED', 'User not found');
    }

    if (!user.totpSecret) {
      // Generate new secret
      const totpSecret = speakeasy.generateSecret({
        name: `${config.totp.issuer}:${user.email}`,
        issuer: config.totp.issuer,
      });

      const encryptedSecret = encryptTotpSecret(totpSecret.base32);

      await prisma.user.update({
        where: { id: userId },
        data: { totpSecret: encryptedSecret },
      });

      const qrCodeUrl = await QRCode.toDataURL(totpSecret.otpauth_url);

      return {
        qrCode: qrCodeUrl,
        secret: totpSecret.base32,
        alreadyEnabled: false,
      };
    }

    if (user.totpEnabled) {
      return {
        alreadyEnabled: true,
      };
    }

    // Regenerate QR code from existing secret
    const secret = decryptTotpSecret(user.totpSecret);
    const otpauthUrl = speakeasy.otpauthURL({
      secret,
      label: user.email,
      issuer: config.totp.issuer,
      encoding: 'base32',
    });
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    return {
      qrCode: qrCodeUrl,
      secret,
      alreadyEnabled: false,
    };
  },

  /**
   * Change password
   */
  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuthError('AUTH_UNAUTHORIZED', 'User not found');
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      throw new AuthError('AUTH_INVALID_CREDENTIALS', 'Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true };
  },
};

export default authService;
