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
    senderId: {
        type: String,
        default: null
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
    updatedAt: Date,
    isEdited: {
        type: Boolean,
        default: false
    },
    editHistory: [{
        originalContent: String,
        editedAt: {
            type: Date,
            default: Date.now
        },
        editedBy: String,
        reason: String
    }]
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
    lastWelcomeDate: {
        type: String, // Store as date string (YYYY-MM-DD format)
        default: null
    },
    messages: [messageSchema]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Drop the email index if it exists
User.collection.dropIndex('email_1').catch(() => {});

module.exports = User; 