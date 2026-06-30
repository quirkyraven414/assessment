# IoT Telemetry Frontend

React-based frontend for real-time IoT telemetry monitoring via WebSocket.

## Features

- ✅ WebSocket connection to `ws://localhost:8000/ws/telemetry`
- ✅ Real-time telemetry display (Device ID, Temperature, Voltage, Current, Energy, Status)
- ✅ Live alert notifications
- ✅ Connection status indicator
- ✅ Auto-reconnect on disconnect

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The app will open at `http://localhost:3000`

## Requirements

- Backend WebSocket server running at `ws://localhost:8000/ws/telemetry`
- Node.js 14+

## Usage

1. Start the backend WebSocket server
2. Start this React app with `npm start`
3. Send telemetry data to the backend API
4. Watch real-time updates on the dashboard
