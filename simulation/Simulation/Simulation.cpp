#include "Simulation.hpp"
#include <algorithm>

void Simulation::add(Simulatable* obj) {
    if (obj) {
        std::lock_guard lock(mutex_);
        objects_.push_back(obj);
    }
}

void Simulation::remove(Simulatable* obj) {
    if (!obj) return;
    std::lock_guard lock(mutex_);
    objects_.erase(
        std::remove(objects_.begin(), objects_.end(), obj),
        objects_.end());
}

void Simulation::step(double dt) {
    for (Simulatable* obj : objects_) {
        obj->step(dt);
    }
}

void Simulation::run() {
    while (true) {
        std::lock_guard lock(mutex_);
        step(dt_);
    }
}

void Simulation::run_for_duration(double duration) {
    const int steps = static_cast<int>(duration / dt_);
    for (int i = 0; i < steps; ++i) {
        std::lock_guard lock(mutex_);
        step(dt_);
    }
}

size_t Simulation::size() const {
    return objects_.size();
}
