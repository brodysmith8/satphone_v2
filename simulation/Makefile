# Delegate to CMake; use Drogon Docker image or install Drogon locally for native build
BUILD_DIR := build

.PHONY: all clean run docker-build docker-run

all:
	cmake -B $(BUILD_DIR) -DCMAKE_BUILD_TYPE=Release
	cmake --build $(BUILD_DIR)

clean:
	rm -rf $(BUILD_DIR)

run: all
	$(BUILD_DIR)/sim

docker-build:
	docker build -t satphone-sim .

docker-run: docker-build
	docker run --rm -p 8848:8848 satphone-sim
