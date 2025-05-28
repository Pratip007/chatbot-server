const Chat = require('../models/Chat');
const User = require('../models/User');
const mongoose = require('mongoose');

// Simple response mapping for common queries
const responseMap = {
  'hello': 'Hello! Welcome to Cortex AI, How may I assist you today?',
  'hi': 'Hi there! How may I assist you?',
  'help': 'I can help you with:\n1. Account Status\n2. KYC \n3. Deposit&Withdrawals\n4. Technical support\nWhat would you like to know?',
  'bye': 'Thank you for chatting with us. Have a great day!',
  'thanks': 'You\'re welcome! Is there anything else I can help you with?'
};

// Store user session data for bot silence
const userSessions = new Map();

// Welcome message that appears once per day
const WELCOME_MESSAGE = 'Welcome to Cortex AI Customer Care! We\'re here to assist you. Please let us know how we can serve you better.';

// Queue message that silences bot for 30 minutes
const QUEUE_MESSAGE = 'You\'re in the queue. Please wait patiently while we connect you with a live customer care agent. We appreciate your patience.';

// 30 minutes in milliseconds
const BOT_SILENCE_DURATION = 30 * 60 * 1000;

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
    const userId = message.userId;
    
    // Check if bot is currently silenced for this user
    if (isBotSilenced(userId)) {
      // Bot is silenced, don't respond
      return null;
    }

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
    let shouldSilenceBot = false;

    // Check for matching responses
    let foundMatch = false;
    for (const [key, value] of Object.entries(responseMap)) {
      if (lowerMessage.includes(key)) {
        response = value;
        foundMatch = true;
        break;
      }
    }

    // If no specific match found, send queue message and silence bot
    if (!foundMatch) {
      response = QUEUE_MESSAGE;
      shouldSilenceBot = true;
    }

    // Save the chat to database
    const chat = new Chat({
      message: message.text,
      response: response,
      userId: userId,
      senderType: message.senderType || 'user',
      isRead: false
    });
    await chat.save();

    // If we sent the queue message, silence the bot for 30 minutes
    if (shouldSilenceBot) {
      silenceBotFor30Minutes(userId);
    }

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

// Helper function to check if bot should be silent
const isBotSilenced = (userId) => {
  const userSession = userSessions.get(userId);
  if (!userSession || !userSession.silencedUntil) {
    return false;
  }
  
  const now = new Date();
  if (now < userSession.silencedUntil) {
    return true;
  } else {
    // Silence period has ended, remove it
    userSession.silencedUntil = null;
    userSessions.set(userId, userSession);
    return false;
  }
};

// Helper function to silence bot for 30 minutes
const silenceBotFor30Minutes = (userId) => {
  const userSession = userSessions.get(userId) || {};
  const silencedUntil = new Date(Date.now() + BOT_SILENCE_DURATION);
  
  userSessions.set(userId, {
    ...userSession,
    silencedUntil: silencedUntil
  });
};

// Helper function to check if user should receive welcome message
const shouldSendWelcomeMessage = async (userId) => {
  try {
    const user = await User.findOne({ userId });
    if (!user) {
      return true; // New user should get welcome message
    }
    
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // Get YYYY-MM-DD format
    
    // Check if user has received welcome message today
    if (!user.lastWelcomeDate || user.lastWelcomeDate !== today) {
      // Update the last welcome date
      await User.updateOne(
        { userId },
        { lastWelcomeDate: today }
      );
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking welcome message status:', error);
    return false;
  }
};

// Export welcome message functionality for use in other controllers
exports.shouldSendWelcomeMessage = shouldSendWelcomeMessage;
exports.WELCOME_MESSAGE = WELCOME_MESSAGE; 