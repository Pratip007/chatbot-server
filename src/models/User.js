const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    content: String,
    timestamp: {
        type: Date,
        default: Date.now
    },
    senderType: {
        type: String,
        enum: ['user', 'bot', 'admin'],
        required: true,
        default: 'user'
    },
    file: {
        filename: String,
        originalname: String,
        mimetype: String,
        size: Number,
        data: String // Base64 encoded file data
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date,
    updatedAt: Date
});

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    messages: [messageSchema]
}, { timestamps: true });

// Drop all indexes and recreate only the ones we need
userSchema.index({ userId: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);

// Drop the email index if it exists
User.collection.dropIndex('email_1').catch(() => {});

module.exports = User; 