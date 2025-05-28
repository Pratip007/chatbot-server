const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // const conn = await mongoose.connect('mongodb+srv://pratipmaity500:Pratip%40123@chatbot.yihi59o.mongodb.net/?retryWrites=true&w=majority&appName=chatbot');
        const conn = await mongoose.connect('mongodb://localhost:27017/chatbot');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB; 