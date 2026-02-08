#include "Satellite.hpp"

Satellite::Satellite() : latitude_(0), longitude_(0), height_(0) {}

Satellite::Satellite(double latitude, double longitude, double height)
    : latitude_(latitude), longitude_(longitude), height_(height) {}

void Satellite::step(double dt) {
    latitude_ += dt;
    longitude_ += dt;
    height_ += dt;
}

Json::Value Satellite::value() const {
    Json::Value obj;
    obj["latitude"] = latitude_;
    obj["longitude"] = longitude_;
    obj["height"] = height_;
    return obj;
}
