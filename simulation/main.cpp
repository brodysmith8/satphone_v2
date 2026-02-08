#include "App.hpp"
#include "Simulation.hpp"
#include <iostream>
#include <thread>
#include <vector>

// Example simulatable: a simple counter
struct Counter : Simulatable {
    void step(double dt) override { setValue(value() + dt); }
};

int main() {
    Simulation sim(0.1);
    Counter c1, c2;
    std::vector<Simulatable*> objects = {&c1, &c2};
    sim.add(&c1);
    sim.add(&c2);
    // Simulation thread: runs the simulation
    std::thread sim_thread([&]() {
        sim.run(2.0); // 20 steps of 0.1s
        std::cout << "Satphone simulation ran " << sim.size() << " objects to t=2.0.\n";
        std::cout << "Counters at " << c1.value() << ", " << c2.value() << "\n";
    });

    App app;
    // Server thread: runs the Drogon API server (blocking on this thread)
    std::thread server_thread([&app, objects]() {
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
