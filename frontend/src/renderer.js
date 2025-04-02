import './styles.css';
import { setupWebRTC } from './webrtc';
import { setupOBSControls } from './obs-controls';

const state = {
  streaming: false,
  currentScene: null,
  scenes: [],
  obsConnected: false,
  webrtcConnected: false,
  cloudflareConnected: false,
  connectionError: false,
  metrics: {
    latency: null,
    quality: null,
    bitrate: null
  }
};

let statusIndicator;
let statusText;
let latencyValue;
let qualityValue;
let bitrateValue;
let sceneSelect;
let startStreamBtn;
let stopStreamBtn;
let obsStatus;
let webrtcStatus;
let cloudflareStatus;

let backendUrl = 'http://localhost:8000';

let ws = null;
let webrtc = null;
let obsControls = null;
let wsReconnectAttempts = 0;
const MAX_WS_RECONNECT_ATTEMPTS = 10;
const WS_RECONNECT_BASE_DELAY = 1000;

function createErrorToast() {
  let errorToast = document.getElementById('error-toast');
  if (!errorToast) {
    errorToast = document.createElement('div');
    errorToast.id = 'error-toast';
    errorToast.className = 'error-toast';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'error-toast-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      errorToast.classList.remove('show');
    });
    errorToast.appendChild(closeBtn);
    
    const messageContainer = document.createElement('div');
    messageContainer.className = 'error-toast-message';
    errorToast.appendChild(messageContainer);
    
    document.body.appendChild(errorToast);
    
    if (!document.querySelector('style#error-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'error-toast-styles';
      style.textContent = `
        .error-toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background-color: var(--danger-color);
          color: white;
          padding: 15px;
          border-radius: 5px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          display: flex;
          align-items: flex-start;
          max-width: 350px;
          z-index: 1000;
          transform: translateY(100px);
          opacity: 0;
          transition: transform 0.3s, opacity 0.3s;
        }
        .error-toast.show {
          transform: translateY(0);
          opacity: 1;
        }
        .error-toast-close {
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          margin-right: 10px;
          padding: 0 5px;
        }
        .error-toast-message {
          flex: 1;
        }
      `;
      document.head.appendChild(style);
    }
  }
  return errorToast;
}

function showError(message) {
  console.error(message);
  
  if (window.api) {
    window.api.log('error', message);
  }
  
  state.connectionError = true;
  updateStatusIndicator();
  updateStreamControls();
  
  const errorToast = createErrorToast();
  const messageContainer = errorToast.querySelector('.error-toast-message');
  messageContainer.textContent = message;
  
  errorToast.classList.add('show');
  
  setTimeout(() => {
    errorToast.classList.remove('show');
  }, 5000);
}

async function init() {
  statusIndicator = document.getElementById('status-indicator');
  statusText = document.getElementById('status-text');
  latencyValue = document.getElementById('latency-value');
  qualityValue = document.getElementById('quality-value');
  bitrateValue = document.getElementById('bitrate-value');
  sceneSelect = document.getElementById('scene-select');
  startStreamBtn = document.getElementById('start-stream');
  stopStreamBtn = document.getElementById('stop-stream');
  obsStatus = document.getElementById('obs-status');
  webrtcStatus = document.getElementById('webrtc-status');
  cloudflareStatus = document.getElementById('cloudflare-status');

  if (window.api) {
    try {
      backendUrl = await window.api.getBackendUrl();
      console.log(`Using backend URL: ${backendUrl}`);
    } catch (error) {
      console.error('Failed to get backend URL from main process:', error);
    }
  }

  startStreamBtn.addEventListener('click', startStream);
  stopStreamBtn.addEventListener('click', stopStream);
  sceneSelect.addEventListener('change', changeScene);

  webrtc = setupWebRTC({
    onConnectionStateChange: handleWebRTCStateChange,
    onCloudflareStateChange: handleCloudflareStateChange,
    onMetricsUpdate: updateMetrics,
    onError: (errorMessage) => {
      showError(`WebRTC Error: ${errorMessage}`);
      updateConnectionStatus('webrtc', false);
    }
  });

  obsControls = setupOBSControls({
    backendUrl,
    onSceneListUpdate: updateSceneList,
    onStatusUpdate: updateStatus,
    onError: (errorMessage) => {
      showError(`OBS Error: ${errorMessage}`);
      updateConnectionStatus('obs', false);
    }
  });

  connectWebSocket();
  checkStatus();
  
  createErrorToast();
}

