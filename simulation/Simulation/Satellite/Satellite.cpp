#include "Satellite.hpp"
#include <cmath>
#include <stdexcept>
#include <string>

namespace {
constexpr double R_EARTH_M = 6371000.0;
constexpr double MU_EARTH_M3_S2 = 3.986004418e14;
constexpr double OMEGA_EARTH_RAD_S = 7.2921159e-5;  // rad/s
constexpr double PI = 3.141592653589793;
constexpr double MAX_HEIGHT_M = 10'000'000.0;  // 10,000 km

/** Returns empty string if valid; otherwise an error message. */
std::string validateCoordinates(double latitude_rad, double longitude_rad, double height_m) {
    if (std::isnan(latitude_rad) || std::isnan(longitude_rad) || std::isnan(height_m)) {
        return "Invalid coordinates: latitude, longitude, and height must be numbers.";
    }
    if (latitude_rad < -PI / 2 || latitude_rad > PI / 2) {
        return "Invalid coordinates: latitude must be between -90° and 90° (radians: -π/2 to π/2).";
    }
    if (longitude_rad < -PI || longitude_rad > PI) {
        return "Invalid coordinates: longitude must be between -180° and 180° (radians: -π to π).";
    }
    if (height_m < 0 || height_m > MAX_HEIGHT_M) {
        return "Invalid coordinates: height must be between 0 and 10,000 km (meters).";
    }
    return {};
}
}  // namespace

Satellite::Satellite()
    : latitude_(0),
      longitude_(0),
      height_(400e3),
      inclination_rad_(51.6 * (PI / 180.0)),
      raan_rad_(0),
      mean_anomaly_rad_(0),
      sim_time_s_(0) {
    updateLatLonFromOrbit();
}

Satellite::Satellite(double latitude_rad, double longitude_rad, double height_m)
    : latitude_(latitude_rad),
      longitude_(longitude_rad),
      height_(height_m),
      inclination_rad_(51.6 * (PI / 180.0)),
      raan_rad_(0),
      mean_anomaly_rad_(0),
      sim_time_s_(0) {
    std::string err = validateCoordinates(latitude_rad, longitude_rad, height_m);
    if (!err.empty()) {
        throw std::invalid_argument(err);
    }
    const double incl = inclination_rad_;
    const double sin_incl = std::sin(incl), cos_incl = std::cos(incl);
    if (std::abs(sin_incl) < 1e-10) {
        mean_anomaly_rad_ = 0;
        raan_rad_ = longitude_rad;
    } else {
        mean_anomaly_rad_ = std::asin(std::sin(latitude_rad) / sin_incl);
        raan_rad_ = longitude_rad - std::atan2(std::sin(mean_anomaly_rad_) * cos_incl,
                                               std::cos(mean_anomaly_rad_));
    }
    updateLatLonFromOrbit();
}

void Satellite::step(double dt) {
    sim_time_s_ += dt;
    const double a = R_EARTH_M + height_;
    const double n = std::sqrt(MU_EARTH_M3_S2 / (a * a * a));
    mean_anomaly_rad_ += n * dt;
    constexpr double TWO_PI = 2.0 * PI;
    mean_anomaly_rad_ = std::fmod(mean_anomaly_rad_, TWO_PI);
    if (mean_anomaly_rad_ < 0) mean_anomaly_rad_ += TWO_PI;
    updateLatLonFromOrbit();
}

void Satellite::updateLatLonFromOrbit() {
    const double r = R_EARTH_M + height_;
    const double c_ma = std::cos(mean_anomaly_rad_), s_ma = std::sin(mean_anomaly_rad_);
    const double c_raan = std::cos(raan_rad_), s_raan = std::sin(raan_rad_);
    const double ci = std::cos(inclination_rad_), si = std::sin(inclination_rad_);

    const double x_eci = r * (c_ma * c_raan - s_ma * ci * s_raan);
    const double y_eci = r * (c_ma * s_raan + s_ma * ci * c_raan);
    const double z_eci = r * s_ma * si;

    const double omega_t = OMEGA_EARTH_RAD_S * sim_time_s_;
    const double c_om = std::cos(omega_t), s_om = std::sin(omega_t);
    const double x_ecef = x_eci * c_om + y_eci * s_om;
    const double y_ecef = -x_eci * s_om + y_eci * c_om;
    const double z_ecef = z_eci;

    const double r_xy = std::sqrt(x_ecef * x_ecef + y_ecef * y_ecef);
    latitude_ = std::atan2(z_ecef, r_xy);
    if (r_xy < 1e-10) {
        longitude_ = 0;
    } else {
        longitude_ = std::atan2(y_ecef, x_ecef);
    }
}

Json::Value Satellite::value() const {
    Json::Value obj;
    obj["latitude"] = latitude_;
    obj["longitude"] = longitude_;
    obj["height"] = height_;
    return obj;
}
