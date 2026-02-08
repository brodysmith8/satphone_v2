#pragma once

#include <vector>
#include "Simulatable.hpp"

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

    /** Add Simulatable objects */
    void add_objects(std::vector<Simulatable*>);

private:
    std::vector<Simulatable*> objects_;
};
