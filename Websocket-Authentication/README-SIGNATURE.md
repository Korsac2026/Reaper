# WebSocket System with Signature Verification

This document explains the signature verification mechanism added to the WebSocket system with heartbeat functionality.

## Overview

The signature verification system adds an extra layer of security to prevent:

1. **Message Tampering**: Ensures messages haven't been modified in transit
2. **Message Spoofing**: Verifies the sender is authentic
3. **Replay Attacks**: Uses challenge-response mechanisms with expiring tokens
4. **Man-in-the-Middle Attacks**: Detects unauthorized message interception

## How It Works

### 1. Message Signing

Every message sent between client and server includes a cryptographic signature:

```json
{
  "type": "validate",
  "serviceId": "example_service",
  "hwid": "example_hwid",
  "key": "example_key",
  "signature": "a1b2c3d4e5f6..."  // HMAC-SHA256 signature
}
```

The signature is generated using HMAC-SHA256 with a shared secret key:

```javascript
// Server-side (Node.js)
function generateSignature(message, secretKey) {
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(typeof message === 'string' ? message : JSON.stringify(message));
  return hmac.digest('hex');
}

// Client-side (Browser)
async function generateSignature(message, secretKey) {
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
  const encoder = new TextEncoder();
  const messageData = encoder.encode(messageStr);
  const keyData = encoder.encode(secretKey);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### 2. Challenge-Response Mechanism

The server issues challenge tokens that the client must sign correctly:

1. **Server sends challenge**: `{ "challengeToken": "random_token_123" }`
2. **Client signs challenge**: `HMAC-SHA256(random_token_123, CLIENT_SECRET_KEY)`
3. **Server verifies signature**: Confirms client possesses the correct secret key

Challenges expire after a short time (60 seconds) to prevent replay attacks.

### 3. Key Management

- **Client Secret Keys**: Unique to each client, stored securely on both client and server
- **Server Secret Key**: Used by the server to sign its messages to clients

In a production environment, these keys should be:
- Stored in a secure key management system
- Rotated periodically
- Never exposed in client-side code (use secure authentication to obtain keys)

## Implementation Files

1. **`server-with-signature.js`**: Enhanced server with signature verification
2. **`client-with-signature.js`**: Command-line client with signature support
3. **`web-client-with-signature.html`**: Browser-based client with signature support

## Using the System

### Starting the Server

```bash
node server-with-signature.js
```

### Using the Command-line Client

```bash
node client-with-signature.js
```

### Using the Web Client

Open `web-client-with-signature.html` in a browser.

## Security Considerations

1. **Secret Key Protection**: In a production environment, never hardcode secret keys
2. **HTTPS/WSS**: Always use secure WebSocket connections (WSS) in production
3. **Key Rotation**: Implement a system to periodically rotate keys
4. **Rate Limiting**: Add rate limiting to prevent brute force attacks
5. **Timing Attacks**: Use constant-time comparison for signature verification

## Integration with Roblox

For Roblox integration, you would need to:

1. Implement the HMAC-SHA256 algorithm in Lua
2. Securely store and retrieve client keys
3. Use HTTP requests to communicate with the WebSocket server via a proxy

Example Roblox implementation of HMAC-SHA256 (requires a Lua HMAC library):

```lua
-- This is a simplified example and would need a proper HMAC implementation
function generateSignature(message, secretKey)
    local messageStr = typeof(message) == "string" and message or HttpService:JSONEncode(message)
    return hmac_sha256(messageStr, secretKey)
end

function verifySignature(message, signature, secretKey)
    local expectedSignature = generateSignature(message, secretKey)
    return expectedSignature == signature
end
```

## Anti-Exploit Protection

This signature verification system provides strong protection against:

1. **Function Hooking**: External validation can't be compromised by hooking local functions
2. **Memory Manipulation**: Challenge-response verifies client integrity
3. **Packet Interception**: Signatures detect modified network traffic
4. **Replay Attacks**: Expiring tokens prevent reuse of captured messages

By combining WebSockets, heartbeats, and cryptographic signatures, this system creates a robust security layer that's extremely difficult for exploiters to bypass.
