#include "App.hpp"
#include <drogon/drogon.h>
#include <cstdlib>
#include <string>

using namespace drogon;

App::App() {}

void App::run() {
    app().registerHandler(
        "/status/all",
        [this](const HttpRequestPtr&,
               std::function<void(const HttpResponsePtr&)>&& callback) {
            Json::Value body;
            for (const auto& [id, obj] : objects_) {
                body[id] = obj->value();
            }
            auto resp = HttpResponse::newHttpJsonResponse(body);
            resp->addHeader("Access-Control-Allow-Origin", "*");
            callback(resp);
        },
        {Get});

    // Keep this at the bottom 
    app().registerHandler(
        "/{id}",
        [this](const HttpRequestPtr&,
               std::function<void(const HttpResponsePtr&)>&& callback,
               const std::string& id) {
            Json::Value body;
            body["value"] = id;
            auto resp = HttpResponse::newHttpJsonResponse(body);
            resp->addHeader("Access-Control-Allow-Origin", "*");
            callback(resp);
        },
        {Get});

    const char* port_env = std::getenv("PORT");
    uint16_t port = port_env ? static_cast<uint16_t>(std::stoul(port_env)) : 8848;
    app().addListener("0.0.0.0", port).run();
}

void App::add_objects(std::unordered_map<std::string, Simulatable*> objects) {
    objects_ = std::move(objects);
}