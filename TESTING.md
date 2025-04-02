# Testing Criteria for Electron-OBS Streaming Application

This document outlines the testing criteria for the Electron-OBS Streaming application with FastAPI backend, WebRTC, and Cloudflare Calls integration.

## 1. Electron Frontend Testing

### UI Components
- [ ] Main window displays correctly with proper layout and styling
- [ ] Stream status indicator shows online/offline state correctly
- [ ] Streaming metrics (latency, quality, bitrate) display correctly
- [ ] Scene selector dropdown populates with available scenes from OBS
- [ ] Start/Stop buttons are enabled/disabled based on current streaming state
- [ ] Connection status indicators for OBS, WebRTC, and Cloudflare display correctly

### User Interactions
- [ ] Clicking Start Stream button initiates streaming with selected scene
- [ ] Clicking Stop Stream button stops the active stream
- [ ] Changing scene in dropdown updates the current scene in OBS
- [ ] UI provides visual feedback during loading/connecting states
- [ ] Error messages display correctly when operations fail

### WebRTC Integration
- [ ] WebRTC peer connection initializes correctly
- [ ] ICE candidates are gathered and processed
- [ ] Connection to Cloudflare Calls SFU is established
- [ ] TURN server configuration is applied correctly
- [ ] Stream statistics are collected and displayed
- [ ] Connection state changes are handled properly
- [ ] Reconnection attempts occur automatically after disconnection

## 2. FastAPI Backend Testing

### API Endpoints
- [ ] GET / returns welcome message
- [ ] GET /status returns current streaming status
- [ ] POST /stream/start initiates streaming with optional scene selection
- [ ] POST /stream/stop stops the active stream
- [ ] GET /scenes returns list of available scenes
- [ ] POST /scenes/{scene_name} changes the current scene

### WebSocket Support
- [ ] WebSocket connection can be established at /ws
- [ ] Initial status is sent upon connection
- [ ] Status updates are broadcast to all connected clients
- [ ] Events for stream_started, stream_stopped, and scene_changed are broadcast
- [ ] Connection is properly closed when client disconnects

### Authentication & Security
- [ ] API endpoints require Basic Authentication
- [ ] Invalid credentials result in 401 Unauthorized response
- [ ] CORS middleware allows Electron app to communicate with backend
- [ ] Sensitive information (passwords, tokens) is not exposed in logs or responses

### Error Handling
- [ ] Appropriate HTTP status codes are returned for different error conditions
- [ ] Error responses include descriptive messages
- [ ] Exceptions are properly caught and handled
- [ ] Logging provides useful information for debugging

## 3. OBS Integration Testing

### Connection
- [ ] Backend successfully connects to OBS WebSocket
- [ ] Connection errors are properly handled and reported
- [ ] Reconnection attempts occur automatically after disconnection

### Streaming Control
- [ ] Starting stream in OBS works correctly
- [ ] Stopping stream in OBS works correctly
- [ ] Changing scenes in OBS works correctly
- [ ] Stream status is correctly reported from OBS to backend

### Error Handling
- [ ] OBS connection failures are properly handled
- [ ] OBS command failures are properly handled
- [ ] Error messages are propagated to the frontend

## 4. Cloudflare Calls Integration Testing

### Connection
- [ ] WebRTC connection to Cloudflare Calls SFU is established
- [ ] SFU configuration is applied correctly
- [ ] TURN server configuration is applied correctly

### Streaming
- [ ] Video/audio streams are properly sent to Cloudflare Calls
- [ ] Stream quality and bitrate are appropriate
- [ ] Latency is within acceptable range

### Error Handling
- [ ] Connection failures are properly handled
- [ ] Reconnection attempts occur automatically after disconnection
- [ ] Error messages are displayed to the user

## 5. End-to-End Testing

### Core Workflow
- [ ] Launch Electron app and connect to backend
- [ ] Connect to OBS and retrieve scenes
- [ ] Start streaming with selected scene
- [ ] Verify stream is active in OBS and metrics are displayed
- [ ] Change scene and verify change is reflected
- [ ] Stop streaming and verify stream is stopped in OBS
- [ ] Close application and verify all connections are properly closed

### Error Scenarios
- [ ] Test behavior when OBS is not running
- [ ] Test behavior when backend is not running
- [ ] Test behavior when Cloudflare Calls connection fails
- [ ] Test behavior when network connection is lost
- [ ] Test behavior when invalid credentials are provided

## 6. Performance Testing

- [ ] Application startup time is reasonable
- [ ] UI remains responsive during streaming
- [ ] Memory usage remains stable during extended streaming
- [ ] CPU usage remains within acceptable range
- [ ] Network bandwidth usage is appropriate for the stream quality

## 7. Security Testing

- [ ] Authentication is required for all sensitive operations
- [ ] Communication between frontend and backend is secure
- [ ] WebRTC connections use proper encryption
- [ ] No sensitive information is exposed in logs or UI
- [ ] Error messages do not reveal implementation details

## Testing Environment Setup

1. Install and configure OBS Studio with obs-websocket plugin
2. Set up Cloudflare Calls account and obtain necessary credentials
3. Configure .env file with appropriate settings
4. Start backend server: `cd backend && python -m app.main`
5. Start Electron app: `cd frontend && npm start`

## Notes for Mock Testing

For the MVP implementation, we're using mock implementations for:
- OBS WebSocket connection (simulated in backend)
- Cloudflare Calls connection (simulated in frontend)

These mocks allow testing the application flow without requiring actual OBS Studio installation or Cloudflare Calls account.
