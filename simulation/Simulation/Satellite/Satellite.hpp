#pragma once

#include "../Simulatable.hpp"

/**
 * Simulatable satellite with position (latitude, longitude, height).
 * Uses real orbital mechanics: circular orbit with inclination and RAAN,
 * propagated in time and converted to subsatellite lat/lon (radians) and height (m).
 */
class Satellite : public Simulatable {
public:
    /** Default: equator at 0 lon, 400 km altitude, 51.6° inclination. */
    Satellite();

    /** Initial subsatellite point (lat/lon in radians, height in m). Orbit plane is inferred. */
    Satellite(double latitude_rad, double longitude_rad, double height_m);

    void step(double dt) override;

    /** Returns JSON with keys "latitude", "longitude" (radians), "height" (m). */
    Json::Value value() const override;

private:
    void updateLatLonFromOrbit();

    double latitude_;
    double longitude_;
    double height_;
    double inclination_rad_;
    double raan_rad_;
    double mean_anomaly_rad_;
    double sim_time_s_;
};
