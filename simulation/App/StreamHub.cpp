#include "StreamHub.hpp"

StreamHub& StreamHub::instance() {
    static StreamHub hub;
    return hub;
}

void StreamHub::addConnection(const drogon::WebSocketConnectionPtr& conn) {
    std::string snapshot;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        connections_.insert(conn);
        snapshot = lastPayload_;
    }
    // Give the new client an immediate frame so it doesn't wait one broadcast tick.
    if (conn && conn->connected() && !snapshot.empty()) {
        conn->send(snapshot);
    }
}

void StreamHub::removeConnection(const drogon::WebSocketConnectionPtr& conn) {
    std::lock_guard<std::mutex> lock(mutex_);
    connections_.erase(conn);
}

void StreamHub::broadcast(const std::string& payload) {
    std::unordered_set<drogon::WebSocketConnectionPtr> targets;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        lastPayload_ = payload;
        targets = connections_;
    }
    for (const auto& conn : targets) {
        if (conn && conn->connected()) {
            conn->send(payload);
        }
    }
}
