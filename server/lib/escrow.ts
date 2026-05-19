import { Deposit } from '../models/Deposit';
import { EscrowTransaction } from '../models/EscrowTransaction';
import { Request as RequestModel } from '../models/Request';
import { createNotification } from './notifications';

/**
 * Automatically processes a refund for a completed request if an escrowed deposit exists.
 */
export async function triggerEscrowRefund(requestId: string, io: any) {
  try {
    const request = await RequestModel.findById(requestId).populate('item');
    if (!request) return { success: false, error: 'Request not found' };

    // Condition: status is completed and return logic is satisfied
    if (request.status !== 'completed' || !request.returnVerifiedAt) {
      return { success: false, error: 'Request not in a refundable state' };
    }

    const deposit = await Deposit.findOne({ request: requestId, status: 'escrowed' });
    if (!deposit) return { success: true, message: 'No escrowed deposit found for this request' };

    // Simply update Deposit status (No real money involved anymore)
    deposit.status = 'refunded';
    deposit.updatedAt = new Date();
    await deposit.save();

    // Create Refund Transaction
    const transaction = new EscrowTransaction({
      type: 'refund',
      amount: deposit.amount,
      to: request.requester,
      request: requestId,
      status: 'completed'
    });
    await transaction.save();

    // Notify Borrower
    await createNotification(io, {
      recipient: request.requester.toString(),
      sender: request.owner.toString(),
      type: 'escrow_refunded',
      title: 'Security Deposit Released',
      message: `Your neighborhood deposit of $${deposit.amount} for ${(request.item as any)?.title || 'your borrowed item'} has been automatically returned to your ledger.`,
      link: '/profile?tab=history',
      relatedId: requestId
    });

    // Recalculate trust scores for both parties
    const { calculateTrustScore } = await import('./trust');
    await calculateTrustScore(request.requester.toString());
    await calculateTrustScore(request.owner.toString());

    return { success: true, amount: deposit.amount };
  } catch (error: any) {
    console.error('Escrow Refund Trigger Error:', error);
    return { success: false, error: error.message };
  }
}
