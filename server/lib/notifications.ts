import { Notification } from '../models/Notification';

export const createNotification = async (io: any, data: {
  recipient: string;
  sender?: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  relatedId?: string;
}) => {
  try {
    const notification = new Notification(data);
    await notification.save();
    
    // Populate sender for real-time update
    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'name avatar');
    
    // Get recipient's firebaseUid for room targeting
    const { User } = await import('../models/User');
    const recipientUser = await User.findById(data.recipient).select('firebaseUid');
    const recipientRoomId = recipientUser?.firebaseUid || data.recipient;
      
    // Emit real-time notification to the personal user room
    if (io) {
      io.to(`user_${recipientRoomId}`).emit('new_notification', populatedNotification);
    }
    
    return populatedNotification;
  } catch (err) {
    console.error('Error creating notification:', err);
  }
};
