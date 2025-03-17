import requests
import json

BASE_URL = "http://localhost:5000"

def test_health():
    response = requests.get(f"{BASE_URL}/health")
    print("Health Check:", response.json())
    return response.status_code == 200

def test_chat():
    payload = {
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello, tell me a short joke."}
        ],
        "model": "gpt-3.5-turbo",
        "max_tokens": 100
    }
    
    response = requests.post(f"{BASE_URL}/api/chat", json=payload)
    
    if response.status_code == 200:
        result = response.json()
        print("\nChat Response:")
        print(json.dumps(result, indent=2))
        
        # Extract and print just the assistant's message
        if "choices" in result and len(result["choices"]) > 0:
            message = result["choices"][0]["message"]["content"]
            print("\nAssistant's response:", message)
        
        return True
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        return False

def test_models():
    response = requests.get(f"{BASE_URL}/api/models")
    
    if response.status_code == 200:
        models = response.json()
        print("\nAvailable Models:")
        print(json.dumps(models, indent=2))
        return True
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        return False

if __name__ == "__main__":
    print("Testing API...")
    
    if test_health():
        print("✅ Health check passed")
    else:
        print("❌ Health check failed")
    
    if test_models():
        print("✅ Models endpoint passed")
    else:
        print("❌ Models endpoint failed")
    
    if test_chat():
        print("✅ Chat endpoint passed")
    else:
        print("❌ Chat endpoint failed") 