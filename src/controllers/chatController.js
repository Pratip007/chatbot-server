const Chat = require('../models/Chat');
const mongoose = require('mongoose');

// Simple response mapping for common queries
const responseMap = {
  'hello': 'Hello! Welcome to Cortex AI, How may I assist you today?',
  'hi': 'Hi there! How may I assist you?',
  'help': 'I can help you with:\n1. Account Status\n2. KYC \n3. Deposit&Withdrawals\n4. Technical support\nWhat would you like to know?',
  'bye': 'Thank you for chatting with us. Have a great day!',
  'thanks': 'You\'re welcome! Is there anything else I can help you with?'
};

const messageSchema = new mongoose.Schema({
  content: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  senderType: {
    type: String,
    enum: ['user', 'bot', 'admin'],
    required: true
  },
  senderId: String, // Store actual user/admin ID
  file: {
    filename: String,
    originalname: String,
    mimetype: String,
    size: Number,
    data: String // Base64 encoded file data
  },
  isRead: {
    type: Boolean,
    default: false
  }
});

exports.processMessage = async (message) => {
  try {
    // If a file is received, reply with a special message
    if (message.hasFile) {
      return {
        text: 'Hello! I received your file successfully. Thank you for sharing it',
        timestamp: new Date(),
        senderType: 'bot'
      };
    }
    const lowerMessage = message.text.toLowerCase();
    let response = 'Our agent is connecting with you. Please wait just a moment . . . .';

    // Check for matching responses
    for (const [key, value] of Object.entries(responseMap)) {
      if (lowerMessage.includes(key)) {
        response = value;
        break;
      }
    }

    // Save the chat to database
    const chat = new Chat({
      message: message.text,
      response: response,
      userId: message.userId,
      senderType: message.senderType || 'user',
      isRead: false // New messages are unread by default
    });
    await chat.save();

    return {
      text: response,
      timestamp: new Date(),
      senderType: 'bot'
    };
  } catch (error) {
    console.error('Error processing message:', error);
    return {
      text: 'Sorry, I encountered an error. Please try again.',
      timestamp: new Date(),
      senderType: 'bot'
    };
  }
};

exports.getChatHistory = async (userId) => {
  try {
    const chats = await Chat.find({ userId })
      .sort({ timestamp: 1 })
      .limit(50);
    return chats;
  } catch (error) {
    console.error('Error fetching chat history:', error);
    throw error;
  }
};

exports.getAllChats = async (page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;
    const chats = await Chat.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Chat.countDocuments();
    
    return {
      chats,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    };
  } catch (error) {
    console.error('Error fetching all chats:', error);
    throw error;
  }
};

// Mark a user's messages as read when admin views them
exports.markMessagesAsRead = async (userId) => {
  try {
    const result = await Chat.updateMany(
      { userId, senderType: 'user', isRead: false },
      { $set: { isRead: true } }
    );
    
    return { 
      success: true, 
      count: result.modifiedCount 
    };
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

// Mark a specific message as read
exports.markMessageAsRead = async (messageId) => {
  try {
    const result = await Chat.findByIdAndUpdate(
      messageId,
      { $set: { isRead: true } },
      { new: true }
    );
    
    return result;
  } catch (error) {
    console.error('Error marking message as read:', error);
    throw error;
  }
};

// Get count of unread messages per user
exports.getUnreadMessageCounts = async () => {
  try {
    const unreadCounts = await Chat.aggregate([
      { $match: { senderType: 'user', isRead: false } },
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]);
    
    return unreadCounts.map(item => ({
      userId: item._id,
      unreadCount: item.count
    }));
  } catch (error) {
    console.error('Error getting unread message counts:', error);
    throw error;
  }
}; 