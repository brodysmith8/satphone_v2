#pragma once

#include <json/value.h>

/**
 * Base interface for objects that can be advanced by a time step in a simulation.
 * Implementing classes define value() to return their state as JSON.
 */
class Simulatable {
public:
    virtual ~Simulatable() = default;

    /** Current state as a JSON value; implementation is defined by each derived class. */
    virtual Json::Value value() const = 0;

    /**
     * Advance this object by one time step.
     * @param dt Time step duration (e.g. in seconds).
     */
    virtual void step(double dt) = 0;

protected:
    Simulatable() = default;
};
