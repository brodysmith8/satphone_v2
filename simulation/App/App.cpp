#include "App.hpp"
#include <drogon/drogon.h>
#include <cstdlib>
#include <string>

using namespace drogon;

App::App() {}

void App::run() {
    // POST /satellite — create a new satellite and add it to the simulation
    app().registerHandler(
        "/satellite",
        [this](const HttpRequestPtr& req,
               std::function<void(const HttpResponsePtr&)>&& callback) {
            std::unique_ptr<Satellite> sat;
            auto jsonPtr = req->getJsonObject();
            if (jsonPtr && jsonPtr->isObject() &&
                jsonPtr->isMember("latitude") && jsonPtr->isMember("longitude") && jsonPtr->isMember("height")) {
                double lat = (*jsonPtr)["latitude"].asDouble();
                double lon = (*jsonPtr)["longitude"].asDouble();
                double height = (*jsonPtr)["height"].asDouble();
                sat = std::make_unique<Satellite>(lat, lon, height);
            } else {
                sat = std::make_unique<Satellite>();
            }
            Satellite* raw = sat.get();
            std::string id = "sat_" + std::to_string(next_satellite_id_++);
            dynamic_satellites_[id] = std::move(sat);
            objects_[id] = raw;
            if (simulation_) {
                simulation_->add(raw);
            }
            Json::Value body;
            body["id"] = id;
            auto resp = HttpResponse::newHttpJsonResponse(body);
            resp->setStatusCode(k201Created);
            resp->addHeader("Access-Control-Allow-Origin", "*");
            callback(resp);
        },
        {Post});

    // DELETE /satellite/{id} — remove a dynamically created satellite and destruct it
    app().registerHandler(
        "/satellite/{1}",
        [this](const HttpRequestPtr&,
               std::function<void(const HttpResponsePtr&)>&& callback,
               const std::string& id) {
            auto it = dynamic_satellites_.find(id);
            if (it == dynamic_satellites_.end()) {
                auto resp = HttpResponse::newHttpResponse();
                resp->setStatusCode(k404NotFound);
                resp->addHeader("Access-Control-Allow-Origin", "*");
                callback(resp);
                return;
            }
            Simulatable* ptr = it->second.get();
            if (simulation_) {
                simulation_->remove(ptr);
            }
            objects_.erase(id);
            dynamic_satellites_.erase(it);
            auto resp = HttpResponse::newHttpResponse();
            resp->setStatusCode(k204NoContent);
            resp->addHeader("Access-Control-Allow-Origin", "*");
            callback(resp);
        },
        {Delete});

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