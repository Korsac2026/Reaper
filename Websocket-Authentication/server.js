// Load environment variables from .env file
import dotenv from 'dotenv';
import express from 'express';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { WebSocketServer } from 'ws';
import axios from 'axios';
import { parse } from 'url';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

// Initialize environment variables
dotenv.config();

// Import utilities for beautiful console output
import figlet from 'figlet';
import chalk from 'chalk';

/**
 * Display beautiful banner with modern chalk styling
 */
const displayBanner = () => {
  console.clear();
  
  // Generate ASCII Art Banner using figlet
  const bannerText = figlet.textSync('PANDA WEBAUTH', {
    font: 'ANSI Shadow',
    horizontalLayout: 'fitted',
    verticalLayout: 'default',
    width: 120,
    whitespaceBreak: true
  });

  // Display banner with gradient-like colors using chalk
  console.log(chalk.hex('#FF5F6D')(bannerText));
  console.log(chalk.cyan('\n✨ Secure WebSocket Authentication System ✨\n'));
};

// Display the banner
displayBanner();


// Create an Express app
const app = express();

// Check if SSL certificates exist
let server;
let isHttps = false;

// SSL certificate paths - update these with your actual paths
const sslOptions = {
  key: process.env.SSL_KEY_PATH,
  cert: process.env.SSL_CERT_PATH
};

// Try to create HTTPS server if certificates exist
if (sslOptions.key && sslOptions.cert && fs.existsSync(sslOptions.key) && fs.existsSync(sslOptions.cert)) {
  try {
    const key = fs.readFileSync(sslOptions.key);
    const cert = fs.readFileSync(sslOptions.cert);
    server = createHttpsServer({ key, cert }, app);
    isHttps = true;
    console.log(chalk.green('✓ HTTPS server created successfully with SSL certificates'));
  } catch (err) {
    console.error(chalk.yellow('⚠ Failed to create HTTPS server:'), err.message);
    console.log(chalk.yellow('⚠ Falling back to HTTP server'));
    server = createHttpServer(app);
  }
} else {
  console.log(chalk.yellow('⚠ SSL certificates not found, using HTTP server'));
  server = createHttpServer(app);
}

// Add middleware
app.use(express.json());

// Simple CORS configuration - allow all origins
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Credentials', true);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Use cors middleware as a backup
app.use(cors());

// Create a WebSocket server with proper proxy handling
const wss = new WebSocketServer({ 
  server,
  // Add proper handling for proxied connections
  handleProtocols: (protocols) => {
    if (protocols.includes('websocket')) {
      return 'websocket';
    }
    return false;
  }
});

// Track connection attempts to prevent duplicates
const connectionAttempts = new Map();

/**
 * Configuration constants
 */
const CONFIG = {
  // Server settings
  server: {
    port: process.env.PORT || 3000
  },
  // Heartbeat settings
  heartbeat: {
    interval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000, // 30 seconds
    timeout: parseInt(process.env.HEARTBEAT_TIMEOUT) || 35000,  // 35 seconds (slightly longer than interval)
  },
  // Validation settings
  validation: {
    url: process.env.VALIDATION_URL || 'https://pandadevelopment.net/v2_validation'
  },
  // Security settings
  security: {
    requireSignature: process.env.REQUIRE_SIGNATURE_VERIFICATION === 'true',
    serverSecretKey: process.env.SERVER_SECRET_KEY || 'server_secret_key_change_this_in_production',
    clientSecretKeys: {
      // Map of client IDs to their secret keys
      // In a real application, these would be stored in a secure database
      'client1': 'client1_secret_key',
      'client2': 'client2_secret_key',
      // Add more client keys as needed
    }
  },
  // Rate limiting settings
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false', // Enabled by default
    maxMessages: parseInt(process.env.RATE_LIMIT_MAX_MESSAGES) || 30, // Max messages per window
    timeWindow: parseInt(process.env.RATE_LIMIT_TIME_WINDOW) || 10000, // Time window in ms (10 seconds)
    banThreshold: parseInt(process.env.RATE_LIMIT_BAN_THRESHOLD) || 3, // Number of violations before temporary ban
    banDuration: parseInt(process.env.RATE_LIMIT_BAN_DURATION) || 60000 // Ban duration in ms (1 minute)
  }
};

