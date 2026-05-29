#pragma once

#include <drogon/WebSocketConnection.h>
#include <mutex>
#include <string>
#include <unordered_set>

/**
 * Shared registry of active WebSocket connections for the position data plane.
 *
 * Meyers singleton that decouples the Drogon-instantiated WebSocket controller
 * (PositionStreamController) from App, which owns the satellite registry and the
 * broadcast timer. The controller registers/removes connections here; App pushes
 * pre-serialized position frames here via broadcast().
 */
class StreamHub {
public:
    static StreamHub& instance();

    /** Register a connection. Immediately sends the last broadcast frame (if any). */
    void addConnection(const drogon::WebSocketConnectionPtr& conn);

    /** Unregister a connection. No-op if not registered. */
    void removeConnection(const drogon::WebSocketConnectionPtr& conn);

    /** Send one pre-serialized payload to every connected client and cache it. */
    void broadcast(const std::string& payload);

    StreamHub(const StreamHub&) = delete;
    StreamHub& operator=(const StreamHub&) = delete;

private:
    StreamHub() = default;

    mutable std::mutex mutex_;
    std::unordered_set<drogon::WebSocketConnectionPtr> connections_;
    std::string lastPayload_;
};
