from fastapi import WebSocket
from typing import Dict
import json


class ConnectionManager:
    def __init__(self):
        # meeting_id -> { participant_id: WebSocket }
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, meeting_id: str, participant_id: str, websocket: WebSocket):
        await websocket.accept()
        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = {}
        self.active_connections[meeting_id][participant_id] = websocket

    def disconnect(self, meeting_id: str, participant_id: str):
        if meeting_id in self.active_connections:
            if participant_id in self.active_connections[meeting_id]:
                del self.active_connections[meeting_id][participant_id]
            if not self.active_connections[meeting_id]:
                del self.active_connections[meeting_id]

    async def send_to_peer(self, meeting_id: str, target_id: str, message: dict):
        if meeting_id in self.active_connections and target_id in self.active_connections[meeting_id]:
            try:
                await self.active_connections[meeting_id][target_id].send_json(message)
            except Exception:
                pass

    async def broadcast_to_room(self, meeting_id: str, message: dict, sender_id: str):
        if meeting_id in self.active_connections:
            for pid, connection in list(self.active_connections[meeting_id].items()):
                if pid != sender_id:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        pass


manager = ConnectionManager()
