# WebSocket System with Heartbeat and Validation

This project implements a WebSocket server with heartbeat functionality and client validation against an external API.

## Features

- WebSocket server with client connection management
- Heartbeat mechanism to detect disconnected clients
- Client validation against external API
- Example client implementation

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

## Usage

### Starting the Server

```bash
node server.js
```

The server will start on port 3000 by default.

### Using the Example Client

```bash
node client.js
```

The example client connects to the WebSocket server and provides a simple command-line interface to test validation.

Available commands:
- `validate` - Send a validation request to the server
- `exit` - Close the connection and exit

## API Validation

The server validates clients by making a request to:
```
https://pandadevelopment.net/v2_validation?service=(service_id)&hwid=(hwid_here)&key=(client_keys)
```

A successful validation requires the response to contain `"V2_Authentication": "success"`.

## WebSocket Protocol

### Connection

Connect to the WebSocket server with validation parameters:
```
ws://localhost:3000/?serviceId=YOUR_SERVICE_ID&hwid=YOUR_HWID&key=YOUR_CLIENT_KEY
```

### Messages

#### Client to Server:

1. Validation Request:
```json
{
  "type": "validate",
  "serviceId": "your_service_id",
  "hwid": "your_hwid",
  "key": "your_client_key"
}
```

2. Heartbeat:
```json
{
  "type": "heartbeat"
}
```

#### Server to Client:

1. Welcome Message:
```json
{
  "type": "welcome",
  "message": "Connected to WebSocket server",
  "clientId": "unique_id"
}
```

2. Validation Response:
```json
{
  "type": "validation_response",
  "success": true|false,
  "message": "Authentication successful|failed",
  "data": { /* validation data */ }
}
```

3. Heartbeat Response:
```json
{
  "type": "heartbeat_response",
  "timestamp": 1621234567890
}
```

## Heartbeat Mechanism

The server sends ping frames every 30 seconds. Clients must respond with pong frames to stay connected.
Additionally, clients can send explicit heartbeat messages to confirm their connection status.

If a client fails to respond to heartbeats for more than 35 seconds, it will be disconnected.
