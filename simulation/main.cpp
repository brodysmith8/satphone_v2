#include "Simulation.hpp"
#include <iostream>

// Example simulatable: a simple counter
struct Counter : Simulatable {
    double value = 0;
    void step(double dt) override { value += dt; }
};

int main() {
    Simulation sim(0.1);
    Counter c1, c2;
    sim.add(&c1);
    sim.add(&c2);

    sim.run(2.0); // 20 steps of 0.1s

    std::cout << "Satphone simulation ran " << sim.size() << " objects to t=1.0.\n";
    std::cout << "Counters at " << c1.value << ", " << c2.value << "\n";
    return 0;
}