function connectWebSocket() {
  const wsUrl = backendUrl.replace('http', 'ws') + '/ws';
  
  if (ws) {
    ws.close();
  }
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    wsReconnectAttempts = 0;
    updateConnectionStatus('obs', true);
  };
  
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateConnectionStatus('obs', false);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    updateConnectionStatus('obs', false);
    
    if (wsReconnectAttempts < MAX_WS_RECONNECT_ATTEMPTS) {
      const delay = Math.min(
        WS_RECONNECT_BASE_DELAY * Math.pow(1.5, wsReconnectAttempts),
        30000 // Max 30 seconds
      );
      
      wsReconnectAttempts++;
      console.log(`WebSocket reconnecting in ${delay}ms (attempt ${wsReconnectAttempts}/${MAX_WS_RECONNECT_ATTEMPTS})...`);
      
      setTimeout(connectWebSocket, delay);
    } else {
      showError('Failed to connect to server after multiple attempts');
    }
  };
}

function handleWebSocketMessage(message) {
  console.log('Received WebSocket message:', message);
  
  switch (message.event) {
    case 'status':
    case 'status_update':
    case 'stream_started':
    case 'stream_stopped':
    case 'scene_changed':
      if (message.data) {
        updateStatus(message.data);
      }
      break;
    case 'error':
      if (message.data) {
        showError(`Server Error: ${message.data}`);
      }
      break;
    default:
      console.log('Unknown WebSocket event:', message.event);
  }
}

