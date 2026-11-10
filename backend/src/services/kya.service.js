import crypto from 'node:crypto';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { getProvider } from './ai/index.js';
import { isDepositMet } from './wallet.service.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

/**
 * Know Your Agent (KYA), minimal version.
 *
 * 1. Identity: every agent has an Ed25519 key pair. The public key is its identity, the private key is
 *    stored encrypted and only used server side to sign.
 * 2. Ownership: the agent row links to exactly one owning user.
 * 3. Verification: an agent is "verified" when it is active, its key pair works, and its owner has put
 *    the damage deposit in the wallet. Only verified agents may spend money.
 * 4. Attestation: each agent action is signed over {agent, owner, action, args hash, decision, level, time}
 *    and stored in the audit log, so a dispute reviewer can check who acted, for whom, and under which grant.
 *    The payload carries a snapshot of the permissions (autonomy level, overrides, spend limit) at that time.
 *
 * Limits: keys live on our server (the platform signs for the agent, so this proves what the platform
 * recorded, not that a third party holds the key); no key rotation or revocation list; one agent per user;
 * the audit log is not append-only at database level; no external agent registry or attestation.
 */

// ---------- pure helpers (unit tested) ----------

function aesKey(secret) {
  return crypto.scryptSync(secret, 'kya-agent-key', 32);
}

export function encryptSecret(plain, secret = config.kya.keySecret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey(secret), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decryptSecret(packed, secret = config.kya.keySecret) {
  const [iv, tag, data] = packed.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function generateIdentity(secret = config.kya.keySecret) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKeyEnc: encryptSecret(privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'), secret),
  };
}

/** Stable JSON: keys sorted, so the same data always signs to the same bytes. */
export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function hashArgs(args) {
  return crypto.createHash('sha256').update(canonicalize(args ?? {})).digest('hex');
}

export function buildAttestation({ agentId, ownerId, action, args, decision, level, grants, at = new Date() }) {
  const payload = { agentId, ownerId, action, argsHash: hashArgs(args), decision, level, at: at.toISOString() };
  // Permission snapshot: what the owner had granted at the moment of the action
  if (grants) payload.grants = grants;
  return payload;
}

export function signAttestation(privateKeyEnc, payload, secret = config.kya.keySecret) {
  const key = crypto.createPrivateKey({
    key: Buffer.from(decryptSecret(privateKeyEnc, secret), 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  return crypto.sign(null, Buffer.from(canonicalize(payload)), key).toString('base64');
}

export function verifyAttestation(publicKey, payload, signature) {
  try {
    const key = crypto.createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(canonicalize(payload)), key, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}

// ---------- persistence ----------

export const kyaService = {
  /**
   * Register (or fetch) the one active agent of a user, creating its key pair on first use.
   */
  async registerAgent(userId) {
    const existing = await prisma.agent.findFirst({ where: { userId, status: 'active' } });
    const provider = getProvider();

    if (existing?.publicKey && existing.privateKeyEnc) {
      // Keep the recorded provider and model in step with config (AI_PROVIDER may have changed)
      if (existing.provider !== provider.name || existing.model !== provider.model) {
        return prisma.agent.update({
          where: { id: existing.id },
          data: { provider: provider.name, model: provider.model },
        });
      }
      return existing;
    }

    const identity = generateIdentity();

    if (existing) {
      // Agent created before KYA existed: give it an identity
      return prisma.agent.update({
        where: { id: existing.id },
        data: { ...identity, provider: provider.name, model: provider.model },
      });
    }

    return prisma.agent.create({
      data: {
        userId,
        name: 'Charging Concierge',
        provider: provider.name,
        model: provider.model,
        autonomyLevel: config.agent.defaultLevel,
        spendingLimit: config.agent.defaultSpendingLimit,
        ...identity,
      },
    });
  },

  /**
   * Check an agent right now. Returns { verified, checks } and stamps kyaVerifiedAt on success.
   */
  async verifyAgent(agent) {
    const owner = await prisma.user.findUnique({
      where: { id: agent.userId },
      select: { id: true, walletBalance: true, walletHeld: true },
    });

    const probe = { probe: 'kya-self-test' };
    let keyWorks = false;
    if (agent.publicKey && agent.privateKeyEnc) {
      try {
        keyWorks = verifyAttestation(agent.publicKey, probe, signAttestation(agent.privateKeyEnc, probe));
      } catch {
        keyWorks = false;
      }
    }

    const checks = {
      active: agent.status === 'active',
      ownerLinked: !!owner,
      keyPairValid: keyWorks,
      ownerDepositMet: !!owner && isDepositMet(owner.walletBalance, owner.walletHeld),
    };
    const verified = Object.values(checks).every(Boolean);

    if (verified) {
      await prisma.agent.update({ where: { id: agent.id }, data: { kyaVerifiedAt: new Date() } });
    }
    return { verified, checks };
  },

  /**
   * Public identity card for the UI. Never includes the private key.
   */
  async getAgentCard(userId) {
    const agent = await this.registerAgent(userId);
    const { verified, checks } = await this.verifyAgent(agent);
    return {
      agentId: agent.id,
      ownerId: agent.userId,
      name: agent.name,
      provider: agent.provider,
      model: agent.model,
      status: agent.status,
      publicKey: agent.publicKey,
      kyaVerified: verified,
      checks,
      autonomyLevel: agent.autonomyLevel,
    };
  },

  /**
   * Sign an action and return the fields to store in the audit log.
   */
  attest(agent, { action, args, decision, level }) {
    const grants = {
      autonomyLevel: agent.autonomyLevel,
      permissions: agent.permissions ?? {},
      spendingLimit: Number(agent.spendingLimit),
    };
    const payload = buildAttestation({ agentId: agent.id, ownerId: agent.userId, action, args, decision, level, grants });
    return { kyaPayload: payload, kyaSignature: signAttestation(agent.privateKeyEnc, payload) };
  },

  /**
   * Verify one stored audit record against the agent's public key (used by the activity feed).
   */
  async verifyAuditRecord(record) {
    if (!record.kyaPayload || !record.kyaSignature || !record.agentId) return false;
    const agent = await prisma.agent.findUnique({ where: { id: record.agentId }, select: { publicKey: true, userId: true } });
    if (!agent?.publicKey) return false;
    // The payload must also name this agent and its owner, not just carry a valid signature
    return (
      record.kyaPayload.agentId === record.agentId &&
      record.kyaPayload.ownerId === agent.userId &&
      verifyAttestation(agent.publicKey, record.kyaPayload, record.kyaSignature)
    );
  },

  /**
   * Guard used before any agent action: the agent must belong to the acting user and be active.
   */
  async assertAgentOwnedBy(agentId, userId) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundError('Agent');
    if (agent.userId !== userId) throw new ForbiddenError('This agent does not belong to you');
    if (agent.status !== 'active') throw new ForbiddenError(`Agent is ${agent.status}`);
    return agent;
  },
};

export default kyaService;
