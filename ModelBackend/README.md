# OpenAI API Flask Server

A Flask server that proxies requests to the OpenAI API.

## Features

- Proxy requests to OpenAI API
- Rate limiting to prevent abuse
- CORS support for cross-origin requests
- Error handling and logging
- Health check endpoint

## Setup

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Set your OpenAI API key in the `.env` file:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. Run the server:
   ```
   python app.py
   ```

The server will start on http://localhost:5000

## API Endpoints

### Chat Completion

**Endpoint:** `POST /api/chat`

**Rate Limit:** 30 requests per minute

**Request Body:**
```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "model": "gpt-3.5-turbo",
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Response:**
The response from the OpenAI API.

### Available Models

**Endpoint:** `GET /api/models`

**Rate Limit:** 10 requests per minute

**Response:**
```json
{
  "models": ["gpt-3.5-turbo", "gpt-4", ...]
}
```

### Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy"
}
```

## Testing

Run the test script to verify the API is working correctly:

```
python test_api.py
```

## Example Usage with cURL

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "model": "gpt-3.5-turbo"
  }'
``` 