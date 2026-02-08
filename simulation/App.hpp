#pragma once

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

};
