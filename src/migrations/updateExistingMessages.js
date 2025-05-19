const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

// Connect to the database
connectDB();

async function updateExistingMessages() {
  try {
    console.log('Starting migration: adding senderType to existing messages...');

    // Find all users with messages
    const users = await User.find({
      'messages': { $exists: true, $ne: [] }
    });

    console.log(`Found ${users.length} users with messages to update`);

    // For each user, check their messages and update if needed
    for (const user of users) {
      let needsUpdate = false;
      
      // Check each message
      for (const message of user.messages) {
        // If message doesn't have senderType
        if (!message.senderType) {
          needsUpdate = true;
          // Try to infer senderType based on available data
          // Default to 'user' if we can't determine
          message.senderType = 'user';
        }
      }
      
      // Only save the user if we made changes
      if (needsUpdate) {
        await user.save();
        console.log(`Updated messages for user: ${user.userId}`);
      }
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
updateExistingMessages(); 