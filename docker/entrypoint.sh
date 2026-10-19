#!/bin/sh
# Supervises the Node processes bundled in the final image.
#
# Render (port 5173) proxies both /api/auth/* and /api/ai/* so the SPA stays
# single-origin. If auth-service or ai-service dies, app behavior degrades even
# while render /health still returns 200.
#
# This script exits non-zero with explicit logs naming the dead process so the
# platform restarts the container and root cause remains visible in logs.

RENDER_CMD=${RENDER_CMD:-"node dist/server.js"}
AUTH_CMD=${AUTH_CMD:-"/app/auth-service/node_modules/.bin/tsx auth-service/src/server.ts"}
AI_CMD=${AI_CMD:-"/app/ai-service/node_modules/.bin/tsx ai-service/src/server.ts"}

log() {
  printf '%s [entrypoint] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"
}

render_pid=''
auth_pid=''
ai_pid=''

stop_children() {
  for pid in $ai_pid $auth_pid $render_pid; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null
  done
}

on_signal() {
  log "received termination signal, stopping ai-service, auth-service, and render-service"
  stop_children
  wait 2>/dev/null
  log "shutdown complete"
  exit 0
}

trap on_signal TERM INT

log "starting render-service: $RENDER_CMD"
# shellcheck disable=SC2086
sh -c "$RENDER_CMD" &
render_pid=$!

log "starting auth-service: $AUTH_CMD"
# shellcheck disable=SC2086
sh -c "$AUTH_CMD" &
auth_pid=$!

log "starting ai-service: $AI_CMD"
# shellcheck disable=SC2086
sh -c "$AI_CMD" &
ai_pid=$!

log "render-service pid=$render_pid auth-service pid=$auth_pid ai-service pid=$ai_pid"

# POSIX sh has no `wait -n`, so poll. One second of latency is irrelevant next
# to the cost of a container that serves 200s while sign-in is broken.
while :; do
  if ! kill -0 "$render_pid" 2>/dev/null; then
    status=0
    wait "$render_pid" || status=$?
    log "FATAL render-service exited (status $status), stopping container"
    stop_children
    exit 1
  fi

  if ! kill -0 "$auth_pid" 2>/dev/null; then
    status=0
    wait "$auth_pid" || status=$?
    log "FATAL auth-service exited (status $status), stopping container"
    stop_children
    exit 1
  fi

  if ! kill -0 "$ai_pid" 2>/dev/null; then
    status=0
    wait "$ai_pid" || status=$?
    log "FATAL ai-service exited (status $status), stopping container"
    stop_children
    exit 1
  fi

  sleep 1
done
