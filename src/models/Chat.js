const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true
  },
  response: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  sessionId: {
    type: String,
    required: false
  },
  userId: {
    type: String,
    required: true
  },
  senderType: {
    type: String,
    enum: ['user', 'bot', 'admin'],
    default: 'user'
  },
  isRead: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Chat', chatSchema); 