cmake_minimum_required(VERSION 3.5)
project(satphone_sim LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)

find_package(Drogon REQUIRED)
add_executable(sim main.cpp App.cpp Simulation.cpp)
target_link_libraries(sim PRIVATE Drogon::Drogon)
