import os
import json
import logging
import asyncio
import random
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="OBS Streaming Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your Electron app's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBasic()

OBS_HOST = os.getenv("OBS_HOST", "localhost")
OBS_PORT = int(os.getenv("OBS_PORT", "4444"))
OBS_PASSWORD = os.getenv("OBS_PASSWORD", "")
API_USERNAME = os.getenv("API_USERNAME", "admin")
API_PASSWORD = os.getenv("API_PASSWORD", "password")

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

class MockOBSState:
    def __init__(self):
        self.streaming = False
        self.current_scene = "Main Scene"
        self.scenes = ["Main Scene", "Game Scene", "Interview Scene", "Ending Scene"]
        self.connected = True
        self.stats = {
            "fps": 60.0,
            "render-total-frames": 10000,
            "render-missed-frames": 0,
            "output-total-frames": 10000,
            "output-skipped-frames": 0,
            "average-frame-time": 16.67,
            "cpu-usage": 23.5,
            "memory-usage": 1500.0,
            "free-disk-space": 50000.0,
            "kbitsPerSec": 6000
        }
    
    def update_stats(self):
        self.stats["fps"] = 60.0 + random.uniform(-2, 2)
        self.stats["cpu-usage"] = 23.5 + random.uniform(-5, 5)
        self.stats["kbitsPerSec"] = 6000 + random.uniform(-500, 500)
        return self.stats

obs_state = MockOBSState()

class StreamSettings(BaseModel):
    scene_name: Optional[str] = None

class StreamStatus(BaseModel):
    streaming: bool
    scene: Optional[str] = None
    stats: Optional[Dict[str, Any]] = None

def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)):
    if credentials.username != API_USERNAME or credentials.password != API_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

def connect_to_obs():
    logger.info(f"Mock connecting to OBS WebSocket at {OBS_HOST}:{OBS_PORT}")
    obs_state.connected = True
    return obs_state.connected

def get_stream_status():
    if not obs_state.connected:
        return StreamStatus(streaming=False)
    
    obs_state.update_stats()
    
    return StreamStatus(
        streaming=obs_state.streaming,
        scene=obs_state.current_scene,
        stats=obs_state.stats
    )

@app.get("/")
async def root():
    return {"message": "OBS Streaming Backend API"}

@app.get("/status", response_model=StreamStatus)
async def status(username: str = Depends(verify_credentials)):
    if not connect_to_obs():
        raise HTTPException(status_code=503, detail="Could not connect to OBS")
    
    return get_stream_status()

@app.post("/stream/start")
async def start_stream(settings: StreamSettings, username: str = Depends(verify_credentials)):
    if not connect_to_obs():
        raise HTTPException(status_code=503, detail="Could not connect to OBS")
    
    try:
        if settings.scene_name:
            obs_state.current_scene = settings.scene_name
        
        obs_state.streaming = True
        
        status = get_stream_status()
        await manager.broadcast({"event": "stream_started", "data": status.dict()})
        
        return {"message": "Stream started", "status": status}
    except Exception as e:
        logger.error(f"Error starting stream: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start stream: {str(e)}")

@app.post("/stream/stop")
async def stop_stream(username: str = Depends(verify_credentials)):
    if not connect_to_obs():
        raise HTTPException(status_code=503, detail="Could not connect to OBS")
    
    try:
        obs_state.streaming = False
        
        status = get_stream_status()
        await manager.broadcast({"event": "stream_stopped", "data": status.dict()})
        
        return {"message": "Stream stopped", "status": status}
    except Exception as e:
        logger.error(f"Error stopping stream: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to stop stream: {str(e)}")

@app.get("/scenes", response_model=List[str])
async def get_scenes(username: str = Depends(verify_credentials)):
    if not connect_to_obs():
        raise HTTPException(status_code=503, detail="Could not connect to OBS")
    
    try:
        return obs_state.scenes
    except Exception as e:
        logger.error(f"Error getting scenes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get scenes: {str(e)}")

@app.post("/scenes/{scene_name}")
async def set_scene(scene_name: str, username: str = Depends(verify_credentials)):
    if not connect_to_obs():
        raise HTTPException(status_code=503, detail="Could not connect to OBS")
    
    try:
        if scene_name not in obs_state.scenes:
            raise HTTPException(status_code=404, detail=f"Scene '{scene_name}' not found")
        
        obs_state.current_scene = scene_name
        
        status = get_stream_status()
        await manager.broadcast({"event": "scene_changed", "data": status.dict()})
        
        return {"message": f"Scene changed to {scene_name}", "status": status}
    except Exception as e:
        logger.error(f"Error setting scene: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to set scene: {str(e)}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        if connect_to_obs():
            status = get_stream_status()
            await websocket.send_json({"event": "status", "data": status.dict()})
        
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                await websocket.send_json({"event": "ack", "data": message})
            except json.JSONDecodeError:
                await websocket.send_json({"event": "error", "data": "Invalid JSON"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        manager.disconnect(websocket)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(periodic_status_updates())

async def periodic_status_updates():
    while True:
        await asyncio.sleep(5)  # Update every 5 seconds
        if obs_state.streaming:
            status = get_stream_status()
            await manager.broadcast({"event": "status_update", "data": status.dict()})

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down OBS connection")
    obs_state.connected = False

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
