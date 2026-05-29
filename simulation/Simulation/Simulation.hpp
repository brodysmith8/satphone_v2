#pragma once

#include "Simulatable.hpp"
#include <atomic>
#include <cstddef>
#include <functional>
#include <mutex>
#include <vector>

/**
 * Time-step based simulation loop that advances a set of simulatable objects.
 * add() and remove() are thread-safe with respect to run().
 */
class Simulation {
public:
    /**
     * Initialize the simulation with a time step.
     * @param dt Time step duration (e.g. in seconds). Every simulatable object is modellable as f(dt)
    */
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
     * Run the given function while holding the simulation mutex.
     * Use this when reading object state (e.g. for /status/all) so reads are consistent with steps.
     */
    void withLock(std::function<void()> f) const;

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

    /** Wall-clock delay (in microseconds) inserted between simulation cycles. */
    int getDelay() const;

    /**
     * Set the wall-clock delay (in microseconds) inserted between simulation cycles.
     * @param delay Delay in microseconds. Defaults to 0 (run as fast as possible).
     * @throws std::invalid_argument if delay is negative.
     */
    void setDelay(int delay);

    /** Simulation time step (seconds) advanced per cycle. */
    double getDt() const;

    /**
     * Set the simulation time step (seconds) advanced per cycle.
     * @param dt Time step in seconds. Must be positive.
     * @throws std::invalid_argument if dt is not positive.
     */
    void setDt(double dt);

private:
    /**
     * Advance the simulation by one time step: step all registered objects by dt.
     * Must be called with mutex_ held.
     */
    void step(double dt);
    std::vector<Simulatable*> objects_;
    std::atomic<double> dt_;
    std::atomic<int> delay_{0};
    mutable std::mutex mutex_;
};