// Extract constants for easier access
const PORT = CONFIG.server.port;
const HEARTBEAT_INTERVAL = CONFIG.heartbeat.interval;
const HEARTBEAT_TIMEOUT = CONFIG.heartbeat.timeout;
const VALIDATION_URL = CONFIG.validation.url;
const REQUIRE_SIGNATURE_VERIFICATION = CONFIG.security.requireSignature;
const SERVER_SECRET_KEY = CONFIG.security.serverSecretKey;
const CLIENT_SECRET_KEYS = CONFIG.security.clientSecretKeys;

// Rate limiting constants
const RATE_LIMIT_ENABLED = CONFIG.rateLimit.enabled;
const RATE_LIMIT_MAX_MESSAGES = CONFIG.rateLimit.maxMessages;
const RATE_LIMIT_TIME_WINDOW = CONFIG.rateLimit.timeWindow;
const RATE_LIMIT_BAN_THRESHOLD = CONFIG.rateLimit.banThreshold;
const RATE_LIMIT_BAN_DURATION = CONFIG.rateLimit.banDuration;

// Store active connections
const clients = new Map();

// Add a database to track connections with timestamps
const connectionDatabase = {
  connections: new Map(),
  
  // Add a connection to the database
  addConnection(id, data) {
    this.connections.set(id, {
      ...data,
      lastActivity: Date.now(),
      active: true
    });
  },
  
  // Update a connection in the database
  updateConnection(id, updates) {
    const connection = this.connections.get(id);
    if (connection) {
      this.connections.set(id, {
        ...connection,
        ...updates,
        lastActivity: Date.now()
      });
    }
  },
  
  // Mark a connection as inactive
  removeConnection(id) {
    const connection = this.connections.get(id);
    if (connection) {
      connection.active = false;
      connection.disconnectedAt = Date.now();
      this.connections.set(id, connection);
      
      // Schedule cleanup after 5 minutes
      setTimeout(() => {
        this.connections.delete(id);
        console.log(`Connection ${id} permanently removed from database`);
      }, 5 * 60 * 1000); // 5 minutes
    }
  },
  
  // Get all active connections for a service
  getActiveConnections(serviceId = null) {
    const result = [];
    this.connections.forEach((connection, id) => {
      // Filter by service ID if provided and only return active connections
      if (connection.active && (!serviceId || connection.serviceId === serviceId)) {
        result.push({
          id,
          ...connection
        });
      }
    });
    return result;
  },
  
  // Get all connections (active and inactive) for a service
  getAllConnections(serviceId = null, includeInactive = false) {
    const result = [];
    this.connections.forEach((connection, id) => {
      // Filter by service ID if provided
      if ((!serviceId || connection.serviceId === serviceId) && 
          (includeInactive || connection.active)) {
        result.push({
          id,
          ...connection
        });
      }
    });
    return result;
  },
  
  // Clean up stale connections (inactive for more than the specified time)
  cleanupStaleConnections(maxInactivityTime = 30 * 1000) { // 30 seconds by default
    const now = Date.now();
    this.connections.forEach((connection, id) => {
      if (connection.active && now - connection.lastActivity > maxInactivityTime) {
        console.log(`Marking stale connection ${id} as inactive (no activity for ${(now - connection.lastActivity)/1000}s)`);
        this.removeConnection(id);
      }
    });
  }
};

// Set up periodic cleanup of stale connections
setInterval(() => {
  connectionDatabase.cleanupStaleConnections(HEARTBEAT_TIMEOUT);
}, HEARTBEAT_INTERVAL);

