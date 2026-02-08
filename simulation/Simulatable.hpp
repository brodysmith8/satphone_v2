#pragma once

/**
 * Base interface for objects that can be advanced by a time step in a simulation.
 */
class Simulatable {
public:
    virtual ~Simulatable() = default;

    /**
     * Advance this object by one time step.
     * @param dt Time step duration (e.g. in seconds).
     */
    virtual void step(double dt) = 0;
};
