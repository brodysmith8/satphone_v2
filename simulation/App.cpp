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
            int i = 0;
            for (Simulatable* obj : objects_) {
                double v = obj->value();
                body[std::to_string(i)] = v;
                i++;
            }
            auto resp = HttpResponse::newHttpJsonResponse(body);
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
            callback(resp);
        },
        {Get});

    const char* port_env = std::getenv("PORT");
    uint16_t port = port_env ? static_cast<uint16_t>(std::stoul(port_env)) : 8848;
    app().addListener("0.0.0.0", port).run();
}

void App::add_objects(std::vector<Simulatable*> objects) {
    objects_ = objects;
}