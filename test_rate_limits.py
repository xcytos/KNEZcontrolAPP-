#!/usr/bin/env python3
"""
NVIDIA NIM API Rate Limit Test
Tests to find the actual rate limits and throttling behavior.
"""

import time
import asyncio
from openai import AsyncOpenAI, APIError
from datetime import datetime

client = AsyncOpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key="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"
)

async def test_single_request(request_num):
    """Send a single request and measure response."""
    start = time.time()
    try:
        completion = await client.chat.completions.create(
            model="nvidia/nemotron-3-super-120b-a12b",
            messages=[{"role": "user", "content": f"Say {request_num}"}],
            temperature=1,
            max_tokens=50
        )
        elapsed = time.time() - start
        return {
            "num": request_num,
            "success": True,
            "time": elapsed,
            "tokens": completion.usage.total_tokens if completion.usage else 0,
            "error": None,
            "timestamp": datetime.now().isoformat()
        }
    except APIError as e:
        elapsed = time.time() - start
        return {
            "num": request_num,
            "success": False,
            "time": elapsed,
            "tokens": 0,
            "error": f"{e.status_code}: {e.message}" if hasattr(e, 'status_code') else str(e),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        elapsed = time.time() - start
        return {
            "num": request_num,
            "success": False,
            "time": elapsed,
            "tokens": 0,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

async def test_burst_rate():
    """Test 1: Burst rate - send 50 requests as fast as possible."""
    print("=" * 60)
    print("TEST 1: Burst Rate (50 requests, no delay)")
    print("Expected: ~40 RPM limit, should see throttling after ~40 requests")
    print("=" * 60)
    
    tasks = [test_single_request(i) for i in range(50)]
    start_time = time.time()
    results = await asyncio.gather(*tasks)
    total_time = time.time() - start_time
    
    successes = sum(1 for r in results if r["success"])
    failures = sum(1 for r in results if not r["success"])
    errors = [r["error"] for r in results if not r["success"]]
    
    print(f"\nResults:")
    print(f"  Total time: {total_time:.2f}s")
    print(f"  Successful: {successes}/50")
    print(f"  Failed: {failures}/50")
    print(f"  Actual rate: {50/total_time*60:.1f} RPM")
    
    if errors:
        unique_errors = list(set(str(e)[:100] for e in errors if e))[:5]
        print(f"\n  Sample errors:")
        for e in unique_errors:
            print(f"    - {e}")
    
    return results

async def test_sustained_rate():
    """Test 2: Sustained rate - send requests at exactly 40 RPM for 2 minutes."""
    print("\n" + "=" * 60)
    print("TEST 2: Sustained Rate (40 RPM for 2 minutes)")
    print("Expected: Should sustain without throttling")
    print("=" * 60)
    
    results = []
    delay = 60 / 40  # 1.5s between requests for 40 RPM
    
    for i in range(80):  # 80 requests over 2 minutes
        result = await test_single_request(i)
        results.append(result)
        
        if not result["success"]:
            print(f"  Request {i}: FAILED - {result['error'][:80]}")
        
        await asyncio.sleep(delay)
    
    successes = sum(1 for r in results if r["success"])
    print(f"\nResults:")
    print(f"  Successful: {successes}/80")
    print(f"  Target rate: 40 RPM")
    
    return results

async def test_gradual_increase():
    """Test 3: Gradual rate increase to find the breaking point."""
    print("\n" + "=" * 60)
    print("TEST 3: Gradual Rate Increase (find breaking point)")
    print("=" * 60)
    
    rates = [10, 20, 30, 40, 50, 60]  # RPM to test
    
    for rpm in rates:
        print(f"\n  Testing {rpm} RPM...")
        delay = 60 / rpm
        results = []
        
        for i in range(min(rpm, 20)):  # Test for ~1 min or 20 requests
            result = await test_single_request(i)
            results.append(result)
            await asyncio.sleep(delay)
        
        successes = sum(1 for r in results if r["success"])
        failures = sum(1 for r in results if not r["success"])
        
        status = "✓" if failures == 0 else "✗"
        print(f"    {status} {rpm} RPM: {successes}/{len(results)} successful")
        
        if failures > 0:
            print(f"      Breaking point found at ~{rpm} RPM")
            break

async def test_daily_quota():
    """Test 4: Estimate daily quota by checking token usage pattern."""
    print("\n" + "=" * 60)
    print("TEST 4: Token Usage Pattern (check for quota limits)")
    print("=" * 60)
    
    print("  Sending 10 requests with max_tokens=1024...")
    tokens_used = []
    
    for i in range(10):
        result = await test_single_request(i)
        if result["success"]:
            # Actually get the token count
            try:
                completion = await client.chat.completions.create(
                    model="nvidia/nemotron-3-super-120b-a12b",
                    messages=[{"role": "user", "content": "Explain quantum computing in detail"}],
                    temperature=1,
                    max_tokens=1024
                )
                tokens = completion.usage.total_tokens if completion.usage else 0
                tokens_used.append(tokens)
                print(f"    Request {i}: {tokens} tokens")
            except Exception as e:
                print(f"    Request {i}: ERROR - {str(e)[:60]}")
        await asyncio.sleep(2)  # Be nice to the API
    
    if tokens_used:
        avg_tokens = sum(tokens_used) / len(tokens_used)
        print(f"\n  Average tokens per request: {avg_tokens:.0f}")
        print(f"  Estimated at 40 RPM:")
        print(f"    Per hour: {avg_tokens * 40 * 60:,.0f} tokens")
        print(f"    Per day: {avg_tokens * 40 * 60 * 24:,.0f} tokens")

async def main():
    print("NVIDIA NIM API Rate Limit Verification Test")
    print("=" * 60)
    print(f"Model: nvidia/nemotron-3-super-120b-a12b")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)
    print()
    
    # Run tests
    await test_burst_rate()
    await test_sustained_rate()
    await test_gradual_increase()
    await test_daily_quota()
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print("""
Expected Limits from Documentation:
- Rate Limit: 40 Requests Per Minute (RPM)
- Free Credits: 1,000 on signup (up to 5,000 requestable)
- Model: 50+ hosted models available

Key Findings from Web Research:
1. Multiple users confirmed 40 RPM limit in forums
2. Users requesting 200 RPM increases (mostly denied)
3. Free tier is for TESTING, not production workloads
4. "Forever free" but with strict usage limits
5. NVIDIA explicitly states: "FREE TESTING is not made for hardcore usage"

Throttling Behavior:
- HTTP 429 (Too Many Requests) when limit exceeded
- No documented token-based quota (appears to be request-based)
- Rate limit resets per minute window
""")

if __name__ == "__main__":
    asyncio.run(main())