// Log the current configuration
console.log(chalk.cyan('Server Configuration:'));
console.log(chalk.cyan(`- Port: ${PORT}`));
console.log(chalk.cyan(`- Heartbeat Interval: ${HEARTBEAT_INTERVAL}ms`));
console.log(chalk.cyan(`- Heartbeat Timeout: ${HEARTBEAT_TIMEOUT}ms`));
console.log(chalk.cyan(`- Validation URL: ${VALIDATION_URL}`));
console.log(chalk.cyan(`- Signature Verification: ${REQUIRE_SIGNATURE_VERIFICATION ? 'Required' : 'Optional'}`));
console.log(chalk.cyan(`- Rate Limiting: ${RATE_LIMIT_ENABLED ? 'Enabled' : 'Disabled'}`));
if (RATE_LIMIT_ENABLED) {
  console.log(chalk.cyan(`  - Max ${RATE_LIMIT_MAX_MESSAGES} messages per ${RATE_LIMIT_TIME_WINDOW/1000}s`));
  console.log(chalk.cyan(`  - ${RATE_LIMIT_BAN_THRESHOLD} violations = ${RATE_LIMIT_BAN_DURATION/1000}s temporary ban`));
}

/**
 * Generate a signature for a message
 * @param {string|object} message - The message to sign
 * @param {string} secretKey - The secret key to use for signing
 * @returns {string} The generated signature
 */
const generateSignature = (message, secretKey) => {
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(typeof message === 'string' ? message : JSON.stringify(message));
  return hmac.digest('hex');
};

/**
 * Verify a signature from a client
 * @param {string|object} message - The message that was signed
 * @param {string} signature - The signature to verify
 * @param {string} clientId - The client ID to look up the secret key
 * @returns {boolean} Whether the signature is valid
 */
