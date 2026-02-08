#pragma once

#include "Simulatable.hpp"
#include <cstddef>
#include <vector>

/**
 * Time-step based simulation loop that advances a set of simulatable objects.
 */
class Simulation {
public:
    Simulation(double dt = 1.0): dt_(dt) {};

    /**
     * Register an object to be stepped each time the simulation advances.
     * The simulation does not take ownership; the caller must keep objects alive.
     */
    void add(Simulatable* obj);
    
    /**
    * Run the simulation for a given duration, advancing by dt_ each step.
    * @param duration Total simulated time to run.
    */
    void run(double duration);
    
    /** Number of simulatable objects currently registered. */
    size_t size() const;
    
private:
    /**
     * Advance the simulation by one time step: step all registered objects by dt.
     */
    void step(double dt);
    std::vector<Simulatable*> objects_;
    double dt_;
};
