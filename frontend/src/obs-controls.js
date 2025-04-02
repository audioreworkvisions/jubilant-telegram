
const defaultOptions = {
  backendUrl: 'http://localhost:8000',
  onSceneListUpdate: () => {},
  onStatusUpdate: () => {}
};

export function setupOBSControls(options = {}) {
  const { backendUrl, onSceneListUpdate, onStatusUpdate } = { ...defaultOptions, ...options };
  
  const authHeaders = {
    'Authorization': 'Basic ' + btoa('admin:password')
  };
  
  async function getStatus() {
    try {
      const response = await fetch(`${backendUrl}/status`, {
        headers: authHeaders
      });
      
      if (response.ok) {
        const status = await response.json();
        onStatusUpdate(status);
        return status;
      } else {
        const error = await response.json();
        console.error('Failed to get status:', error);
        return null;
      }
    } catch (error) {
      console.error('Error getting status:', error);
      return null;
    }
  }
  
  async function getScenes() {
    try {
      const response = await fetch(`${backendUrl}/scenes`, {
        headers: authHeaders
      });
      
      if (response.ok) {
        const scenes = await response.json();
        onSceneListUpdate(scenes);
        return scenes;
      } else {
        const error = await response.json();
        console.error('Failed to get scenes:', error);
        return [];
      }
    } catch (error) {
      console.error('Error getting scenes:', error);
      return [];
    }
  }
  
  async function startStream(sceneName) {
    try {
      const response = await fetch(`${backendUrl}/stream/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          scene_name: sceneName || undefined
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        onStatusUpdate(data.status);
        return data;
      } else {
        const error = await response.json();
        console.error('Failed to start stream:', error);
        throw new Error(error.detail || 'Failed to start stream');
      }
    } catch (error) {
      console.error('Error starting stream:', error);
      throw error;
    }
  }
  
  async function stopStream() {
    try {
      const response = await fetch(`${backendUrl}/stream/stop`, {
        method: 'POST',
        headers: authHeaders
      });
      
      if (response.ok) {
        const data = await response.json();
        onStatusUpdate(data.status);
        return data;
      } else {
        const error = await response.json();
        console.error('Failed to stop stream:', error);
        throw new Error(error.detail || 'Failed to stop stream');
      }
    } catch (error) {
      console.error('Error stopping stream:', error);
      throw error;
    }
  }
  
  async function setScene(sceneName) {
    try {
      const response = await fetch(`${backendUrl}/scenes/${sceneName}`, {
        method: 'POST',
        headers: authHeaders
      });
      
      if (response.ok) {
        const data = await response.json();
        onStatusUpdate(data.status);
        return data;
      } else {
        const error = await response.json();
        console.error('Failed to set scene:', error);
        throw new Error(error.detail || 'Failed to set scene');
      }
    } catch (error) {
      console.error('Error setting scene:', error);
      throw error;
    }
  }
  
  async function initialize() {
    await getStatus();
    await getScenes();
  }
  
  return {
    initialize,
    getStatus,
    getScenes,
    startStream,
    stopStream,
    setScene
  };
}
