import { Item } from '../models/Item';
import { Notification } from '../models/Notification';
import { createNotification } from './notifications';
import { Server } from 'socket.io';

export const checkExpirations = async (io: Server) => {
  console.log('[EXPIRY CHECKER] Starting expiration check...');
  try {
    // Current date
    const now = new Date();
    
    // Check items expiring in the next 3 days
    const warningThreshold = new Date();
    warningThreshold.setDate(now.getDate() + 3);

    const expiringItems = await Item.find({
      expiresAt: { $gt: now, $lt: warningThreshold },
      status: 'available',
      type: 'donate' // Typically donations expire, while shares might be long-term
    });

    console.log(`[EXPIRY CHECKER] Found ${expiringItems.length} items nearing expiration.`);

    for (const item of expiringItems) {
      // Check if we already sent a warning for this item recently (last 3 days)
      const existingWarning = await Notification.findOne({
        recipient: item.owner,
        relatedId: item._id.toString(),
        type: 'expiration_warning',
        createdAt: { $gt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) }
      });

      if (!existingWarning) {
        const daysLeft = Math.ceil(((item.expiresAt as Date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        await createNotification(io, {
          recipient: item.owner.toString(),
          type: 'expiration_warning',
          title: 'Listing Expiring Soon',
          message: `Your listing "${item.title}" will expire in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}. Renewable or remove it to keep your profile clean.`,
          link: '/profile', // User can manage their listings in profile
          relatedId: item._id.toString()
        });
        
        console.log(`[EXPIRY CHECKER] Notification sent for item: ${item.title}`);
      }
    }
    
    console.log('[EXPIRY CHECKER] Expiration check completed.');
  } catch (err) {
    console.error('[EXPIRY CHECKER] Error checking expirations:', err);
  }
};
