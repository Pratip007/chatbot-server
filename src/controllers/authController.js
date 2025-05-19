const Chat = require('../models/Chat');
const User = require('../models/User');
const processMessage = require('./chatController').processMessage;

// Store socket instance for use in controllers
let io;

// Set socket.io instance
exports.setSocketIO = (socketIO) => {
  io = socketIO;
};

// Import chat controller functions
const chatController = require('./chatController');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, { userId: 1, username: 1, createdAt: 1, updatedAt: 1 });
    res.json(users);
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    res.status(500).json({ error: 'Error fetching users' });
  }
};

exports.getUser = async (req, res) => {
  try {
    const { userId, username } = req.body;

    if (!userId || !username) {
      return res.status(400).json({ error: 'userId and username are required' });
    }

    let user = await User.findOne({ userId });

    if (!user) {
      user = await User.create({
        userId,
        username,
        messages: [] // Initial empty messages array
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error in getUser:', error);
    res.status(500).json({ error: 'Error processing request' });
  }
};

exports.handleChat = async (req, res) => {
  try {
    const { userId, message, adminId } = req.body;
    const file = req.file;

    console.log('handleChat request:', { userId, message, adminId, hasFile: !!file });
    
    if (file) {
      console.log('File received:', file.originalname, 'Size:', file.size, 'Type:', file.mimetype);
    }

    if (!userId || (!message && !file)) {
      return res.status(400).json({ error: 'userId and either message or file are required' });
    }

    let user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if this is an admin message
    if (adminId) {
      console.log('Processing admin message - skipping bot response');
      
      // Add admin message
      const adminMessageObj = {
        content: message || '',
        timestamp: new Date(),
        senderType: 'admin',
        senderId: adminId
      };
      
      // Add file information if a file was uploaded
      if (file) {
        // Convert buffer to base64
        const base64Data = file.buffer.toString('base64');
        adminMessageObj.file = {
          filename: file.originalname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          data: `data:${file.mimetype};base64,${base64Data}`
        };
      }
      
      user.messages.push(adminMessageObj);
      await user.save();
      
      // Get the saved message to access its ID
      const savedMessage = user.messages[user.messages.length - 1];
      
      // Emit socket event to the specific user
      if (io) {
        // Prepare the message for the client
        const socketMessage = {
          _id: savedMessage._id,
          content: savedMessage.content,
          timestamp: savedMessage.timestamp,
          senderType: 'admin',
          senderId: adminId,
          file: savedMessage.file
        };
        
        // Emit to user's room
        io.to(userId).emit('message', socketMessage);
        console.log(`Emitted admin message to user ${userId}`);
      }
      
      return res.json({
        userMessage: null,
        adminMessage: message || 'File sent',
        fileData: file ? adminMessageObj.file.data : null,
        messageId: savedMessage._id,
        user: user
      });
    }

    // For user messages, continue with the existing logic (get bot response)
    console.log('Processing user message - generating bot response');
    
    // Prepare message object
    const messageObj = {
      content: message || '',
      timestamp: new Date(),
      senderType: 'user'
    };

    // Add file information if a file was uploaded
    if (file) {
      // Convert buffer to base64
      const base64Data = file.buffer.toString('base64');
      messageObj.file = {
        filename: file.originalname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        data: `data:${file.mimetype};base64,${base64Data}`
      };
    }

    // Add user message
    user.messages.push(messageObj);

    // Get bot response
    const botResponse = await processMessage({
      text: message || 'File uploaded',
      userId: userId,
      hasFile: !!file
    });

    // Create bot message object
    const botMessageObj = {
      content: botResponse.text,
      timestamp: new Date(),
      senderType: 'bot'
    };
    
    // Add bot response
    user.messages.push(botMessageObj);

    await user.save();
    
    // Emit socket events for real-time updates
    if (io) {
      // First, emit the user message to admin clients
      const userSocketMessage = {
        _id: messageObj._id,
        content: messageObj.content,
        timestamp: messageObj.timestamp,
        senderType: 'user',
        file: messageObj.file
      };
      
      // Emit to admin room
      io.to('admin').emit('message', { ...userSocketMessage, userId });
      
      // Then, emit the bot response to the user
      const botSocketMessage = {
        _id: botMessageObj._id,
        content: botMessageObj.content,
        timestamp: botMessageObj.timestamp,
        senderType: 'bot'
      };
      
      // Emit to user's room
      io.to(userId).emit('message', botSocketMessage);
      console.log(`Emitted bot response to user ${userId}`);
    }

    res.json({
      userMessage: message || 'File uploaded',
      botResponse: botResponse.text,
      fileData: file ? messageObj.file.data : null,
      user: user
    });
  } catch (error) {
    console.error('Error in handleChat:', error);
    res.status(500).json({ error: 'Error processing chat' });
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.messages);
  } catch (error) {
    console.error('Error in getChatHistory:', error);
    res.status(500).json({ error: 'Error fetching chat history' });
  }
};

exports.getChatHistoryByParam = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.messages);
  } catch (error) {
    console.error('Error in getChatHistoryByParam:', error);
    res.status(500).json({ error: 'Error fetching chat history' });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error in getUserById:', error);
    res.status(500).json({ error: 'Error fetching user details' });
  }
};

