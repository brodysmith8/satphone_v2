#pragma once

#include "../Simulatable.hpp"

/**
 * Simulatable satellite with position (latitude, longitude, height).
 * Coordinates default to 0; use the overloaded constructor to set them.
 */
class Satellite : public Simulatable {
public:
    /** Default position (0, 0, 0). */
    Satellite();

    /** Position with explicit latitude, longitude, and height. */
    Satellite(double latitude, double longitude, double height);

    void step(double dt) override;

    /** Returns JSON with keys "latitude", "longitude", "height" (numeric). */
    Json::Value value() const override;

private:
    double latitude_;
    double longitude_;
    double height_;
};
