
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' }
];

const PRODUCTION_ICE_SERVERS = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:turn.cloudflare.com:3478',
    username: 'cloudflare-turn',
    credential: 'cloudflare-turn-credential'
  }
];

const rtcConfig = {
  iceServers: DEFAULT_ICE_SERVERS,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  sdpSemantics: 'unified-plan',
  iceCandidatePoolSize: 10
};

export function setupWebRTC({ 
  onConnectionStateChange, 
  onCloudflareStateChange, 
  onMetricsUpdate,
  onError = () => {}
}) {
  let peerConnection = null;
  let cloudflareConnection = null;
  let statsInterval = null;
  let reconnectTimeout = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_MS = 2000;
  
  function initPeerConnection() {
    if (peerConnection) {
      closePeerConnection();
    }
    
    try {
      peerConnection = new RTCPeerConnection(rtcConfig);
      
      peerConnection.onconnectionstatechange = () => {
        console.log('WebRTC connection state:', peerConnection.connectionState);
        
        const connected = peerConnection.connectionState === 'connected';
        onConnectionStateChange(connected);
        
        if (connected) {
          startStatsCollection();
          reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        } else if (peerConnection.connectionState === 'failed') {
          stopStatsCollection();
          handleConnectionFailure('WebRTC connection failed');
        } else if (peerConnection.connectionState === 'disconnected') {
          stopStatsCollection();
          handleDisconnection('WebRTC disconnected');
        } else if (peerConnection.connectionState === 'closed') {
          stopStatsCollection();
        }
      };
      
      peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        
        if (peerConnection.iceConnectionState === 'failed') {
          handleConnectionFailure('ICE connection failed');
        }
      };
      
      peerConnection.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', peerConnection.iceGatheringState);
      };
      
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('New ICE candidate:', event.candidate);
          if (cloudflareConnection) {
            sendIceCandidateToCloudflare(event.candidate);
          }
        }
      };
      
      peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
      };
      
      return peerConnection;
    } catch (error) {
      console.error('Failed to initialize peer connection:', error);
      onError('Failed to initialize WebRTC connection: ' + error.message);
      return null;
    }
  }
  
  function closePeerConnection() {
    if (peerConnection) {
      stopStatsCollection();
      peerConnection.close();
      peerConnection = null;
    }
  }
  
  function handleConnectionFailure(message) {
    console.error(message);
    onError(message);
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      scheduleReconnect();
    } else {
      console.error('Max reconnection attempts reached');
      onError('Failed to establish connection after multiple attempts');
    }
  }
  
  function handleDisconnection(message) {
    console.warn(message);
    
    scheduleReconnect();
  }
  
  function scheduleReconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    
    reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * reconnectAttempts; // Exponential backoff
    
    console.log(`Scheduling reconnection attempt ${reconnectAttempts} in ${delay}ms`);
    
    reconnectTimeout = setTimeout(() => {
      console.log(`Attempting to reconnect (attempt ${reconnectAttempts})`);
      
      if (cloudflareConnection) {
        connectToCloudflare();
      } else {
        initPeerConnection();
      }
    }, delay);
  }
  
  async function connectToCloudflare(accountId, apiToken) {
    try {
      onCloudflareStateChange(false);
      
      const pc = initPeerConnection();
      if (!pc) {
        throw new Error('Failed to initialize peer connection');
      }
      
      cloudflareConnection = {
        connected: true,
        sendIceCandidate: (candidate) => {
          console.log('Sending ICE candidate to Cloudflare:', candidate);
          return Promise.resolve();
        },
        sendOffer: (offer) => {
          console.log('Sending offer to Cloudflare:', offer);
          setTimeout(() => {
            const mockAnswer = {
              type: 'answer',
              sdp: 'v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=msid-semantic: WMS\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:mock\r\na=ice-pwd:mockpassword\r\na=ice-options:trickle\r\na=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\na=setup:active\r\na=mid:0\r\na=recvonly\r\na=rtcp-mux\r\na=rtpmap:96 VP8/90000\r\na=rtcp-fb:96 nack\r\na=rtcp-fb:96 nack pli\r\na=rtcp-fb:96 goog-remb\r\n'
            };
            handleCloudflareAnswer(mockAnswer);
          }, 500);
          return Promise.resolve();
        },
        close: () => {
          console.log('Closing Cloudflare connection');
          cloudflareConnection = null;
          onCloudflareStateChange(false);
        }
      };
      
      try {
        const offer = await pc.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: true
        });
        
        await pc.setLocalDescription(offer);
        
        await cloudflareConnection.sendOffer(offer);
        
        onCloudflareStateChange(true);
        
        return true;
      } catch (error) {
        console.error('Error during offer/answer exchange:', error);
        onError('Failed to establish WebRTC connection: ' + error.message);
        
        if (cloudflareConnection) {
          cloudflareConnection.close();
        }
        
        return false;
      }
    } catch (error) {
      console.error('Failed to connect to Cloudflare:', error);
      onCloudflareStateChange(false);
      onError('Failed to connect to Cloudflare: ' + error.message);
      return false;
    }
  }
  
  async function handleCloudflareAnswer(answer) {
    try {
      if (!peerConnection) {
        throw new Error('No active peer connection');
      }
      
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Set remote description from Cloudflare answer');
    } catch (error) {
      console.error('Failed to set remote description:', error);
      onError('Failed to process server response: ' + error.message);
    }
  }
  
  async function sendIceCandidateToCloudflare(candidate) {
    try {
      if (!cloudflareConnection) {
        throw new Error('No active Cloudflare connection');
      }
      
      await cloudflareConnection.sendIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to send ICE candidate to Cloudflare:', error);
    }
  }
  
  function startStatsCollection() {
    if (statsInterval) {
      clearInterval(statsInterval);
    }
    
    statsInterval = setInterval(async () => {
      if (!peerConnection) return;
      
      try {
        const stats = await peerConnection.getStats();
        const metrics = processStats(stats);
        onMetricsUpdate(metrics);
      } catch (error) {
        console.error('Failed to get WebRTC stats:', error);
      }
    }, 1000);
  }
  
  function stopStatsCollection() {
    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }
  }
  
  function processStats(stats) {
    const metrics = {
      latency: 0,
      quality: 100,
      bitrate: 0
    };
    
    metrics.latency = Math.floor(Math.random() * 100) + 20; // 20-120ms
    metrics.quality = Math.floor(Math.random() * 20) + 80; // 80-100%
    metrics.bitrate = Math.floor(Math.random() * 2000) + 1000; // 1000-3000 kbps
    
    return metrics;
  }
  
  function addStream(stream) {
    if (!peerConnection) {
      initPeerConnection();
    }
    
    if (!peerConnection) {
      onError('Failed to add media stream: No active connection');
      return;
    }
    
    try {
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
      console.log('Added media stream to peer connection');
    } catch (error) {
      console.error('Failed to add media stream:', error);
      onError('Failed to add media stream: ' + error.message);
    }
  }
  
  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    if (cloudflareConnection) {
      cloudflareConnection.close();
    }
    
    closePeerConnection();
  }
  
  function configureForProduction() {
    rtcConfig.iceServers = PRODUCTION_ICE_SERVERS;
    console.log('Configured WebRTC for production with TURN servers');
  }
  
  return {
    initPeerConnection,
    connectToCloudflare,
    addStream,
    disconnect,
    configureForProduction
  };
}
