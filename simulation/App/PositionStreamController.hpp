#pragma once

#include <drogon/WebSocketController.h>

/**
 * WebSocket controller for the position data plane at /ws/positions.
 *
 * Auto-registered by Drogon (via WS_PATH_ADD) as long as this translation unit
 * is linked into the binary. The data plane is server -> client only: incoming
 * messages are ignored; control stays on the REST API. Connection lifecycle is
 * delegated to StreamHub, which App's broadcast timer pushes frames to.
 */
class PositionStreamController
    : public drogon::WebSocketController<PositionStreamController> {
public:
    void handleNewMessage(const drogon::WebSocketConnectionPtr& conn,
                          std::string&& message,
                          const drogon::WebSocketMessageType& type) override;
    void handleNewConnection(const drogon::HttpRequestPtr& req,
                             const drogon::WebSocketConnectionPtr& conn) override;
    void handleConnectionClosed(const drogon::WebSocketConnectionPtr& conn) override;

    WS_PATH_LIST_BEGIN
    WS_PATH_ADD("/ws/positions");
    WS_PATH_LIST_END
};
