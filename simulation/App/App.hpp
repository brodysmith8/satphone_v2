#pragma once

#include "Simulatable.hpp"
#include "Simulation.hpp"
#include "Satellite.hpp"
#include <memory>
#include <string>
#include <unordered_map>

/**
 * Application image: Drogon HTTP API server.
 * Set up and run with run() (blocking). Listens on 0.0.0.0,
 * port from environment PORT, default 8848.
 */
class App {
public:
    explicit App();

    /** Set up routes and run the HTTP server (blocking). */
    void run();

    /** Set the simulation instance to which dynamically created satellites are added/removed. */
    void set_simulation(Simulation* sim) { simulation_ = sim; }

    /** Add Simulatable objects (id -> pointer). Caller retains ownership. */
    void add_objects(std::unordered_map<std::string, Simulatable*>);

private:
    std::unordered_map<std::string, Simulatable*> objects_;
    std::unordered_map<std::string, std::unique_ptr<Satellite>> dynamic_satellites_;
    size_t next_satellite_id_ = 0;
    Simulation* simulation_ = nullptr;
};
