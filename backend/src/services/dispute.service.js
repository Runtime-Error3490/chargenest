import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { aiService } from './ai.service.js';
import { paypalService } from './paypal.service.js';
import { 
  NotFoundError, 
  ValidationError, 
  ConflictError,
  ForbiddenError 
} from '../utils/errors.js';

export const disputeService = {
  /**
   * Raise a dispute
   */
  async raiseDispute(userId, {
    bookingId,
    reason,
    description,
    evidence,
  }) {
    // Get booking with related data
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        charger: { select: { hostId: true } },
        session: true,
        payment: true,
        dispute: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Check if user is part of booking
    const isDriver = booking.driverId === userId;
    const isHost = booking.charger.hostId === userId;

    if (!isDriver && !isHost) {
      throw new ForbiddenError('You are not part of this booking');
    }

    // Check if booking can be disputed
    if (!['completed', 'in_progress'].includes(booking.status)) {
      throw new ValidationError(`Cannot dispute booking with status: ${booking.status}`);
    }

    // Check if already has dispute
    if (booking.dispute) {
      throw new ConflictError('DISPUTE_ALREADY_EXISTS', 'This booking already has a dispute');
    }

    // Check dispute window
    const sessionEndTime = booking.session?.actualEnd || booking.scheduledEnd;
    const hoursAfterSession = (Date.now() - new Date(sessionEndTime).getTime()) / (1000 * 60 * 60);

    if (hoursAfterSession > config.dispute.windowHours) {
      throw new ValidationError(
        `Dispute window has expired. Disputes must be raised within ${config.dispute.windowHours} hours of session end.`
      );
    }

    // Determine role
    const raisedByRole = isDriver ? 'driver' : 'host';

    // Create dispute
    const dispute = await prisma.dispute.create({
      data: {
        bookingId,
        raisedById: userId,
        raisedByRole,
        reason,
        description,
        evidence,
        status: 'open',
      },
    });

    // Update booking status
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'disputed' },
    });

    // Trigger AI analysis
    const analysisResult = await this.analyzeDispute(dispute.id);

    return {
      dispute: {
        id: dispute.id,
        bookingId: dispute.bookingId,
        status: analysisResult.dispute.status,
        aiAnalysis: {
          decision: analysisResult.dispute.aiDecision,
          refundAmount: analysisResult.dispute.aiRefundAmount,
          reasoning: analysisResult.dispute.aiReasoning,
          confidence: analysisResult.dispute.aiConfidence,
        },
        autoResolved: analysisResult.autoResolved,
      },
      message: analysisResult.autoResolved
        ? `Dispute resolved automatically. ${analysisResult.dispute.aiDecision === 'full_refund' ? 'Full refund' : analysisResult.dispute.aiDecision === 'partial_refund' ? 'Partial refund' : 'Payment released to host'} will be processed.`
        : 'Dispute submitted for review. Our team will review and respond within 24 hours.',
    };
  },

  /**
   * Analyze dispute with AI
   */
  async analyzeDispute(disputeId) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        booking: {
          include: {
            charger: true,
            package: true,
            session: true,
            payment: true,
            auditLogs: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundError('Dispute');
    }

    // Prepare data for AI
    const disputeData = {
      booking: {
        id: dispute.booking.id,
        scheduledStart: dispute.booking.scheduledStart,
        scheduledEnd: dispute.booking.scheduledEnd,
        chargerName: dispute.booking.charger.name,
        packageName: dispute.booking.package.name,
        packageDuration: dispute.booking.package.durationMin,
      },
      session: dispute.booking.session ? {
        status: dispute.booking.session.status,
        driverStartConfirm: dispute.booking.session.driverStartConfirm,
        hostStartConfirm: dispute.booking.session.hostStartConfirm,
        actualStart: dispute.booking.session.actualStart,
        actualEnd: dispute.booking.session.actualEnd,
        actualDurationMin: dispute.booking.session.actualDurationMin,
      } : null,
      capturedAmount: dispute.booking.payment?.capturedAmount 
        ? parseFloat(dispute.booking.payment.capturedAmount) 
        : parseFloat(dispute.booking.totalAmount),
      currency: dispute.booking.currency,
      reason: dispute.reason,
      description: dispute.description,
      driverStatement: dispute.raisedByRole === 'driver' ? dispute.description : null,
      hostStatement: dispute.raisedByRole === 'host' ? dispute.description : null,
      auditTrail: dispute.booking.auditLogs.length > 0 
        ? dispute.booking.auditLogs.map(l => ({
            action: l.action,
            inputs: l.inputs,
            success: l.success,
            timestamp: l.createdAt,
          }))
        : null,
    };

    // Call AI
    const analysis = await aiService.analyzeDispute(disputeData);

    // Update dispute with AI analysis
    let updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        aiDecision: analysis.decision,
        aiRefundAmount: analysis.refund_amount,
        aiReasoning: analysis.reasoning,
        aiConfidence: analysis.confidence,
        aiReviewedAt: new Date(),
        status: 'ai_reviewed',
      },
    });

    // Auto-resolve if confidence is high enough
    let autoResolved = false;
    if (analysis.confidence >= config.ai.disputeConfidenceThreshold) {
      await this.resolveDispute(disputeId, null, {
        decision: analysis.decision,
        refundAmount: analysis.refund_amount,
        adminNotes: 'Auto-resolved by AI with high confidence',
      });
      autoResolved = true;

      updatedDispute = await prisma.dispute.findUnique({
        where: { id: disputeId },
      });
    } else {
      // Queue for admin review
      await prisma.dispute.update({
        where: { id: disputeId },
        data: { status: 'pending_admin' },
      });

      updatedDispute = await prisma.dispute.findUnique({
        where: { id: disputeId },
      });
    }

    return {
      dispute: {
        id: updatedDispute.id,
        status: updatedDispute.status,
        aiDecision: updatedDispute.aiDecision,
        aiRefundAmount: updatedDispute.aiRefundAmount ? parseFloat(updatedDispute.aiRefundAmount) : null,
        aiReasoning: updatedDispute.aiReasoning,
        aiConfidence: updatedDispute.aiConfidence ? parseFloat(updatedDispute.aiConfidence) : null,
      },
      autoResolved,
    };
  },

  /**
   * Resolve a dispute (admin or auto)
   */
  async resolveDispute(disputeId, adminId, {
    decision,
    refundAmount,
    adminNotes,
  }) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        booking: {
          include: {
            payment: true,
            charger: {
              select: { host: { select: { paypalEmail: true } } },
            },
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundError('Dispute');
    }

    const payment = dispute.booking.payment;
    const capturedAmount = payment?.capturedAmount ? parseFloat(payment.capturedAmount) : 0;

    // Process refund if needed
    if (decision !== 'release_to_host' && refundAmount > 0 && payment?.paypalCaptureId) {
      await paypalService.refundCapture(
        payment.paypalCaptureId,
        refundAmount,
        dispute.booking.currency
      );

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmount: refundAmount,
          status: refundAmount >= capturedAmount ? 'refunded' : 'partially_refunded',
          refundedAt: new Date(),
        },
      });
    }

    // Update dispute
    await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        finalDecision: decision,
        finalRefundAmount: refundAmount,
        adminNotes,
        resolvedById: adminId,
        status: 'resolved',
        resolvedAt: new Date(),
      },
    });

    // Update booking status
    await prisma.booking.update({
      where: { id: dispute.bookingId },
      data: { status: 'completed' }, // Back to completed after resolution
    });

    return {
      resolved: true,
      decision,
      refundAmount,
    };
  },

  /**
   * Get dispute by ID
   */
  async getDisputeById(disputeId, userId) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        booking: {
          include: {
            charger: { select: { hostId: true, name: true } },
            session: true,
          },
        },
        raisedBy: { select: { name: true } },
        resolvedBy: { select: { name: true } },
      },
    });

    if (!dispute) {
      throw new NotFoundError('Dispute');
    }

    // Check access
    const isDriver = dispute.booking.driverId === userId;
    const isHost = dispute.booking.charger.hostId === userId;
    const isAdmin = false; // Would check user roles

    if (!isDriver && !isHost && !isAdmin) {
      throw new ForbiddenError('You do not have access to this dispute');
    }

    return {
      id: dispute.id,
      bookingId: dispute.bookingId,
      chargerName: dispute.booking.charger.name,
      raisedBy: {
        name: dispute.raisedBy.name,
        role: dispute.raisedByRole,
      },
      reason: dispute.reason,
      description: dispute.description,
      evidence: dispute.evidence,
      status: dispute.status,
      aiAnalysis: dispute.aiDecision ? {
        decision: dispute.aiDecision,
        refundAmount: dispute.aiRefundAmount ? parseFloat(dispute.aiRefundAmount) : null,
        reasoning: dispute.aiReasoning,
        confidence: dispute.aiConfidence ? parseFloat(dispute.aiConfidence) : null,
        reviewedAt: dispute.aiReviewedAt,
      } : null,
      finalResolution: dispute.finalDecision ? {
        decision: dispute.finalDecision,
        refundAmount: dispute.finalRefundAmount ? parseFloat(dispute.finalRefundAmount) : null,
        adminNotes: isAdmin ? dispute.adminNotes : undefined,
        resolvedBy: dispute.resolvedBy?.name,
        resolvedAt: dispute.resolvedAt,
      } : null,
      createdAt: dispute.createdAt,
    };
  },

  /**
   * Get user's disputes
   */
  async getUserDisputes(userId, { status, page = 1, limit = 20 }) {
    const where = {
      OR: [
        { raisedById: userId },
        { booking: { driverId: userId } },
        { booking: { charger: { hostId: userId } } },
      ],
    };

    if (status) {
      where.status = status;
    }

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          booking: {
            select: {
              charger: { select: { name: true } },
              scheduledStart: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dispute.count({ where }),
    ]);

    return {
      disputes: disputes.map(d => ({
        id: d.id,
        bookingId: d.bookingId,
        chargerName: d.booking.charger.name,
        bookingDate: d.booking.scheduledStart,
        reason: d.reason,
        status: d.status,
        aiDecision: d.aiDecision,
        finalDecision: d.finalDecision,
        createdAt: d.createdAt,
        resolvedAt: d.resolvedAt,
      })),
      pagination: { page, limit, total },
    };
  },
};

export default disputeService;
