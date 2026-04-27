from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Store active sessions in memory
active_journeys = {}

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "NHAI Python Backend Live",
        "sessions": len(active_journeys)
    })

@socketio.on('connect')
def handle_connect():
    print(f"User connected: {request.sid}")

@socketio.on('join-trip')
def handle_join_trip(trip_id):
    join_room(trip_id)
    print(f"Socket {request.sid} joined trip {trip_id}")

@socketio.on('send-sos')
def handle_sos(sos_data):
    print('SOS Received:', sos_data)
    sos_data['serverTimestamp'] = datetime.now().isoformat()
    # Broadcast to all connected clients (including admins)
    emit('new-sos-alert', sos_data, broadcast=True)

@socketio.on('admin-broadcast')
def handle_admin_broadcast(alert_data):
    print('Admin Broadcast:', alert_data)
    # Broadcast to all connected clients
    emit('broadcast-alert', alert_data, broadcast=True)

@socketio.on('update-position')
def handle_position_update(data):
    trip_id = data.get('tripId')
    if trip_id:
        active_journeys[trip_id] = {
            'lat': data.get('lat'),
            'lng': data.get('lng'),
            'lastUpdate': datetime.now().isoformat()
        }
        # Broadcast to anyone tracking this trip
        emit('vehicle-moved', data, room=trip_id, include_self=False)

@socketio.on('disconnect')
def handle_disconnect():
    print(f"User disconnected: {request.sid}")

if __name__ == '__main__':
    print("NHAI Real-time Server running on http://localhost:3000")
    socketio.run(app, port=3000, debug=False)
