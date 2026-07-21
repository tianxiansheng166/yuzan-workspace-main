# AI Provider Stub

Deterministic local testing for the AI lesson planning pipeline.

## Purpose

Replaces the real AI provider with a configurable stub for:
- Local development without real API keys
- Integration testing of the Worker + API pipeline
- Testing error handling scenarios

## Usage

```bash
# Enable stub mode
export AI_PROVIDER_STUB=true

# Choose scenario (default: valid-output)
export AI_STUB_SCENARIO=valid-output    # Returns valid lesson plan
export AI_STUB_SCENARIO=invalid-json    # Returns malformed JSON
export AI_STUB_SCENARIO=schema-invalid  # Returns JSON that fails schema validation
export AI_STUB_SCENARIO=timeout         # Never responds (simulates timeout)
export AI_STUB_SCENARIO=401             # Returns HTTP 401
export AI_STUB_SCENARIO=500             # Returns HTTP 500

# Start the worker with stub
AI_PROVIDER_STUB=true AI_STUB_SCENARIO=valid-output pnpm --filter @yuzan/worker dev
```

## How It Works

When `AI_PROVIDER_STUB=true` is set, the internal AI proxy endpoint
(`/api/v1/internal/ai/openai/v1/chat/completions`) uses the stub handler
instead of forwarding to the real AI provider.

This allows the Worker → API → (stub) path to be tested end-to-end
without Flowise or real API keys.