const verifySignature = (message, signature, clientId) => {
  // Get the client's secret key
  const clientSecretKey = CLIENT_SECRET_KEYS[clientId];
  if (!clientSecretKey) {
    console.error(`No secret key found for client ID: ${clientId}`);
    return false;
  }
  
  // Generate expected signature
  const expectedSignature = generateSignature(message, clientSecretKey);
  
  // Compare signatures using a timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};

/**
 * Validate a client key with the validation service
 * @param {string} serviceId - The service ID
 * @param {string} hwid - The hardware ID
 * @param {string} key - The key to validate
 * @returns {Promise<{success: boolean, message: string}>} - The validation result
 */
const validateKey = async (serviceId, hwid, key) => {
  try {
    // Check if all required parameters are provided
    if (!serviceId || !hwid || !key) {
      return {
        success: false,
        message: 'Missing required validation parameters'
      };
    }
    
    console.log(`Validating key with: ${VALIDATION_URL}?service=${serviceId}&hwid=${hwid}&key=${key}`);
    
    // Call the validation API using GET with query parameters
    // This matches how the panda-key-system expects requests
    const response = await axios.get(VALIDATION_URL, {
      params: {
        service: serviceId,
        hwid: hwid,
        key: key
      }
    });
    
    console.log('Validation response:', response.data);
    
    // Check if the validation was successful (looking for V2_Authentication: "success")
    if (response.data && response.data.V2_Authentication === "success") {
      return {
        success: true,
        message: response.data.message || 'Key validated successfully',
        data: response.data
      };
    } else {
      return {
        success: false,
        message: (response.data && response.data.message) || 'Key validation failed',
        data: response.data
      };
    }
  } catch (error) {
    console.error('Error validating key:', error.message);
    return {
      success: false,
      message: 'Error validating key: ' + error.message
    };
  }
};

// Main validation function is validateKey - no need for a separate validateClient function

// Handle WebSocket connections
wss.on('connection', async (ws, req) => {
  // Parse query parameters
  const query = new URLSearchParams(parse(req.url).query);
  const id = query.get('sessionId') || generateUniqueId();
  const serviceId = query.get('serviceId');
  
  // Check if this is a duplicate connection attempt (from proxy)
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const connectionKey = `${clientIp}:${id}`;
  
  // If this connection was seen recently, it might be a duplicate from Nginx proxy
  if (connectionAttempts.has(connectionKey)) {
    const lastAttempt = connectionAttempts.get(connectionKey);
    if (Date.now() - lastAttempt < 5000) { // Within 5 seconds
      console.log(`Possible duplicate connection from ${connectionKey}, ignoring`);
      return ws.close(1000, 'Duplicate connection');
    }
  }
  
  // Record this connection attempt
  connectionAttempts.set(connectionKey, Date.now());
  
  // Clean up old connection attempts every 5 minutes
  setTimeout(() => connectionAttempts.delete(connectionKey), 5 * 60 * 1000);
  const hwid = query.get('hwid');
  const clientKey = query.get('key');
  const username = query.get('username') || 'Unknown Player';
  
  // Get client IP address
  const ipAddress = req.headers['x-forwarded-for'] || 
                    req.connection.remoteAddress || 
                    req.socket.remoteAddress || 
                    'unknown';
  
  // Detect library type from user agent or query params
  let libraryType = 'Unknown';
  
  // Check if library type is provided in query parameters
  const queryLibraryType = query.get('libraryType');
  if (queryLibraryType) {
    libraryType = queryLibraryType;
    console.log(`Client ${id} is using library type from URL: ${libraryType}`);
  } else {
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent.includes('Roblox')) {
      libraryType = 'Roblox Lua';
    } else if (userAgent.includes('Node')) {
      libraryType = 'Node.js';
    } else if (userAgent.includes('Python')) {
      libraryType = 'Python';
    } else if (userAgent.includes('Unity')) {
      libraryType = 'Unity C#';
    } else {
      libraryType = 'Lua';
    }
  }
  
  console.log(`Client ${id} library type: ${libraryType}`);
  
  // Store client information
  const clientInfo = {
    id,
    serviceId,
    hwid,
    clientKey: clientKey,
    isAlive: true,
    lastHeartbeat: Date.now(),
    connectedAt: Date.now(),
    ipAddress: req.socket.remoteAddress,
    validated: false,
    username,
    libraryType,
    status: 'Pending', // Initialize with Pending status
    // Rate limiting data
    rateLimit: {
      messageCount: 0,
      windowStart: Date.now(),
      violations: 0,
      bannedUntil: 0
    }
  };
  
  clients.set(ws, clientInfo);
  
  // Also store in the connection database
  connectionDatabase.addConnection(id, clientInfo);
  
  console.log(`Client ${id} connected`);
  
  // Set up heartbeat check for this client
  ws.isAlive = true;
  ws.on('pong', () => {
    const client = clients.get(ws);
    if (client) {
      client.isAlive = true;
      client.lastHeartbeat = Date.now();
      
      // Update the connection database
      connectionDatabase.updateConnection(client.id, {
        lastHeartbeat: Date.now()
      });
      
      console.log(`Heartbeat received from client ${client.id}`);
    }
  });
  
  // Handle client messages
  ws.on('message', async (message) => {
    try {
      // Get client information
      const client = clients.get(ws);
      if (!client) return;
      
      // Check if rate limiting is enabled
      if (RATE_LIMIT_ENABLED) {
        // Check if client is temporarily banned
        if (client.rateLimit.bannedUntil > Date.now()) {
          const remainingBanTime = Math.ceil((client.rateLimit.bannedUntil - Date.now()) / 1000);
          ws.send(JSON.stringify({
            type: 'error',
            code: 'RATE_LIMITED',
            message: `You are temporarily banned for ${remainingBanTime} more seconds due to message rate violations.`
          }));
          return;
        }
        
        // Reset counter if time window has passed
        const now = Date.now();
        if (now - client.rateLimit.windowStart > RATE_LIMIT_TIME_WINDOW) {
          client.rateLimit.messageCount = 0;
          client.rateLimit.windowStart = now;
        }
        
        // Increment message count
        client.rateLimit.messageCount++;
        
        // Check if client has exceeded the rate limit
        if (client.rateLimit.messageCount > RATE_LIMIT_MAX_MESSAGES) {
          // Increment violations counter
          client.rateLimit.violations++;
          
          // Check if client should be temporarily banned
          if (client.rateLimit.violations >= RATE_LIMIT_BAN_THRESHOLD) {
            client.rateLimit.bannedUntil = Date.now() + RATE_LIMIT_BAN_DURATION;
            ws.send(JSON.stringify({
              type: 'error',
              code: 'RATE_LIMITED',
              message: `You have been temporarily banned for ${RATE_LIMIT_BAN_DURATION/1000} seconds due to excessive message rate.`
            }));
            console.log(chalk.red(`Client ${id} has been temporarily banned for ${RATE_LIMIT_BAN_DURATION/1000} seconds due to rate limit violations.`));
            return;
          }
          
          // Send warning message
          ws.send(JSON.stringify({
            type: 'warning',
            code: 'RATE_LIMIT_WARNING',
            message: `You are sending messages too quickly. Violation ${client.rateLimit.violations}/${RATE_LIMIT_BAN_THRESHOLD} before temporary ban.`
          }));
          console.log(chalk.yellow(`Rate limit warning issued to client ${id}. Violation ${client.rateLimit.violations}/${RATE_LIMIT_BAN_THRESHOLD}.`));
          return;
        }
      }
      
      const data = JSON.parse(message);
      console.log(`Received message from client ${id}:`, data);
      
      // Check signature if required
      if (REQUIRE_SIGNATURE_VERIFICATION && data.type !== 'heartbeat') {
        const { signature, clientId, ...payload } = data;
        
        if (!signature || !clientId) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Signature verification required but signature or clientId missing'
          }));
          return;
        }
        
        const isSignatureValid = verifySignature(payload, signature, clientId);
        if (!isSignatureValid) {
          console.error(`Invalid signature from client ${id}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid signature'
          }));
          return;
        }
        
        console.log(`Valid signature from client ${id}`);
      }
      
      // Handle validation request
      if (data.type === 'validate') {
        try {
          // Extract data from the validation request
          const { serviceId, hwid, key, username, libraryType } = data;
          if (libraryType) {
            client.libraryType = libraryType;
          } else {
            // Set a default library type for clients that don't send one
            client.libraryType = "Lua Client";
            console.log(`Client ${client.id} connected with default library type: Lua Client`);
          }
          console.log(`Validation request from client ${id} for service ${serviceId} (${username || 'Unknown Player'})`);
          
          // Update client username if provided
          if (username && client) {
            client.username = username;
          }
          
          // Update library type if provided in the message
          if (libraryType) {
            client.libraryType = libraryType;
            console.log(`Client ${client.id} is using library: ${libraryType}`);
            
            // Update the connection database with the library type
            connectionDatabase.updateConnection(client.id, {
              libraryType: libraryType
            });
          }
          
          // Use parameters from the message if provided, otherwise use the ones from connection
          const validationServiceId = data.serviceId || client.serviceId;
          const validationHwid = data.hwid || client.hwid;
          const validationKey = data.key || client.clientKey;
          
          // Validate the key
          const validationResponse = await validateKey(validationServiceId, validationHwid, validationKey);
          
          if (validationResponse.success) {
            // Update client state
            client.validated = true;
            client.username = username || 'Unknown';
            client.status = 'Active'; // Update status to Active instead of Pending
            
            console.log(`Client ${client.id} validated successfully - setting status to Active`);
            
            // Update the connection database
            connectionDatabase.updateConnection(client.id, {
              validated: true,
              username: username || 'Unknown',
              status: 'Active', // Update status in the database
              lastActivity: Date.now() // Update last activity timestamp
            });
            
            // Send success response
            ws.send(JSON.stringify({
              type: 'validation_response',
              success: true,
              message: 'Key validated successfully!'
            }));
            
            console.log(`Client ${client.id} validated successfully as ${username}`);
          } else {
            // Send failure response
            ws.send(JSON.stringify({
              type: 'validation_response',
              success: false,
              message: validationResponse.message || 'Key validation failed'
            }));
            
            console.log(`Client ${id} validation failed: ${validationResponse.message}`);
          }
        } catch (error) {
          console.error(`Error during validation for client ${id}:`, error);
          
          // Send error response
          ws.send(JSON.stringify({
            type: 'validation_response',
            success: false,
            message: 'Internal server error during validation'
          }));
        }
      }
      // Handle heartbeat message
      else if (data.type === 'heartbeat') {
        const client = clients.get(ws);
        if (client) {
          client.isAlive = true;
          client.lastHeartbeat = Date.now();
          ws.send(JSON.stringify({
            type: 'heartbeat_response',
            timestamp: Date.now()
          }));
        }
      }
    } catch (error) {
      console.error(`Error processing message from client ${id}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log(`Client ${id} disconnected`);
    
    // Remove client from the clients map
    clients.delete(ws);
    
    // Mark as inactive in the connection database
    connectionDatabase.removeConnection(id);
    
    // Log the current number of active connections
    console.log(`Active connections: ${clients.size}`);
  });
  

  
  // Send welcome message with signature requirement info
  const welcomeMessage = {
    type: 'welcome',
    message: 'Connected to WebSocket server',
    clientId: id,
    requiresSignature: REQUIRE_SIGNATURE_VERIFICATION
  };
  
  // If server is configured to sign messages, add a signature
  if (SERVER_SECRET_KEY) {
    welcomeMessage.serverSignature = generateSignature({
      type: welcomeMessage.type,
      message: welcomeMessage.message,
      clientId: welcomeMessage.clientId,
      requiresSignature: welcomeMessage.requiresSignature
    }, SERVER_SECRET_KEY);
  }
  
  ws.send(JSON.stringify(welcomeMessage));
});

