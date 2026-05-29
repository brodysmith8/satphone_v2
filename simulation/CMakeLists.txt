cmake_minimum_required(VERSION 3.5)
project(satphone_sim LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)

find_package(Drogon REQUIRED)
add_executable(sim main.cpp App/App.cpp App/StreamHub.cpp App/PositionStreamController.cpp Simulation/Simulation.cpp Simulation/Satellite/Satellite.cpp)
target_include_directories(sim PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/App ${CMAKE_CURRENT_SOURCE_DIR}/Simulation ${CMAKE_CURRENT_SOURCE_DIR}/Simulation/Satellite)
target_link_libraries(sim PRIVATE Drogon::Drogon)
