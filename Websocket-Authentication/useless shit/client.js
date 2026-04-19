const WebSocket = require('ws');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connection parameters - these would typically come from your application
const serviceId = 'pandadevkit'; // Example service ID
const hwid = '2062f80093066633876b542212c496501a5e79523cc4ea9b28667dff065afd8f'; // Example HWID
const clientKey = 'your_client_key_here'; // Replace with actual key

// WebSocket connection URL with query parameters
const wsUrl = `ws://localhost:3000/?serviceId=${serviceId}&hwid=${hwid}&key=${clientKey}`;

// Connect to the WebSocket server
console.log('Connecting to WebSocket server...');
const ws = new WebSocket(wsUrl);

// Heartbeat interval (in milliseconds)
const HEARTBEAT_INTERVAL = 25000; // Slightly less than server's interval
let heartbeatInterval;

// Handle connection open
ws.on('open', () => {
  console.log('Connected to the WebSocket server');
  
  // Start sending heartbeats
  heartbeatInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'heartbeat' }));
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
    console.log('\nReceived message from server:', message);
    
    // Handle specific message types
    if (message.type === 'validation_response') {
      if (message.success) {
        console.log('✅ Validation successful!');
      } else {
        console.log('❌ Validation failed:', message.message);
      }
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
  console.log('2. exit - Close the connection and exit');
  showPrompt();
}

// Show command prompt
function showPrompt() {
  rl.question('\nEnter command: ', (command) => {
    switch (command.toLowerCase()) {
      case 'validate':
        // Send validation request
        ws.send(JSON.stringify({
          type: 'validate',
          serviceId: serviceId,
          hwid: hwid,
          key: clientKey
        }));
        console.log('Sent validation request');
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
