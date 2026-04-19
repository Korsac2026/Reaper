const WebSocket = require('ws');
const readline = require('readline');
const crypto = require('crypto');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Client configuration
const CLIENT_ID = 'client1'; // Must match an ID in the server's CLIENT_SECRET_KEYS
const CLIENT_SECRET_KEY = 'client1_secret_key'; // Must match the server's stored key
const SERVER_SECRET_KEY = 'server_secret_key_change_this_in_production'; // For verifying server signatures

// Connection parameters - these would typically come from your application
const serviceId = 'pandadevkit'; // Example service ID
const hwid = '2062f80093066633876b542212c496501a5e79523cc4ea9b28667dff065afd8f'; // Example HWID
const clientKey = 'your_client_key_here'; // Replace with actual key

// WebSocket connection URL with query parameters
const wsUrl = `ws://localhost:3000/?serviceId=${serviceId}&hwid=${hwid}&key=${clientKey}&clientId=${CLIENT_ID}`;

// Generate a signature for a message
function generateSignature(message, secretKey) {
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(typeof message === 'string' ? message : JSON.stringify(message));
  return hmac.digest('hex');
}

// Verify a signature from the server
function verifyServerSignature(message, signature) {
  try {
    // Extract the message content (everything except the signature)
    const { signature: _, ...messageContent } = message;
    
    // Generate expected signature
    const expectedSignature = generateSignature(messageContent, SERVER_SECRET_KEY);
    
    // Compare signatures
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

// Connect to the WebSocket server
console.log('Connecting to WebSocket server...');
const ws = new WebSocket(wsUrl);

// Heartbeat interval (in milliseconds)
const HEARTBEAT_INTERVAL = 25000; // Slightly less than server's interval
let heartbeatInterval;

// Store the current challenge token
let currentChallengeToken = '';

// Handle connection open
ws.on('open', () => {
  console.log('Connected to the WebSocket server');
  
  // Start sending heartbeats
  heartbeatInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      // Create heartbeat message
      const heartbeatMessage = {
        type: 'heartbeat',
        timestamp: Date.now()
      };
      
      // Add challenge response if we have a token
      if (currentChallengeToken) {
        heartbeatMessage.challengeResponse = generateSignature(currentChallengeToken, CLIENT_SECRET_KEY);
      }
      
      // Generate signature for the message
      const signature = generateSignature(heartbeatMessage, CLIENT_SECRET_KEY);
      
      // Send the message with signature
      ws.send(JSON.stringify({
        ...heartbeatMessage,
        signature
      }));
      
      console.log('Sent heartbeat to server');
    }
  }, HEARTBEAT_INTERVAL);
  
  // Show available commands
  showCommands();
});

// Handle incoming messages
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    
    // Extract signature
    const { signature, ...messageContent } = message;
    
    // Verify server signature
    if (!signature) {
      console.error('❌ Warning: Server message missing signature!');
    } else {
      const isValidSignature = verifyServerSignature(message, signature);
      if (!isValidSignature) {
        console.error('❌ Warning: Invalid server signature! Possible security breach.');
        return; // Don't process messages with invalid signatures
      }
    }
    
    console.log('\nReceived message from server:', messageContent);
    
    // Handle specific message types
    if (message.type === 'validation_response') {
      if (message.success) {
        console.log('✅ Validation successful!');
        // Store the challenge token if provided
        if (message.challengeToken) {
          currentChallengeToken = message.challengeToken;
          console.log('Received new challenge token');
        }
      } else {
        console.log('❌ Validation failed:', message.message);
      }
    } else if (message.type === 'heartbeat_response') {
      // Update challenge token if provided
      if (message.challengeToken) {
        currentChallengeToken = message.challengeToken;
      }
    } else if (message.type === 'welcome') {
      // Store initial challenge token
      if (message.challengeToken) {
        currentChallengeToken = message.challengeToken;
        console.log('Received initial challenge token');
      }
    } else if (message.type === 'error') {
      console.error(`❌ Error from server: ${message.message}`);
    }
    
    // Show prompt again after receiving a message
    showPrompt();
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

// Handle connection close
ws.on('close', () => {
  console.log('Disconnected from the WebSocket server');
  clearInterval(heartbeatInterval);
  rl.close();
});

// Handle errors
ws.on('error', (error) => {
  console.error('WebSocket error:', error.message);
});

// Show available commands
function showCommands() {
  console.log('\nAvailable commands:');
  console.log('1. validate - Send validation request');
  console.log('2. challenge - Respond to current challenge');
  console.log('3. exit - Close the connection and exit');
  showPrompt();
}

// Show command prompt
function showPrompt() {
  rl.question('\nEnter command: ', (command) => {
    switch (command.toLowerCase()) {
      case 'validate':
        // Create validation request
        const validationRequest = {
          type: 'validate',
          serviceId: serviceId,
          hwid: hwid,
          key: clientKey
        };
        
        // Generate signature
        const validationSignature = generateSignature(validationRequest, CLIENT_SECRET_KEY);
        
        // Send validation request with signature
        ws.send(JSON.stringify({
          ...validationRequest,
          signature: validationSignature
        }));
        
        console.log('Sent validation request');
        break;
        
      case 'challenge':
        if (!currentChallengeToken) {
          console.log('No active challenge token available');
          showPrompt();
          return;
        }
        
        // Create challenge response
        const challengeResponse = {
          type: 'challenge_response',
          response: generateSignature(currentChallengeToken, CLIENT_SECRET_KEY)
        };
        
        // Generate signature
        const challengeSignature = generateSignature(challengeResponse, CLIENT_SECRET_KEY);
        
        // Send challenge response with signature
        ws.send(JSON.stringify({
          ...challengeResponse,
          signature: challengeSignature
        }));
        
        console.log('Sent challenge response');
        break;
        
      case 'exit':
        // Close connection and exit
        console.log('Closing connection...');
        ws.close();
        rl.close();
        break;
        
      default:
        console.log('Unknown command. Try again.');
        showCommands();
        break;
    }
  });
}

// Handle readline close
rl.on('close', () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  console.log('Client terminated');
  process.exit(0);
});
