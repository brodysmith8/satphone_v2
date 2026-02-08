#include "App.hpp"
#include <drogon/drogon.h>
#include <cstdlib>
#include <string>

using namespace drogon;

App::App() {}

void App::run() {
    app().registerHandler(
        "/{id}",
        [this](const HttpRequestPtr&,
               std::function<void(const HttpResponsePtr&)>&& callback,
               const std::string& id) {
            Json::Value body;
            body["value"] = id;
            auto resp = HttpResponse::newHttpJsonResponse(body);
            callback(resp);
        },
        {Get});

    const char* port_env = std::getenv("PORT");
    uint16_t port = port_env ? static_cast<uint16_t>(std::stoul(port_env)) : 8848;
    app().addListener("0.0.0.0", port).run();
}
