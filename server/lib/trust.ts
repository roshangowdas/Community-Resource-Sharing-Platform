import { User } from '../models/User';
import { Request } from '../models/Request';

/**
 * Calculates a dynamic trust score (0-1000) based on various factors
 */
export async function calculateTrustScore(userId: string) {
  const user = await User.findById(userId);
  if (!user) return 500;

  // Base score
  let score = 500;

  // Verification bonus
  if (user.isVerified) score += 200;

  // Transaction history bonus
  const requestHistory = await Request.find({ 
    $or: [{ requester: userId }, { owner: userId }],
    status: 'completed'
  });

  score += Math.min(requestHistory.length * 5, 200);

  // Reliability impact
  if (user.reliabilityRate < 90) score -= (90 - user.reliabilityRate) * 5;
  if (user.punctualityRate < 95) score -= (95 - user.punctualityRate) * 3;

  // Dispute penalty
  if (user.disputeRate > 5) score -= user.disputeRate * 10;

  const result = Math.max(0, Math.min(1000, Math.round(score)));
  
  // Cache the score in the database
  user.trustScore = result;
  await user.save();

  return result;
}

/**
 * Recommends a deposit multiplier based on trust score
 * Trusted user -> lower deposit (e.g. 20%)
 * New user -> higher deposit (e.g. 80%)
 */
export async function getDepositMultiplier(userId: string) {
  const trustScore = await calculateTrustScore(userId);

  if (trustScore >= 900) return 0.2; // Elite
  if (trustScore >= 750) return 0.4; // Trusted
  if (trustScore >= 500) return 0.6; // Average
  if (trustScore >= 300) return 0.8; // Risky
  return 1.0; // High Risk / New
}

/**
 * Logic to handle late return penalties
 */
export async function processLatePenalty(requestId: string) {
  const request = await Request.findById(requestId).populate('item');
  if (!request || !request.borrowEndDate) return;

  const now = new Date();
  if (now > request.borrowEndDate) {
    const hoursLate = Math.ceil((now.getTime() - request.borrowEndDate.getTime()) / (1000 * 60 * 60));
    const penaltyPerDay = 5; // $5 per day (simplified)
    const penalty = Math.ceil((hoursLate / 24) * penaltyPerDay);
    
    // In a real app, this would deduct from escrow
    console.log(`Applying late penalty of $${penalty} for request ${requestId}`);
    return penalty;
  }
  return 0;
}