// Update a message
exports.updateMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content, adminId } = req.body;

    if (!messageId || !content) {
      return res.status(400).json({ error: 'messageId and content are required' });
    }

    // Find user with this message
    const user = await User.findOne({ 'messages._id': messageId });
    if (!user) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Find and update the specific message in the array
    const messageIndex = user.messages.findIndex(msg => msg._id.toString() === messageId);
    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Update the message content
    user.messages[messageIndex].content = content;
    user.messages[messageIndex].updatedAt = new Date();

    await user.save();
    
    // Emit socket event for real-time updates
    if (io) {
      const updatedMessage = {
        _id: messageId,
        content: content,
        updatedAt: user.messages[messageIndex].updatedAt,
        action: 'updated'
      };
      
      // Emit to user's room
      io.to(user.userId).emit('messageUpdated', updatedMessage);
      
      // Also notify admins
      io.to('admin').emit('messageUpdated', { ...updatedMessage, userId: user.userId });
    }

    console.log("nxjcnjxncjnxjnvjnjvnjdnfjndjfnjdnfjn");
    
    
    res.json({
      message: 'Message updated successfully...........................',
      updatedMessage: user.messages[messageIndex]
    });
  } catch (error) {
    console.error('Error in updateMessage:', error);
    res.status(500).json({ error: 'Error updating message' });
  }
};

// Delete a message (soft delete)
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({ error: 'messageId is required' });
    }

    // Find user with this message
    const user = await User.findOne({ 'messages._id': messageId });
    if (!user) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Remove the message from the messages array using $pull
    await User.updateOne(
      { _id: user._id },
      { 
        $pull: { 
          messages: { _id: messageId } 
        } 
      }
    );

    // Fetch the updated user to confirm deletion
    const updatedUser = await User.findById(user._id);
    
    // Emit socket event for real-time updates
    if (io) {
      const deletedMessage = {
        _id: messageId,
        action: 'deleted'
      };
      
      // Emit to user's room
      io.to(user.userId).emit('messageDeleted', deletedMessage);
      
      // Also notify admins
      io.to('admin').emit('messageDeleted', { ...deletedMessage, userId: user.userId });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully...................................',
      messageId: messageId
    });
  } catch (error) {
    console.error('Error in deleteMessage:', error);
    res.status(500).json({ error: 'Error deleting message' });
  }
};

// Mark all messages from a user as read
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const result = await chatController.markMessagesAsRead(userId);
    
    // Emit to all admin clients for real-time updates
    if (io) {
      io.to('admin').emit('messageRead', {
        userId,
        timestamp: new Date()
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Error marking messages as read' });
  }
};

// Mark a specific message as read
exports.markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    
    if (!messageId) {
      return res.status(400).json({ error: 'messageId is required' });
    }
    
    const result = await chatController.markMessageAsRead(messageId);
    
    // Emit to all admin clients for real-time updates
    if (io && result) {
      io.to('admin').emit('messageRead', {
        messageId,
        timestamp: new Date()
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Error marking message as read' });
  }
};

// Get unread message counts for all users
exports.getUnreadMessageCounts = async (req, res) => {
  try {
    const unreadCounts = await chatController.getUnreadMessageCounts();
    res.json(unreadCounts);
  } catch (error) {
    console.error('Error getting unread message counts:', error);
    res.status(500).json({ error: 'Error getting unread message counts' });
  }
}; 