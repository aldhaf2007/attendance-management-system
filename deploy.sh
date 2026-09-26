#!/bin/bash
set -e

echo "=================================================="
echo " ARIGNAR ANNA COLLEGE Attendance System Deployment"
echo "=================================================="

# 1. Environment check
if [ ! -f .env ]; then
    if [ -f .env.production.example ]; then
        echo "Warning: .env not found. Creating from .env.production.example..."
        cp .env.production.example .env
        echo "Please configure your .env file with your production database credentials."
    fi
fi

# 2. Python Virtual Environment
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing/Updating Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# 3. Build React Frontend SPA
echo "Building React frontend production bundle..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run build
cd ..

# 4. Database Schema Migration and Verification
echo "Verifying database schema..."
python init_db.py

# 5. Verification: Run Automated Test Suite
echo "Running automated verification tests..."
pytest tests/test_backend.py

echo "=================================================="
echo " Deployment build completed successfully!"
echo " To run in production:"
echo "   uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"
echo "=================================================="
