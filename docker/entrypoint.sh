#!/bin/sh
# Supervises the two Node processes bundled in the final image.
#
# Both the render-service (port 5173) and the auth-service (port 4000) are part
# of the same origin: the render-service proxies /api/auth/* to the auth-service,
# so a dead auth-service breaks sign-in even while /health still returns 200.
# The previous CMD used `cmd1 & cmd2; wait`, where the exit of either child
# silently ended PID 1 with no explanation in the container logs.
#
# This script instead exits non-zero with an explicit log line naming the
# process that died, so Northflank restarts the container and the cause is
# visible in the logs.

RENDER_CMD=${RENDER_CMD:-"node dist/server.js"}
AUTH_CMD=${AUTH_CMD:-"/app/auth-service/node_modules/.bin/tsx auth-service/src/server.ts"}

log() {
  printf '%s [entrypoint] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"
}

render_pid=''
auth_pid=''

stop_children() {
  for pid in $auth_pid $render_pid; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null
  done
}

on_signal() {
  log "received termination signal, stopping auth-service and render-service"
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

log "render-service pid=$render_pid auth-service pid=$auth_pid"

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

  sleep 1
done
