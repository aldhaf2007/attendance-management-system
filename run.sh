#!/bin/bash

# Kill any previous dangling server instances on ports 8000 and 3000
echo "=================================================="
echo " Preparing College Attendance Tracker Web App"
echo "=================================================="

echo "Ensuring ports 8000 (Backend) and 3000 (Frontend) are free..."
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
pkill -f "uvicorn app.main:app" 2>/dev/null || true
sleep 1

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    fuser -k 8000/tcp 2>/dev/null || true
    fuser -k 3000/tcp 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Activate virtual environment
source venv/bin/activate

# Ensure MySQL database attendance_db exists
if command -v mysql &>/dev/null; then
    echo "Ensuring MySQL database 'attendance_db' is active..."
    mysql -u root -e "CREATE DATABASE IF NOT EXISTS attendance_db;" 2>/dev/null || true
fi

# Clean bytecode caches to ensure fresh code is always loaded
find app/ -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# Initialize database schema and verify root admin user
echo "Initializing database schema..."
python init_db.py

# 1. Start FastAPI Backend in background with hot-reloading
echo "Starting FastAPI Backend on http://localhost:8000 ..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 2. Start Vite Frontend in background
echo "Starting React Frontend on http://localhost:3000 ..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo "=================================================="
echo " App is running!"
echo " Frontend: http://localhost:3000"
echo " Backend API: http://localhost:8000/docs"
echo " Database Engine: MySQL (mysql+aiomysql)"
echo " Press Ctrl+C to stop all servers."
echo "=================================================="

# Wait for background processes
wait $BACKEND_PID $FRONTEND_PID
