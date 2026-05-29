#include "PositionStreamController.hpp"
#include "StreamHub.hpp"

void PositionStreamController::handleNewMessage(
    const drogon::WebSocketConnectionPtr&,
    std::string&&,
    const drogon::WebSocketMessageType&) {
    // Data plane is server -> client only; control stays on REST. Ignore input.
}

void PositionStreamController::handleNewConnection(
    const drogon::HttpRequestPtr&,
    const drogon::WebSocketConnectionPtr& conn) {
    StreamHub::instance().addConnection(conn);
}

void PositionStreamController::handleConnectionClosed(
    const drogon::WebSocketConnectionPtr& conn) {
    StreamHub::instance().removeConnection(conn);
}
