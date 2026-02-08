#pragma once

#include <cmath>

/**
 * Base interface for objects that can be advanced by a time step in a simulation.
 * Provides a value_ and public accessor; derived classes update value via setValue().
 */
class Simulatable {
public:
    virtual ~Simulatable() = default;

    /** Current value (e.g. counter state), rounded to kDecimalPlaces decimal places for precision. */
    double value() const { return static_cast<double>(std::round(value_ * kScale) / kScale); }

    /**
     * Advance this object by one time step.
     * @param dt Time step duration (e.g. in seconds).
     */
    virtual void step(double dt) = 0;

protected:
    Simulatable() : value_(0) {}
    explicit Simulatable(double initial) : value_(initial) {}
    void setValue(double v) { value_ = v; }

private:
    double value_;
    static constexpr double kScale = 1e10;
};
