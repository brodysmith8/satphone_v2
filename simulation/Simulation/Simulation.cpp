#include "Simulation.hpp"

void Simulation::add(Simulatable* obj) {
    if (obj) {
        objects_.push_back(obj);
    }
}

void Simulation::step(double dt) {
    for (Simulatable* obj : objects_) {
        obj->step(dt);
    }
}

void Simulation::run() {
    while (true) {
        step(dt_);
    }
}

void Simulation::run_for_duration(double duration) {
    const int steps = static_cast<int>(duration / dt_);
    for (int i = 0; i < steps; ++i) {
        step(dt_);
    }
}

size_t Simulation::size() const {
    return objects_.size();
}
