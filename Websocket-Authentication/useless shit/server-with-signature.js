const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const axios = require('axios');
const url = require('url');
const crypto = require('crypto');

// Create an Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

// Set the heartbeat interval (in milliseconds)
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 35000; // 35 seconds (slightly longer than interval)

// Store active connections
const clients = new Map();

// Validation endpoint URL
const VALIDATION_URL = 'https://pandadevelopment.net/v2_validation';

// Secret keys for signature verification
// In production, these should be stored securely and not in the code
const SERVER_SECRET_KEY = 'server_secret_key_change_this_in_production';
const CLIENT_SECRET_KEYS = {
  // Map of client IDs to their secret keys
  // In a real application, these would be stored in a secure database
  'client1': 'client1_secret_key',
  'client2': 'client2_secret_key',
  // Add more client keys as needed
};

// Generate a signature for a message
function generateSignature(message, secretKey) {
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(typeof message === 'string' ? message : JSON.stringify(message));
  return hmac.digest('hex');
}

// Verify a signature from a client
function verifySignature(message, signature, clientId) {
  // Get the client's secret key
  const clientSecretKey = CLIENT_SECRET_KEYS[clientId];
  if (!clientSecretKey) {
    console.error(`No secret key found for client ID: ${clientId}`);
    return false;
  }
  
  // Generate expected signature
  const expectedSignature = generateSignature(message, clientSecretKey);
  
  // Compare signatures using a timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Validate client credentials against the external API
async function validateClient(serviceId, hwid, clientKey) {
  try {
    const response = await axios.get(VALIDATION_URL, {
      params: {
        service: serviceId,
        hwid: hwid,
        key: clientKey
      }
    });

    console.log('Validation response:', response.data);

    // Check if V2_Authentication is "success"
    if (response.data && response.data.V2_Authentication === "success") {
      return {
        isValid: true,
        data: response.data
      };
    } else {
      return {
        isValid: false,
        data: response.data
      };
    }
  } catch (error) {
    console.error('Validation error:', error.message);
    return {
      isValid: false,
      error: error.message
    };
  }
}

// Handle WebSocket connections
wss.on('connection', async (ws, req) => {
  const id = Date.now().toString();
  const query = url.parse(req.url, true).query;
  
  // Extract validation parameters from the query
  const serviceId = query.serviceId;
  const hwid = query.hwid;
  const clientKey = query.key;
  const clientId = query.clientId || id; // Use provided client ID or generate one
  
  // Set up client state
  clients.set(ws, {
    id,
    clientId,
    isAlive: true,
    serviceId,
    hwid,
    clientKey,
    validated: false,
    lastHeartbeat: Date.now(),
    challengeToken: crypto.randomBytes(32).toString('hex'), // For challenge-response
    challengeExpiry: Date.now() + 60000 // 1 minute expiry
  });
  
  console.log(`Client ${id} connected with client ID ${clientId}`);
  
  // Set up heartbeat check for this client
  ws.isAlive = true;
  ws.on('pong', () => {
    const client = clients.get(ws);
    if (client) {
      client.isAlive = true;
      client.lastHeartbeat = Date.now();
      console.log(`Heartbeat received from client ${client.id}`);
    }
  });
  
  // Handle client messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received message from client ${id}:`, data);
      
      // Extract signature and message content
      const { signature, ...messageContent } = data;
      
      // Skip signature verification for initial connection
      // In production, you might want to require signatures for all messages
      if (data.type !== 'initial_connection' && !data.skipSignatureCheck) {
        // Verify signature
        if (!signature) {
          console.error(`Missing signature from client ${id}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Missing signature',
            signature: generateSignature({ type: 'error', message: 'Missing signature' }, SERVER_SECRET_KEY)
          }));
          return;
        }
        
        // Verify the signature
        const isValidSignature = verifySignature(messageContent, signature, clientId);
        if (!isValidSignature) {
          console.error(`Invalid signature from client ${id}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid signature',
            signature: generateSignature({ type: 'error', message: 'Invalid signature' }, SERVER_SECRET_KEY)
          }));
          return;
        }
      }
      
      // Handle validation request
      if (data.type === 'validate') {
        const client = clients.get(ws);
        
        // Use parameters from the message if provided, otherwise use the ones from connection
        const validationServiceId = data.serviceId || client.serviceId;
        const validationHwid = data.hwid || client.hwid;
        const validationKey = data.key || client.clientKey;
        
        if (!validationServiceId || !validationHwid || !validationKey) {
          const errorResponse = {
            type: 'validation_response',
            success: false,
            message: 'Missing required validation parameters'
          };
          
          ws.send(JSON.stringify({
            ...errorResponse,
            signature: generateSignature(errorResponse, SERVER_SECRET_KEY)
          }));
          return;
        }
        
        const validationResult = await validateClient(
          validationServiceId,
          validationHwid,
          validationKey
        );
        
        if (validationResult.isValid) {
          // Update client state
          client.validated = true;
          client.validationData = validationResult.data;
          
          // Generate a new challenge token for future challenge-response
          client.challengeToken = crypto.randomBytes(32).toString('hex');
          client.challengeExpiry = Date.now() + 60000; // 1 minute expiry
          
          const successResponse = {
            type: 'validation_response',
            success: true,
            message: 'Authentication successful',
            data: validationResult.data,
            challengeToken: client.challengeToken
          };
          
          ws.send(JSON.stringify({
            ...successResponse,
            signature: generateSignature(successResponse, SERVER_SECRET_KEY)
          }));
        } else {
          const failureResponse = {
            type: 'validation_response',
            success: false,
            message: 'Authentication failed',
            data: validationResult.data
          };
          
          ws.send(JSON.stringify({
            ...failureResponse,
            signature: generateSignature(failureResponse, SERVER_SECRET_KEY)
          }));
        }
      }
      // Handle heartbeat message
      else if (data.type === 'heartbeat') {
        const client = clients.get(ws);
        if (client) {
          client.isAlive = true;
          client.lastHeartbeat = Date.now();
          
          // Check if challenge response is included
          if (data.challengeResponse) {
            // Verify the challenge response
            const expectedResponse = generateSignature(client.challengeToken, CLIENT_SECRET_KEYS[clientId]);
            
            if (data.challengeResponse !== expectedResponse || Date.now() > client.challengeExpiry) {
              console.error(`Invalid challenge response from client ${id}`);
              const errorResponse = {
                type: 'error',
                message: 'Invalid challenge response'
              };
              
              ws.send(JSON.stringify({
                ...errorResponse,
                signature: generateSignature(errorResponse, SERVER_SECRET_KEY)
              }));
              return;
            }
            
            // Challenge passed, generate a new one
            client.challengeToken = crypto.randomBytes(32).toString('hex');
            client.challengeExpiry = Date.now() + 60000; // 1 minute expiry
          }
          
          const heartbeatResponse = {
            type: 'heartbeat_response',
            timestamp: Date.now(),
            challengeToken: client.challengeToken
          };
          
          ws.send(JSON.stringify({
            ...heartbeatResponse,
            signature: generateSignature(heartbeatResponse, SERVER_SECRET_KEY)
          }));
        }
      }
      // Handle challenge-response
      else if (data.type === 'challenge_response') {
        const client = clients.get(ws);
        if (!client) return;
        
        // Verify the challenge response
        const expectedResponse = generateSignature(client.challengeToken, CLIENT_SECRET_KEYS[clientId]);
        
        if (data.response !== expectedResponse || Date.now() > client.challengeExpiry) {
          console.error(`Invalid challenge response from client ${id}`);
          const errorResponse = {
            type: 'error',
            message: 'Invalid challenge response'
          };
          
          ws.send(JSON.stringify({
            ...errorResponse,
            signature: generateSignature(errorResponse, SERVER_SECRET_KEY)
          }));
          return;
        }
        
        // Challenge passed, generate a new one
        client.challengeToken = crypto.randomBytes(32).toString('hex');
        client.challengeExpiry = Date.now() + 60000; // 1 minute expiry
        
        const successResponse = {
          type: 'challenge_success',
          message: 'Challenge verified successfully',
          newChallengeToken: client.challengeToken
        };
        
        ws.send(JSON.stringify({
          ...successResponse,
          signature: generateSignature(successResponse, SERVER_SECRET_KEY)
        }));
      }
    } catch (error) {
      console.error(`Error processing message from client ${id}:`, error);
      const errorResponse = {
        type: 'error',
        message: 'Invalid message format'
      };
      
      ws.send(JSON.stringify({
        ...errorResponse,
        signature: generateSignature(errorResponse, SERVER_SECRET_KEY)
      }));
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log(`Client ${id} disconnected`);
    clients.delete(ws);
  });
  
  // Send welcome message with initial challenge
  const client = clients.get(ws);
  const welcomeMessage = {
    type: 'welcome',
    message: 'Connected to WebSocket server',
    clientId: id,
    challengeToken: client.challengeToken
  };
  
  ws.send(JSON.stringify({
    ...welcomeMessage,
    signature: generateSignature(welcomeMessage, SERVER_SECRET_KEY)
  }));
});

// Heartbeat mechanism - send pings to all clients
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = clients.get(ws);
    if (!client) return;
    
    // Check if client has responded to previous ping
    if (client.isAlive === false) {
      console.log(`Client ${client.id} timed out (no heartbeat response)`);
      clients.delete(ws);
      return ws.terminate();
    }
    
    // Check if the last heartbeat is too old
    const timeSinceLastHeartbeat = Date.now() - client.lastHeartbeat;
    if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
      console.log(`Client ${client.id} timed out (heartbeat timeout)`);
      clients.delete(ws);
      return ws.terminate();
    }
    
    // Mark as not alive until we get a pong response
    client.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

// Clean up interval on server close
wss.on('close', () => {
  clearInterval(heartbeat);
});

// Basic HTTP endpoint for status
app.get('/', (req, res) => {
  res.send('WebSocket Server with Heartbeat and Signature Verification is running');
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  console.log(`WebSocket server is running on ws://localhost:${PORT}`);
});
