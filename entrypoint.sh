#!/bin/bash
set -e

echo "=================================================="
echo " Starting ARIGNAR ANNA COLLEGE Attendance System"
echo " Environment: ${ENVIRONMENT:-production}"
echo " Port: ${PORT:-8000}"
echo "=================================================="

# Wait for remote database to become reachable if host is specified
if [[ "$DATABASE_URL" == *"@"* ]]; then
    DB_HOST=$(echo "$DATABASE_URL" | sed -e 's/.*@//' -e 's/\/.*//' -e 's/:.*//')
    DB_PORT=$(echo "$DATABASE_URL" | sed -e 's/.*@//' -e 's/\/.*//' | grep -o ':[0-9]*' | tr -d ':' || echo "3306")
    if [ -z "$DB_PORT" ]; then
        DB_PORT=3306
    fi
    echo "Verifying database connection at $DB_HOST:$DB_PORT..."
    for i in {1..30}; do
        if python -c "import socket; s = socket.create_connection(('$DB_HOST', int('$DB_PORT')), timeout=2); s.close()" 2>/dev/null; then
            echo "Database is ready!"
            break
        fi
        echo "Waiting for database at $DB_HOST:$DB_PORT... ($i/30)"
        sleep 2
    done
fi

# Ensure database schema is initialized and root admin exists
echo "Initializing database schema..."
python init_db.py || echo "Warning: init_db.py completed with warnings or database already initialized."

# Launch Uvicorn with production proxy headers
PORT="${PORT:-8000}"
WORKERS="${WEB_CONCURRENCY:-2}"

echo "Launching application on port $PORT with $WORKERS worker(s)..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers "$WORKERS" --proxy-headers --forwarded-allow-ips='*'
