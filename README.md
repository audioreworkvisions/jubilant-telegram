# Electron OBS Streaming App

A desktop application that integrates OBS Studio with WebRTC and Cloudflare Calls for real-time streaming.

## Features

- Electron desktop application with JavaScript frontend
- Python FastAPI backend for local communication
- OBS Studio integration via obs-websocket
- Real-time streaming using WebRTC and Cloudflare Calls
- Stream control (start/stop), scene selection, and status monitoring

## Setup

### Prerequisites

- Node.js and npm
- Python 3.11.9
- OBS Studio with obs-websocket plugin installed
- Cloudflare account with Calls API access

### Installation

1. Clone this repository
2. Install backend dependencies:
   ```
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate.bat
   pip install -r requirements.txt
   ```
3. Install frontend dependencies:
   ```
   cd frontend
   npm install
   ```

### Running the Application

1. Start the backend server:
   ```
   cd backend
   source venv/bin/activate  # On Windows: venv\Scripts\activate.bat
   python -m app.main
   ```
2. Start the Electron app:
   ```
   cd frontend
   npm start
   ```

## Project Structure

- `backend/`: FastAPI backend server
- `frontend/`: Electron application frontend
