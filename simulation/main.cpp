#include "App.hpp"
#include "Simulation.hpp"
#include <iostream>
#include <thread>
#include <unordered_map>

// Example simulatable: a simple counter
struct Counter : Simulatable {
    void step(double dt) override { setValue(value() + dt); }
};

// Example simulatable: count at double the rate of the first counter
struct CounterTwoDt : Simulatable {
    void step(double dt) override { setValue(value() + (2.0 * dt)); }
};

int main() {
    Simulation sim(0.1);
    Counter c1;
    CounterTwoDt c2;
    std::unordered_map<std::string, Simulatable*> objects = {{"c1", &c1}, {"c2", &c2}};
    sim.add(&c1);
    sim.add(&c2);
    std::thread sim_thread([&]() {
        // Simulation thread: runs the simulation
        // sim.run_for_duration(2.0); // 20 steps of 0.1s
        sim.run(); // Run infinitely
        std::cout << "Satphone simulation ran " << sim.size() << " objects to t=2.0.\n";
        std::cout << "Counters at " << c1.value() << ", " << c2.value() << "\n";
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
