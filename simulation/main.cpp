#include "App.hpp"
#include "Simulation.hpp"
#include "Satellite.hpp"
#include <iostream>
#include <thread>
#include <unordered_map>

// Satellite constructor takes initial subsatellite point in RADIANS; API returns lat/lon in radians, height in m.
constexpr double DEG_TO_RAD = 3.141592653589793 / 180.0;
int main() {
    Simulation sim(0.000001);
    Satellite s1(0.0, 0.0, 400000.0);                                      // 0°, 0°, 400 km
    Satellite s2(30.0 * DEG_TO_RAD, 60.0 * DEG_TO_RAD, 400000.0);          // 30°N, 60°E, 400 km
    std::unordered_map<std::string, Simulatable*> objects = {{"sat1", &s1}, {"sat2", &s2}};
    sim.add(&s1);
    sim.add(&s2);
    std::thread sim_thread([&]() {
        // Simulation thread: runs the simulation
        // sim.run_for_duration(2.0); // 20 steps of 0.1s
        sim.run(); // Run infinitely
        std::cout << "Satphone simulation ran " << sim.size() << " objects to t=2.0.\n";
        std::cout << "Satellites: " << s1.value().toStyledString() << ", " << s2.value().toStyledString() << "\n";
    });

    App app;
    std::thread server_thread([&app, objects]() {
        // Server thread: runs the Drogon API server (blocking on this thread)
        app.add_objects(objects);
        app.run();
    });

    // Main thread waits for the server (runs until server exits)
    server_thread.join();
    server_thread.detach();
    if (sim_thread.joinable()) {
        sim_thread.join();
        sim_thread.detach();
    }
    
    return 0;
}
