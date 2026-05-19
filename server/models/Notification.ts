import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['request_created', 'request_approved', 'request_rejected', 'request_completed', 'new_message', 'system', 'expiration_warning', 'deposit_paid', 'dispute_raised', 'escrow_refunded', 'escrow_compensated'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  link: {
    type: String // e.g., /messages
  },
  relatedId: {
    type: String // e.g., requestId
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Notification = mongoose.model('Notification', NotificationSchema);
