#pragma once

#include "Simulatable.hpp"
#include <cstddef>
#include <mutex>
#include <vector>

/**
 * Time-step based simulation loop that advances a set of simulatable objects.
 * add() and remove() are thread-safe with respect to run().
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
     * Unregister an object. No-op if the pointer is not registered.
     * The simulation does not take ownership; the caller is responsible for the object's lifetime.
     */
    void remove(Simulatable* obj);
    
    /**
     * Run the simulation infinitely, advancing by dt_ each step.
     */
    void run();

    /**
    * Run the simulation for a given duration, advancing by dt_ each step.
    * @param duration Total simulated time to run.
    */
    void run_for_duration(double duration);
    
    /** Number of simulatable objects currently registered. */
    size_t size() const;
    
private:
    /**
     * Advance the simulation by one time step: step all registered objects by dt.
     * Must be called with mutex_ held.
     */
    void step(double dt);
    std::vector<Simulatable*> objects_;
    double dt_;
    mutable std::mutex mutex_;
};