async function checkStatus() {
  try {
    statusIndicator.className = 'status-connecting';
    statusText.textContent = 'Connecting...';
    
    const response = await fetch(`${backendUrl}/status`, {
      headers: {
        'Authorization': 'Basic ' + btoa('admin:password')
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      updateStatus(data);
      updateConnectionStatus('obs', true);
      state.connectionError = false;
    } else {
      const error = await response.json();
      showError(`Server Error: ${error.detail || 'Failed to connect to server'}`);
      updateConnectionStatus('obs', false);
    }
  } catch (error) {
    console.error('Failed to check status:', error);
    showError(`Connection Error: ${error.message || 'Failed to connect to server'}`);
    updateConnectionStatus('obs', false);
  } finally {
    updateStatusIndicator();
    updateStreamControls();
  }
}

async function startStream() {
  try {
    startStreamBtn.disabled = true;
    stopStreamBtn.disabled = true;
    statusIndicator.className = 'status-connecting';
    statusText.textContent = 'Connecting...';
    
    webrtc.configureForProduction();
    
    const cloudflareConnected = await webrtc.connectToCloudflare();
    if (!cloudflareConnected) {
      throw new Error('Failed to connect to Cloudflare');
    }
    
    const scene = sceneSelect.value;
    const response = await fetch(`${backendUrl}/stream/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa('admin:password')
      },
      body: JSON.stringify({
        scene_name: scene || undefined
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      updateStatus(data.status);
      state.connectionError = false;
      
      if (window.api) {
        window.api.log('info', `Started streaming with scene: ${scene}`);
      }
    } else {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start stream');
    }
  } catch (error) {
    console.error('Error starting stream:', error);
    showError(`Failed to start stream: ${error.message}`);
    
    webrtc.disconnect();
  } finally {
    updateStatusIndicator();
    updateStreamControls();
  }
}

async function stopStream() {
  try {
    stopStreamBtn.disabled = true;
    startStreamBtn.disabled = true;
    statusIndicator.className = 'status-connecting';
    statusText.textContent = 'Disconnecting...';
    
    const response = await fetch(`${backendUrl}/stream/stop`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('admin:password')
      }
    });
    
    webrtc.disconnect();
    
    if (response.ok) {
      const data = await response.json();
      updateStatus(data.status);
      state.connectionError = false;
      
      if (window.api) {
        window.api.log('info', 'Stopped streaming');
      }
    } else {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to stop stream');
    }
  } catch (error) {
    console.error('Error stopping stream:', error);
    showError(`Failed to stop stream: ${error.message}`);
    
    state.streaming = false;
  } finally {
    updateStatusIndicator();
    updateStreamControls();
  }
}

async function changeScene() {
  const scene = sceneSelect.value;
  if (!scene) return;
  
  try {
    sceneSelect.disabled = true;
    
    const response = await fetch(`${backendUrl}/scenes/${scene}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('admin:password')
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      updateStatus(data.status);
      
      if (window.api) {
        window.api.log('info', `Changed scene to: ${scene}`);
      }
    } else {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to change scene');
    }
  } catch (error) {
    console.error('Error changing scene:', error);
    showError(`Failed to change scene: ${error.message}`);
  } finally {
    sceneSelect.disabled = false;
  }
}

async function updateSceneList() {
  try {
    const response = await fetch(`${backendUrl}/scenes`, {
      headers: {
        'Authorization': 'Basic ' + btoa('admin:password')
      }
    });
    
    if (response.ok) {
      const scenes = await response.json();
      state.scenes = scenes;
      
      sceneSelect.innerHTML = '';
      scenes.forEach(scene => {
        const option = document.createElement('option');
        option.value = scene;
        option.textContent = scene;
        sceneSelect.appendChild(option);
      });
      
      if (state.currentScene && scenes.includes(state.currentScene)) {
        sceneSelect.value = state.currentScene;
      }
    } else {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get scenes');
    }
  } catch (error) {
    console.error('Failed to get scenes:', error);
    showError(`Failed to get scenes: ${error.message}`);
  }
}

function updateStatus(status) {
  if (!status) return;
  
  state.streaming = status.streaming;
  state.currentScene = status.scene;
  
  if (status.scene && sceneSelect.querySelector(`option[value="${status.scene}"]`)) {
    sceneSelect.value = status.scene;
  }
  
  if (status.stats) {
    updateMetrics({
      bitrate: status.stats.kbitsPerSec,
    });
  }
  
  updateStatusIndicator();
  updateStreamControls();
}

function updateStreamControls() {
  startStreamBtn.disabled = state.streaming || state.connectionError;
  stopStreamBtn.disabled = !state.streaming || state.connectionError;
  sceneSelect.disabled = state.connectionError;
}

function updateStatusIndicator() {
  if (state.connectionError) {
    statusIndicator.className = 'status-error';
    statusText.textContent = 'Error';
  } else if (state.streaming) {
    statusIndicator.className = 'status-online';
    statusText.textContent = 'Online';
  } else {
    statusIndicator.className = 'status-offline';
    statusText.textContent = 'Offline';
  }
}

function updateConnectionStatus(type, connected) {
  switch (type) {
    case 'obs':
      state.obsConnected = connected;
      obsStatus.textContent = connected ? 'Connected' : 'Not Connected';
      obsStatus.style.color = connected ? 'var(--success-color)' : 'var(--danger-color)';
      break;
    case 'webrtc':
      state.webrtcConnected = connected;
      webrtcStatus.textContent = connected ? 'Connected' : 'Not Connected';
      webrtcStatus.style.color = connected ? 'var(--success-color)' : 'var(--danger-color)';
      break;
    case 'cloudflare':
      state.cloudflareConnected = connected;
      cloudflareStatus.textContent = connected ? 'Connected' : 'Not Connected';
      cloudflareStatus.style.color = connected ? 'var(--success-color)' : 'var(--danger-color)';
      break;
  }
  
  state.connectionError = !(state.obsConnected || (state.webrtcConnected && state.cloudflareConnected));
  updateStatusIndicator();
  updateStreamControls();
}

function handleWebRTCStateChange(connected) {
  updateConnectionStatus('webrtc', connected);
}

function handleCloudflareStateChange(connected) {
  updateConnectionStatus('cloudflare', connected);
}

function updateMetrics(metrics) {
  if (metrics.latency !== undefined) {
    state.metrics.latency = metrics.latency;
    latencyValue.textContent = `${metrics.latency} ms`;
  }
  
  if (metrics.quality !== undefined) {
    state.metrics.quality = metrics.quality;
    qualityValue.textContent = `${metrics.quality}%`;
  }
  
  if (metrics.bitrate !== undefined) {
    state.metrics.bitrate = metrics.bitrate;
    bitrateValue.textContent = `${metrics.bitrate} kbps`;
  }
}

document.addEventListener('DOMContentLoaded', init);