/**
 * Heartbeat mechanism - send pings to all clients
 * @returns {NodeJS.Timeout} The interval timer
 */
const setupHeartbeatMechanism = () => {
  return setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = clients.get(ws);
      if (!client) return;
      
      // Check if client has responded to previous ping
      if (client.isAlive === false) {
        console.log(chalk.red(`Client ${client.id} timed out (no heartbeat response)`));
        clients.delete(ws);
        return ws.terminate();
      }
      
      // Check if the last heartbeat is too old
      const timeSinceLastHeartbeat = Date.now() - client.lastHeartbeat;
      if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
        console.log(chalk.red(`Client ${client.id} timed out (heartbeat timeout)`));
        clients.delete(ws);
        return ws.terminate();
      }
      
      // Mark as not alive until we get a pong response
      client.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);
};

// Initialize the heartbeat mechanism
const heartbeat = setupHeartbeatMechanism();

// Clean up interval on server close
wss.on('close', () => {
  clearInterval(heartbeat);
});

// Configure Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic HTTP endpoint for status
app.get('/', (req, res) => {
  res.send('WebSocket Server with Heartbeat is running');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API endpoint to get active connections
app.get('/api/connections', (req, res) => {
  try {
    // Get the user's service ID from the request
    // In a real implementation, this would come from the user's session or JWT token
    const userServiceId = req.query.userServiceId || req.headers['x-service-id'];
    const { service } = req.query;
    const includeInactive = req.query.includeInactive === 'true';
    
    // If no user service ID is provided, check if a specific service is requested
    const filterServiceId = userServiceId || service;
    
    // Get connections from the connection database
    const connections = includeInactive 
      ? connectionDatabase.getAllConnections(filterServiceId, true)
      : connectionDatabase.getActiveConnections(filterServiceId);
    
    // Log the filtering that was applied
    console.log(`Connections filtered by service ID: ${filterServiceId || 'None (showing all)'}, found ${connections.length} connections, includeInactive=${includeInactive}`);
            
    res.status(200).json({
      total: connections.length,
      connections: connections
    });
  } catch (error) {
    console.error('Error getting connections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/connections/:id/disconnect', (req, res) => {
  try {
    const { id } = req.params;
    let found = false;
    let targetWs = null;
    
    // Find the client with the specified ID
    clients.forEach((client, ws) => {
      if (client.id === id) {
        // Store the WebSocket reference
        targetWs = ws;
        found = true;
      }
    });
    
    if (found && targetWs) {
      // Send disconnect message to client
      try {
        targetWs.send(JSON.stringify({
          type: 'admin_disconnect',
          message: 'Disconnected by administrator'
        }));
      } catch (sendError) {
        console.error('Error sending disconnect message:', sendError);
        // Continue with disconnection even if message fails
      }
      
      // Force close the connection
      try {
        targetWs.terminate(); // Use terminate instead of close for immediate effect
      } catch (closeError) {
        console.error('Error closing connection:', closeError);
      }
      
      // Ensure the client is removed from the map
      clients.delete(targetWs);
      
      console.log(`Client ${id} has been forcibly disconnected by admin. Active connections: ${clients.size}`);
      res.status(200).json({ success: true, message: `Client ${id} has been disconnected` });
    } else {
      res.status(404).json({ success: false, message: `Client ${id} not found` });
    }
  } catch (error) {
    console.error('Error disconnecting client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get connection statistics
app.get('/api/stats', (req, res) => {
  try {
    // Get the service ID from the request
    const serviceId = req.query.serviceId || req.headers['x-service-id'];
    
    console.log(`Received stats request for service ID: ${serviceId || 'all'}`);
    
    // Initialize counters
    let totalConnections = 0;
    let validatedConnections = 0;
    const serviceStats = {};
    
    // Get connections from the database
    const connections = connectionDatabase.getActiveConnections();
    
    // If a specific service ID is requested, filter the connections
    const filteredConnections = serviceId 
      ? connections.filter(conn => conn.serviceId === serviceId)
      : connections;
    
    // Count total and validated connections
    totalConnections = filteredConnections.length;
    validatedConnections = filteredConnections.filter(conn => conn.validated).length;
    
    // For service stats, ONLY include the requested service
    if (serviceId) {
      // Only include stats for the requested service
      serviceStats[serviceId] = {
        total: filteredConnections.length,
        validated: filteredConnections.filter(conn => conn.validated).length
      };
    } else {
      // If no service ID specified, include all services (admin view)
      filteredConnections.forEach(conn => {
        const connServiceId = conn.serviceId || 'unknown';
        
        if (!serviceStats[connServiceId]) {
          serviceStats[connServiceId] = {
            total: 0,
            validated: 0
          };
        }
        
        serviceStats[connServiceId].total++;
        
        if (conn.validated) {
          serviceStats[connServiceId].validated++;
        }
      });
    }
    
    // Log what we're returning
    console.log(`Stats for service ID ${serviceId || 'all'}: ${totalConnections} total, ${validatedConnections} validated`);
    console.log('Service stats:', serviceStats);
    
    res.status(200).json({
      totalConnections,
      validatedConnections,
      serviceStats
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new endpoint to manually refresh connection status
app.post('/api/connections/refresh', (req, res) => {
  try {
    // Force cleanup of stale connections
    connectionDatabase.cleanupStaleConnections();
    
    res.status(200).json({
      success: true,
      message: 'Connection status refreshed successfully',
      activeConnections: connectionDatabase.getActiveConnections().length
    });
  } catch (error) {
    console.error('Error refreshing connections:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing connections'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// Start the server with beautiful loading animation

/**
 * Display loading animation with modern chalk styling
 */
const displayLoadingAnimation = async () => {
  // Loading steps
  const steps = [
    'Starting server...',
    'Initializing WebSocket service...',
    'Configuring heartbeat system...',
    'Setting up authentication protocols...'
  ];
  
  // Display each step with a delay
  for (let i = 0; i < steps.length; i++) {
    console.log(chalk.yellow(`[${i+1}/${steps.length}] ${steps[i]}`));
    await new Promise(resolve => setTimeout(resolve, 800));
  }
};

/**
 * Display server information in a formatted box
 * @param {number} port - The server port
 */
const displayServerInfo = (port) => {
  // Box drawing characters
  const box = {
    topLeft: '┌', topRight: '┐',
    bottomLeft: '└', bottomRight: '┘',
    horizontal: '─', vertical: '│'
  };
  
  // Create horizontal line
  const line = box.horizontal.repeat(53);
  
  // Server information
  console.log(chalk.bgCyan.black(' SERVER INFORMATION '));
  console.log(chalk.cyan(`${box.topLeft}${line}${box.topRight}`));
  console.log(chalk.cyan(`${box.vertical}`) + ` ${chalk.bold('Status:')} ${chalk.green.bold('ONLINE')}${' '.repeat(35)}` + chalk.cyan(`${box.vertical}`));
  console.log(chalk.cyan(`${box.vertical}`) + ` ${chalk.bold('Port:')} ${chalk.yellow(port)}${' '.repeat(40 - port.toString().length)}` + chalk.cyan(`${box.vertical}`));
  console.log(chalk.cyan(`${box.vertical}`) + ` ${chalk.bold('Protocol:')} ${isHttps ? chalk.green.bold('HTTPS') : chalk.yellow('HTTP')}${' '.repeat(isHttps ? 33 : 35)}` + chalk.cyan(`${box.vertical}`));
  console.log(chalk.cyan(`${box.vertical}`) + ` ${chalk.bold('WebSocket:')} ${chalk.yellow(`${isHttps ? 'wss' : 'ws'}://157.173.198.181:${port}`)}${' '.repeat(isHttps ? 10 : 11 - port.toString().length)}` + chalk.cyan(`${box.vertical}`));
  console.log(chalk.cyan(`${box.vertical}`) + ` ${chalk.bold('HTTP:')} ${chalk.yellow(`${isHttps ? 'https' : 'http'}://157.173.198.181:${port}`)}${' '.repeat(isHttps ? 10 : 11 - port.toString().length)}` + chalk.cyan(`${box.vertical}`));
  console.log(chalk.cyan(`${box.bottomLeft}${line}${box.bottomRight}`));
  
  // Heartbeat information
  console.log(chalk.bgMagenta.black(' HEARTBEAT CONFIGURATION '));
  console.log(chalk.magenta(`${box.topLeft}${line}${box.topRight}`));
  console.log(chalk.magenta(`${box.vertical}`) + ` ${chalk.bold('Interval:')} ${chalk.yellow(`${HEARTBEAT_INTERVAL/1000}s`)}${' '.repeat(33)}` + chalk.magenta(`${box.vertical}`));
  console.log(chalk.magenta(`${box.vertical}`) + ` ${chalk.bold('Timeout:')} ${chalk.yellow(`${HEARTBEAT_TIMEOUT/1000}s`)}${' '.repeat(34)}` + chalk.magenta(`${box.vertical}`));
  console.log(chalk.magenta(`${box.bottomLeft}${line}${box.bottomRight}`));
  
  // Rate limiting information if enabled
  if (RATE_LIMIT_ENABLED) {
    console.log(chalk.bgYellow.black(' RATE LIMITING '));
    console.log(chalk.yellow(`${box.topLeft}${line}${box.topRight}`));
    console.log(chalk.yellow(`${box.vertical}`) + ` ${chalk.bold('Max Messages:')} ${chalk.cyan(`${RATE_LIMIT_MAX_MESSAGES} per ${RATE_LIMIT_TIME_WINDOW/1000}s`)}${' '.repeat(15)}` + chalk.yellow(`${box.vertical}`));
    console.log(chalk.yellow(`${box.vertical}`) + ` ${chalk.bold('Ban Threshold:')} ${chalk.cyan(`${RATE_LIMIT_BAN_THRESHOLD} violations = ${RATE_LIMIT_BAN_DURATION/1000}s ban`)}${' '.repeat(5)}` + chalk.yellow(`${box.vertical}`));
    console.log(chalk.yellow(`${box.bottomLeft}${line}${box.bottomRight}`));
  }
  
  // Ready message
  console.log(chalk.hex('#00F260')('\n✨ Panda WebAuth is ready to authenticate clients ✨\n'));
};

// Start the server with modern async/await pattern
const startServer = async () => {
  // Display loading animation
  await displayLoadingAnimation();
  
  // Start the server
  server.listen(PORT, () => {
    // Complete the loading sequence
    setTimeout(() => {
      console.log(chalk.green('✓ Server initialization complete!'));
      displayServerInfo(PORT);
    }, 1000);
  });
};

// Start the server
startServer().catch(err => {
  console.error(chalk.red('Failed to start server:'), err);
  process.exit(1);
});
