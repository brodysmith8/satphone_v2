#pragma once

#include "Simulatable.hpp"
#include "Simulation.hpp"
#include "Satellite.hpp"
#include <json/json.h>
#include <atomic>
#include <memory>
#include <mutex>
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
    /**
     * Build the position frame {id: {latitude, longitude, height}}.
     * Single source of truth for both GET /status/all and the broadcast timer.
     * Reads under objects_mutex_ (map consistency) and the simulation lock (value
     * consistency with stepping).
     */
    Json::Value buildSnapshot();

    /**
     * (Re)arm the periodic broadcast timer on the event loop at the current rate.
     * MUST be called from the event-loop thread (e.g. via queueInLoop).
     */
    void armBroadcastTimer();

    std::unordered_map<std::string, Simulatable*> objects_;
    std::unordered_map<std::string, std::unique_ptr<Satellite>> dynamic_satellites_;
    size_t next_satellite_id_ = 0;
    Simulation* simulation_ = nullptr;

    // Guards objects_, dynamic_satellites_, and next_satellite_id_ across Drogon's
    // IO worker threads (POST/DELETE) and the broadcast callback (event-loop thread).
    std::mutex objects_mutex_;

    // Broadcast cadence (Hz) for the WebSocket data plane; settable via /stream/rate.
    std::atomic<double> stream_hz_{30.0};
    // Timer id of the active broadcast timer (0 = none). Touched only on the loop thread.
    uint64_t broadcast_timer_id_ = 0;
};
