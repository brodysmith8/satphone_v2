#include "App.hpp"
#include <drogon/drogon.h>
#include <cstdlib>
#include <stdexcept>
#include <string>

using namespace drogon;

App::App() {}

namespace {
    HttpResponsePtr corsPreflightResponse() {
        auto resp = HttpResponse::newHttpResponse();
        resp->setStatusCode(k204NoContent);
        resp->addHeader("Access-Control-Allow-Origin", "*");
        resp->addHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        resp->addHeader("Access-Control-Allow-Headers", "Content-Type");
        resp->addHeader("Access-Control-Max-Age", "86400");
        return resp;
    }
} // namespace

void App::run() {
    // Handle CORS preflight (OPTIONS) before routing so DELETE is in Allow-Methods (Drogon’s
    // built-in OPTIONS handling can otherwise reply without it).
    app().registerPreRoutingAdvice(
        [](const HttpRequestPtr& req,
           std::function<void(const HttpResponsePtr&)>&& fcb,
           std::function<void()>&& fccb) {
            if (req->method() != Options) {
                fccb();
                return;
            }
            const std::string& path = req->path();
            bool isApi = (path.size() >= 10 && path.compare(0, 10, "/satellite") == 0) ||
                         (path.size() >= 7 && path.compare(0, 7, "/status") == 0) ||
                         (path.size() >= 6 && path.compare(0, 6, "/delay") == 0);
            if (isApi) {
                fcb(corsPreflightResponse());
                return;
            }
            fccb();
        });

    // CORS preflight (OPTIONS) — per-route fallback
    app().registerHandler(
        "/satellite",
        [](const HttpRequestPtr&,
           std::function<void(const HttpResponsePtr&)>&& callback) {
            callback(corsPreflightResponse());
        },
        {Options});
    app().registerHandler(
        "/satellite/{id}",
        [](const HttpRequestPtr&,
           std::function<void(const HttpResponsePtr&)>&& callback,
           const std::string&) {
            callback(corsPreflightResponse());
        },
        {Options});
    app().registerHandler(
        "/status/all",
        [](const HttpRequestPtr&,
           std::function<void(const HttpResponsePtr&)>&& callback) {
            callback(corsPreflightResponse());
        },
        {Options});
    app().registerHandler(
        "/delay",
        [](const HttpRequestPtr&,
           std::function<void(const HttpResponsePtr&)>&& callback) {
            callback(corsPreflightResponse());
        },
        {Options});

    // POST /satellite — create a new satellite and add it to the simulation.
    // Requires valid JSON body with latitude, longitude, height (radians, radians, meters).
    app().registerHandler(
        "/satellite",
        [this](const HttpRequestPtr& req,
               std::function<void(const HttpResponsePtr&)>&& callback) {
            auto jsonPtr = req->getJsonObject();
            if (!jsonPtr || !jsonPtr->isObject()) {
                Json::Value err;
                err["error"] = "Request body must be JSON with latitude, longitude, height (Content-Type: application/json).";
                if (!req->getJsonError().empty()) {
                    err["error"] = "Invalid JSON: " + req->getJsonError();
                }
                auto resp = HttpResponse::newHttpJsonResponse(err);
                resp->setStatusCode(k400BadRequest);
                resp->addHeader("Access-Control-Allow-Origin", "*");
                callback(resp);
                return;
            }
            if (!jsonPtr->isMember("latitude") || !jsonPtr->isMember("longitude") || !jsonPtr->isMember("height")) {
                Json::Value err;
                err["error"] = "Missing latitude, longitude, or height.";
                auto resp = HttpResponse::newHttpJsonResponse(err);
                resp->setStatusCode(k400BadRequest);
                resp->addHeader("Access-Control-Allow-Origin", "*");
                callback(resp);
                return;
            }
            const Json::Value& jlat = (*jsonPtr)["latitude"];
            const Json::Value& jlon = (*jsonPtr)["longitude"];
            const Json::Value& jheight = (*jsonPtr)["height"];
            if (jlat.isNull() || jlon.isNull() || jheight.isNull()) {
                Json::Value err;
                err["error"] = "latitude, longitude, and height must be numbers (not null).";
                auto resp = HttpResponse::newHttpJsonResponse(err);
                resp->setStatusCode(k400BadRequest);
                resp->addHeader("Access-Control-Allow-Origin", "*");
                callback(resp);
                return;
            }
            double lat = jlat.asDouble();
            double lon = jlon.asDouble();
            double height = jheight.asDouble();

            if (!simulation_) {
                Json::Value err;
                err["error"] = "Simulation not available; cannot create satellites.";
                auto resp = HttpResponse::newHttpJsonResponse(err);
                resp->setStatusCode(k503ServiceUnavailable);
                resp->addHeader("Access-Control-Allow-Origin", "*");
                callback(resp);
                return;
            }

            std::unique_ptr<Satellite> sat;
            try {
                sat = std::make_unique<Satellite>(lat, lon, height);
            } catch (const std::invalid_argument& e) {
                Json::Value err;
                err["error"] = e.what();
                auto resp = HttpResponse::newHttpJsonResponse(err);
                resp->setStatusCode(k400BadRequest);
                resp->addHeader("Access-Control-Allow-Origin", "*");
                callback(resp);
                return;
            }
            Satellite* raw = sat.get();
            std::string id = "sat_" + std::to_string(next_satellite_id_++);
            try {
                simulation_->add(raw);
            } catch (...) {
                Json::Value err;
                err["error"] = "Failed to add satellite to simulation.";
                auto resp = HttpResponse::newHttpJsonResponse(err);
                resp->setStatusCode(k503ServiceUnavailable);
                resp->addHeader("Access-Control-Allow-Origin", "*");
                callback(resp);
                return;
            }
            dynamic_satellites_[id] = std::move(sat);
            objects_[id] = raw;
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
        "/satellite/{id}",
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
            if (simulation_) {
                simulation_->withLock([this, &body]() {
                    for (const auto& [id, obj] : objects_) {
                        body[id] = obj->value();
                    }
                });
            } else {
                for (const auto& [id, obj] : objects_) {
                    body[id] = obj->value();
                }
            }
            auto resp = HttpResponse::newHttpJsonResponse(body);
            resp->addHeader("Access-Control-Allow-Origin", "*");
            callback(resp);
        },
        {Get});

    // GET /delay — current wall-clock delay (µs) inserted between simulation cycles.
    app().registerHandler(
        "/delay",
        [this](const HttpRequestPtr&,
               std::function<void(const HttpResponsePtr&)>&& callback) {
            if (!simulation_) {
                Json::Value err;
                err["error"] = "Simulation not available.";
                auto resp = HttpResponse::newHttpJsonResponse(err);
                resp->setStatusCode(k503ServiceUnavailable);
                resp->addHeader("Access-Control-Allow-Origin", "*");
                callback(resp);
                return;
            }
            Json::Value body;
            body["delay"] = simulation_->getDelay();
            auto resp = HttpResponse::newHttpJsonResponse(body);
            resp->addHeader("Access-Control-Allow-Origin", "*");
            callback(resp);
        },
        {Get});

    // POST /delay — set the wall-clock delay (µs) inserted between simulation cycles.
    // Requires JSON body with a non-negative integer "delay".
    app().registerHandler(
        "/delay",
        [this](const HttpRequestPtr& req,
               std::function<void(const HttpResponsePtr&)>&& callback) {
            if (!simulation_) {
                Json::Value err;
                err["error"] = "Simulation not available.";
                auto resp = HttpResponse::newHttpJsonResponse(err);
                resp->setStatusCode(k503ServiceUnavailable);
                resp->addHeader("Access-Control-Allow-Origin", "*");
                callback(resp);
                return;
            }
            auto jsonPtr = req->getJsonObject();
            if (!jsonPtr || !jsonPtr->isObject() || !jsonPtr->isMember("delay")) {
                Json::Value err;
                err["error"] = "Request body must be JSON with a non-negative integer \"delay\" (Content-Type: application/json).";
                if (!req->getJsonError().empty()) {
                    err["error"] = "Invalid JSON: " + req->getJsonError();
                }
                auto resp = HttpResponse::newHttpJsonResponse(err);
                resp->setStatusCode(k400BadRequest);
                resp->addHeader("Access-Control-Allow-Origin", "*");
                callback(resp);
                return;
            }
            const Json::Value& jdelay = (*jsonPtr)["delay"];
            if (!jdelay.isIntegral()) {
                Json::Value err;
                err["error"] = "\"delay\" must be an integer number of microseconds.";
                auto resp = HttpResponse::newHttpJsonResponse(err);
                resp->setStatusCode(k400BadRequest);
                resp->addHeader("Access-Control-Allow-Origin", "*");
                callback(resp);
                return;
            }
            try {
                simulation_->setDelay(jdelay.asInt());
            } catch (const std::invalid_argument& e) {
                Json::Value err;
                err["error"] = e.what();
                auto resp = HttpResponse::newHttpJsonResponse(err);
                resp->setStatusCode(k400BadRequest);
                resp->addHeader("Access-Control-Allow-Origin", "*");
                callback(resp);
                return;
            }
            Json::Value body;
            body["delay"] = simulation_->getDelay();
            auto resp = HttpResponse::newHttpJsonResponse(body);
            resp->addHeader("Access-Control-Allow-Origin", "*");
            callback(resp);
        },
        {Post});

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