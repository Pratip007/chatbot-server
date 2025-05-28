const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testWelcomeMessage() {
  console.log('🧪 Testing Welcome Message Functionality\n');

  try {
    // Test 1: Get user for the first time today (should receive welcome message)
    console.log('📝 Test 1: First access today - should receive welcome message');
    const response1 = await axios.get(`${BASE_URL}/api/users/testuser123`);
    
    if (response1.status === 200) {
      const user = response1.data;
      console.log('✅ User fetched successfully');
      console.log(`📊 Total messages: ${user.messages.length}`);
      
      // Check if welcome message was added
      const welcomeMessages = user.messages.filter(msg => 
        msg.senderType === 'bot' && 
        msg.content.includes('Welcome to Cortex AI Customer Care')
      );
      
      if (welcomeMessages.length > 0) {
        console.log('✅ Welcome message found in user messages');
        console.log(`📝 Welcome message: "${welcomeMessages[0].content}"`);
        console.log(`🕐 Timestamp: ${welcomeMessages[0].timestamp}`);
      } else {
        console.log('❌ Welcome message not found');
      }
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Get same user again (should NOT receive another welcome message)
    console.log('\n📝 Test 2: Second access same day - should NOT receive welcome message');
    const response2 = await axios.get(`${BASE_URL}/api/users/testuser123`);
    
    if (response2.status === 200) {
      const user = response2.data;
      console.log('✅ User fetched successfully');
      console.log(`📊 Total messages: ${user.messages.length}`);
      
      // Check welcome messages count
      const welcomeMessages = user.messages.filter(msg => 
        msg.senderType === 'bot' && 
        msg.content.includes('Welcome to Cortex AI Customer Care')
      );
      
      console.log(`📊 Welcome messages count: ${welcomeMessages.length}`);
      
      if (welcomeMessages.length === 1) {
        console.log('✅ Correct: Only one welcome message exists (no duplicate)');
      } else {
        console.log('❌ Error: Multiple welcome messages found or none found');
      }
    }

    // Test 3: Test with a new user
    console.log('\n📝 Test 3: New user - should receive welcome message');
    const newUserId = `newuser${Date.now()}`;
    
    try {
      const response3 = await axios.get(`${BASE_URL}/api/users/${newUserId}`);
      console.log('❌ New user should not exist yet');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ Correct: New user does not exist');
        
        // Create the user first
        console.log('📝 Creating new user...');
        const createResponse = await axios.post(`${BASE_URL}/api/user`, {
          userId: newUserId,
          username: `TestUser${Date.now()}`
        });
        
        if (createResponse.status === 200) {
          console.log('✅ New user created successfully');
          
          // Now get the user (should receive welcome message)
          const getUserResponse = await axios.get(`${BASE_URL}/api/users/${newUserId}`);
          
          if (getUserResponse.status === 200) {
            const newUser = getUserResponse.data;
            console.log('✅ New user fetched successfully');
            console.log(`📊 Total messages: ${newUser.messages.length}`);
            
            const welcomeMessages = newUser.messages.filter(msg => 
              msg.senderType === 'bot' && 
              msg.content.includes('Welcome to Cortex AI Customer Care')
            );
            
            if (welcomeMessages.length > 0) {
              console.log('✅ Welcome message sent to new user');
              console.log(`📝 Welcome message: "${welcomeMessages[0].content}"`);
            } else {
              console.log('❌ Welcome message not sent to new user');
            }
          }
        }
      }
    }

    console.log('\n🎉 Welcome message tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testWelcomeMessage(); 