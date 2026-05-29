#!/bin/bash
# Run the simulation binary and nginx together. If either process exits, take the
# whole container down so orchestration (compose/k8s) can restart it.
set -e

/app/sim &
SIM_PID=$!

nginx -g 'daemon off;' &
NGINX_PID=$!

# Wait for whichever process exits first, then stop the other and propagate failure.
wait -n "$SIM_PID" "$NGINX_PID"
EXIT_CODE=$?

kill "$SIM_PID" "$NGINX_PID" 2>/dev/null || true
exit "$EXIT_CODE"
