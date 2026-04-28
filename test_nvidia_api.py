#!/usr/bin/env python3
"""Quick test to verify NVIDIA Nemotron API connectivity."""

from openai import OpenAI

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key="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"
)

def test_simple_completion():
    """Test basic non-streaming completion."""
    print("=" * 50)
    print("TEST 1: Simple Completion (Non-streaming)")
    print("=" * 50)
    
    try:
        completion = client.chat.completions.create(
            model="nvidia/nemotron-3-super-120b-a12b",
            messages=[{"role": "user", "content": "Say hello in one word"}],
            temperature=1,
            top_p=0.95,
            max_tokens=100
        )
        
        content = completion.choices[0].message.content
        print(f"✓ Response: {content}")
        print(f"✓ Model: {completion.model}")
        print(f"✓ Tokens used: {completion.usage.total_tokens if completion.usage else 'N/A'}")
        return True
        
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_streaming_completion():
    """Test streaming completion."""
    print("\n" + "=" * 50)
    print("TEST 2: Streaming Completion")
    print("=" * 50)
    
    try:
        completion = client.chat.completions.create(
            model="nvidia/nemotron-3-super-120b-a12b",
            messages=[{"role": "user", "content": "Say hi"}],
            temperature=1,
            top_p=0.95,
            max_tokens=50,
            stream=True
        )
        
        content_parts = []
        reasoning_parts = []
        
        for chunk in completion:
            if not chunk.choices:
                continue
            
            # Check for reasoning content
            reasoning = getattr(chunk.choices[0].delta, "reasoning_content", None)
            if reasoning:
                reasoning_parts.append(reasoning)
            
            # Check for regular content
            if chunk.choices[0].delta.content is not None:
                content_parts.append(chunk.choices[0].delta.content)
        
        full_content = "".join(content_parts)
        full_reasoning = "".join(reasoning_parts)
        
        print(f"✓ Content: {full_content}")
        if full_reasoning:
            print(f"✓ Reasoning: {full_reasoning[:100]}...")
        else:
            print("ℹ No reasoning content in this response")
        return True
        
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_with_reasoning():
    """Test with enable_thinking=True."""
    print("\n" + "=" * 50)
    print("TEST 3: Completion with Thinking Enabled")
    print("=" * 50)
    
    try:
        completion = client.chat.completions.create(
            model="nvidia/nemotron-3-super-120b-a12b",
            messages=[{"role": "user", "content": "2+2=?"}],
            temperature=1,
            top_p=0.95,
            max_tokens=1024,
            extra_body={
                "chat_template_kwargs": {"enable_thinking": True},
                "reasoning_budget": 512
            },
            stream=True
        )
        
        content_parts = []
        reasoning_parts = []
        
        for chunk in completion:
            if not chunk.choices:
                continue
            
            reasoning = getattr(chunk.choices[0].delta, "reasoning_content", None)
            if reasoning:
                reasoning_parts.append(reasoning)
            
            if chunk.choices[0].delta.content is not None:
                content_parts.append(chunk.choices[0].delta.content)
        
        full_content = "".join(content_parts)
        full_reasoning = "".join(reasoning_parts)
        
        print(f"✓ Content: {full_content}")
        if full_reasoning:
            print(f"✓ Reasoning trace: {full_reasoning[:200]}...")
        return True
        
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_models_list():
    """Test listing available models."""
    print("\n" + "=" * 50)
    print("TEST 4: List Available Models")
    print("=" * 50)
    
    try:
        models = client.models.list()
        
        nemotron_models = [m for m in models.data if "nemotron" in m.id.lower()]
        print(f"✓ Found {len(nemotron_models)} Nemotron models:")
        for model in nemotron_models[:5]:
            print(f"  - {model.id}")
        
        if any("nemotron-3-super" in m.id for m in models.data):
            print("✓ Target model 'nemotron-3-super-120b-a12b' is available")
        
        return True
        
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

if __name__ == "__main__":
    print("NVIDIA Nemotron API Connection Test")
    print("=" * 50)
    print()
    
    results = []
    
    # Run all tests
    results.append(("Simple Completion", test_simple_completion()))
    results.append(("Streaming Completion", test_streaming_completion()))
    results.append(("Thinking Enabled", test_with_reasoning()))
    results.append(("List Models", test_models_list()))
    
    # Summary
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✓ All tests passed! API is working correctly.")
    else:
        print(f"\n⚠ {total - passed} test(s) failed. Check errors above.")
