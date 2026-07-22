#!/bin/bash

# Function to check HTTP health endpoint
check_http_health() {
    local service_name=$1
    local url=$2
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" $url)
    if [ $status_code -eq 200 ]; then
        echo "\"$service_name\": {\"status\": \"up\", \"timestamp\": \"$(date +%FT%T%z)\"}"
    else
        echo "\"$service_name\": {\"status\": \"down\", \"timestamp\": \"$(date +%FT%T%z)\"}"
        exit 1
    fi
}

# Function to check process status
check_process_status() {
    local service_name=$1
    local process_name=$2
    if pgrep -f $process_name > /dev/null; then
        echo "\"$service_name\": {\"status\": \"up\", \"timestamp\": \"$(date +%FT%T%z)\"}"
    else
        echo "\"$service_name\": {\"status\": \"down\", \"timestamp\": \"$(date +%FT%T%z)\"}"
        exit 1
    fi
}

# Function to check GPU status
check_gpu_status() {
    local gpu_status=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader)
    if [ "$gpu_status" -lt 100 ]; then
        echo "\"gpu\": {\"status\": \"up\", \"timestamp\": \"$(date +%FT%T%z)\"}"
    else
        echo "\"gpu\": {\"status\": \"down\", \"timestamp\": \"$(date +%FT%T%z)\"}"
        exit 1
    fi
}

# Function to check Ollama API status
check_ollama_api_status() {
    local ollama_status=$(curl -s -o /dev/null -w "%{http_code}" http://ollama-api:8080/health)
    if [ $ollama_status -eq 200 ]; then
        echo "\"ollama_api\": {\"status\": \"up\", \"timestamp\": \"$(date +%FT%T%z)\"}"
    else
        echo "\"ollama_api\": {\"status\": \"down\", \"timestamp\": \"$(date +%FT%T%z)\"}"
        exit 1
    fi
}

# Main script
echo "{"
check_http_health "ws-sink-go" "http://ws-sink-go:9000/health"
check_http_health "contact-api-go" "http://contact-api-go:5001/health"
check_http_health "console-backend-go" "http://console-backend-go:8001/health"
check_http_health "gateway-go" "http://gateway-go:8080/health"
check_process_status "ws-sink-go" "ws_sink_go"
check_process_status "contact-api-go" "contact_api_go"
check_process_status "console-backend-go" "console_backend_go"
check_process_status "gateway-go" "gateway_go"
check_gpu_status
check_ollama_api_status
echo "}"
exit 0
