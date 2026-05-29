#include "Simulation.hpp"
#include <algorithm>
#include <chrono>
#include <stdexcept>
#include <thread>

void Simulation::add(Simulatable* obj) {
    if (obj) {
        std::lock_guard lock(mutex_);
        objects_.push_back(obj);
        obj->step(dt_.load());
    }
}

void Simulation::remove(Simulatable* obj) {
    if (!obj) return;
    std::lock_guard lock(mutex_);
    objects_.erase(
        std::remove(objects_.begin(), objects_.end(), obj),
        objects_.end());
}

void Simulation::withLock(std::function<void()> f) const {
    std::lock_guard lock(mutex_);
    f();
}

void Simulation::step(double dt) {
    for (Simulatable* obj : objects_) {
        obj->step(dt);
    }
}

void Simulation::run() {
    while (true) {
        std::vector<Simulatable*> to_step;
        {
            std::lock_guard lock(mutex_);
            to_step = objects_;
        }
        for (Simulatable* obj : to_step) {
            obj->step(dt_.load());
        }
        std::this_thread::sleep_for(std::chrono::microseconds(delay_.load()));
        std::this_thread::yield();
    }
}

void Simulation::run_for_duration(double duration) {
    const int steps = static_cast<int>(duration / dt_.load());
    for (int i = 0; i < steps; ++i) {
        {
            std::lock_guard lock(mutex_);
            step(dt_.load());
        }
        std::this_thread::sleep_for(std::chrono::microseconds(delay_.load()));
    }
}

size_t Simulation::size() const {
    std::lock_guard lock(mutex_);
    return objects_.size();
}

int Simulation::getDelay() const {
    return delay_.load();
}

void Simulation::setDelay(int delay) {
    if (delay < 0) {
        throw std::invalid_argument("Simulation delay must be non-negative");
    }
    delay_.store(delay);
}

double Simulation::getDt() const {
    return dt_.load();
}

void Simulation::setDt(double dt) {
    if (dt <= 0.0) {
        throw std::invalid_argument("Simulation dt must be positive");
    }
    dt_.store(dt);
}
