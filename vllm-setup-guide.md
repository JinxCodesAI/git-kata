# vLLM + Speculative Decoding on AMD GPU — Complete Setup Guide

> **Target hardware:** AMD Strix Halo (128GB unified VRAM). Covers installation, model running, speculative decoding, client connections, optimization, and troubleshooting.
> **Last updated:** March 2026

---

## Table of Contents

1. [Important Pre-Read: Model Name Clarification](#important-pre-read-model-name-clarification)
2. [vLLM Installation (AMD GPU / ROCm)](#1-vllm-installation-amd-gpu--rocm)
3. [Running Models](#2-running-models)
4. [Speculative Decoding](#3-speculative-decoding)
5. [Connecting to Clients](#4-connecting-to-clients)
6. [Performance Optimization](#5-performance-optimization)
7. [Troubleshooting](#6-troubleshooting)
8. [FAQ](#faq)

---

## Important Pre-Read: Model Name Clarification

**The model you likely want is `Qwen3-30B-A3B`** (not "Qwen3.5 35B A3B" — that name doesn't exist in the Qwen3 or Qwen2.5 families).

`Qwen3-30B-A3B` is a **Mixture-of-Experts (MoE)** model:
- **35B total parameters** across 8 expert路由 networks
- **3B active parameters** per token (hence "A3B")
- Exactly 35B total params as you described, so this is almost certainly what you meant

If you specifically want a dense 35B model, the closest in Qwen3 is **Qwen3-32B**. There is no Qwen3-35B.

All examples below use `Qwen/Qwen3-30B-A3B-Instruct` — swap in your actual model ID.

---

## 1. vLLM Installation (AMD GPU / ROCm)

### 1.1 Prerequisites

#### OS & Driver
- **Linux** (Ubuntu 20.04+ recommended; ROCm does not support Windows for LLM inference)
- **ROCm driver** installed and working
- Verify with:
  ```bash
  rocminfo
  # Should list your GPU. Look for "gfx" compute architecture.
  hipinfo
  ```

#### Python Version
- **Python 3.10–3.12** (3.10 or 3.11 recommended for ROCm stability)
- Check: `python3 --version`

#### GPU Architecture for Strix Halo
Strix Halo APUs (Ryzen AI Max) use **RDNA 3.5** architecture (gfx1151). This is newer consumer-tier hardware, so verify ROCm support for your specific arch:
```bash
rocminfo | grep gfx
```
Common Strix Halo gfx IDs: `gfx1100`, `gfx1101`, `gfx1150`, `gfx1151` (Zen5 APU variants).

> **⚠️ Strix Halo / RDNA 3.5 support in ROCm is relatively new.** If your `rocminfo` doesn't show the GPU or you get errors, check the [ROCm compatibility matrix](https://rocm.docs.amd.com/en/latest/release/gpu-os-support.html) for your exact APU model. Some RDNA 3 consumer GPUs need ROCm 6.2+ or newer kernels.

---

### 1.2 ROCm Installation

If ROCm isn't installed yet, on Ubuntu:

```bash
# Add ROCm repository
wget https://repo.radeon.com/rocm/rocm.gpgkey -O - | sudo tee /etc/apt/trusted.gpg.d/rocm.gpg
echo "deb [arch=amd64] https://repo.radeon.com/rocm/apt/7.2.2 ubuntu/" | sudo tee /etc/apt/sources.list.d/rocm.list
sudo apt update

# Install ROCm (includes HIP runtime, compiler, libraries)
sudo apt install -y rocm-hip-sdk

# Verify installation
rocminfo | head -30
```

Set environment variables (add to `~/.bashrc`):
```bash
export ROCM_PATH=/opt/rocm
export HIP_PATH=/opt/rocm/hip
export PATH=$ROCM_PATH/bin:$PATH
export LD_LIBRARY_PATH=$ROCM_PATH/lib:$LD_LIBRARY_PATH
```

---

### 1.3 PyTorch for ROCm

```bash
# Uninstall existing torch to avoid version conflicts
pip uninstall torch -y

# Install PyTorch for ROCm 7.2 (adjust rocm version to match your install)
pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/rocm7.2
```

Verify PyTorch sees the GPU:
```bash
python3 -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'No GPU')"
```

---

### 1.4 Triton for ROCm

```bash
pip install ninja cmake wheel pybind11
pip uninstall -y triton

git clone https://github.com/ROCm/triton.git
cd triton
# Use the commit validated in vLLM's ROCm Dockerfile
git checkout f9e5bf54
if [ ! -f setup.py ]; then cd python; fi
python3 setup.py install
cd ../..
```

---

### 1.5 Flash Attention for ROCm (Optional but Recommended)

```bash
git clone https://github.com/Dao-AILab/flash-attention.git
cd flash-attention
git checkout 0e60e394
git submodule update --init

# Get your gfx architecture
GPU_ARCHS=$(rocminfo | grep -o 'gfx[0-9]*' | head -1)
echo "Building for architecture: $GPU_ARCHS"

python3 setup.py install
cd ..
```

---

### 1.6 Build vLLM from Source

**This is required for AMD/ROCm.** pip wheels for AMD GPUs are not published.

```bash
git clone https://github.com/vllm-project/vllm.git
cd vllm

# Check latest stable tag (recommended for production)
git fetch --tags
git checkout $(git describe --tags --abbrev=0)

# Install build dependencies
pip install --upgrade pip
pip install -r requirements/rocm.txt

# Set GPU architecture (replace gfx1100 with your actual gfx from rocminfo)
# For Strix Halo RDNA 3.5: gfx1100, gfx1101, gfx1150, gfx1151 — try gfx1100 first
export PYTORCH_ROCM_ARCH="gfx1100"

# Build and install
python3 setup.py develop
```

> **Build time:** 5–15 minutes on a fast machine. Use `MAX_JOBS=6` if you want to limit parallelism and avoid OOM during compilation:
> ```bash
> export MAX_JOBS=6
> python3 setup.py develop
> ```

**To use a specific ROCm version (e.g., 7.0 for MI300):**
```bash
export PYTORCH_ROCM_ARCH="gfx942"  # MI300 series
```

---

### 1.7 Verify Installation

```bash
python3 -c "
from vllm import LLM
print('vLLM imported successfully')

import torch
print(f'PyTorch version: {torch.__version__}')
print(f'ROCm available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'Device: {torch.cuda.get_device_name(0)}')
    print(f'Architecture: gfx', torch.cuda.get_device_capability(0))
"
```

Expected output:
```
vLLM imported successfully
PyTorch version: 2.x.x+rocm...
ROCm available: True
Device: AMD Radeon ...
```

If you see `ROCm available: False`, your PyTorch wasn't built with ROCm support or the HIP runtime isn't visible.

---

## 2. Running Models

### 2.1 Qwen3-30B-A3B-Instruct on vLLM

Basic offline inference:
```bash
python3 -c "
from vllm import LLM, SamplingParams

llm = LLM(
    model='Qwen/Qwen3-30B-A3B-Instruct',
    tensor_parallel_size=1,           # Single GPU; increase for multi-GPU
    max_model_len=8192,              # Adjust based on your needs
    gpu_memory_utilization=0.90,      # Use 90% of VRAM
)

sampling_params = SamplingParams(temperature=0.7, top_p=0.8, max_tokens=512)
outputs = llm.generate(['Explain quantum entanglement in simple terms.'], sampling_params)

for output in outputs:
    print(output.outputs[0].text)
"
```

### 2.2 Memory Footprint & Optimization for 128GB VRAM

Qwen3-30B-A3B is a MoE model — memory usage is significantly lower than a dense 35B:

| Config | Est. VRAM |
|--------|-----------|
| FP16, no quantization, full model | ~70GB |
| FP8 (quantized) | ~35–45GB |
| AWQ / GPTQ INT4 | ~18–25GB |
| With KV cache (8192 ctx) | +2–8GB depending on batch |

**With 128GB VRAM, you have headroom for:**
- The model in FP16 without quantization
- Speculative decoding draft model loaded alongside
- Larger batch sizes
- Longer context windows

**Recommended baseline config for 128GB:**
```bash
python3 -c "
from vllm import LLM, SamplingParams

llm = LLM(
    model='Qwen/Qwen3-30B-A3B-Instruct',
    tensor_parallel_size=1,
    max_model_len=16384,             # 16K context — plenty for most tasks
    gpu_memory_utilization=0.85,     # Leave headroom for draft model
    enforce_eager=False,             # Use CUDA graphs for speed (default)
    block_size=16,                   # KV cache block size
)
print('Model loaded successfully')
"
```

### 2.3 Quantization Options

**FP8 (recommended for speed + memory balance):**
```python
llm = LLM(
    model='Qwen/Qwen3-30B-A3B-Instruct',
    quantization='fp8',              # vLLM native FP8
    tensor_parallel_size=1,
    max_model_len=16384,
    gpu_memory_utilization=0.85,
)
```

**AWQ INT4 (if you need more headroom):**
```bash
# Install llm-compressor for AWQ quantization
pip install llm-compressor
```
```python
from llmcompressor.transformers import oneshot
from transformers import AutoTokenizer

# Quantize first
oneshot(
    model='Qwen/Qwen3-30B-A3B-Instruct',
    dataset='test',
    output_dir='Qwen/Qwen3-30B-A3B-Instruct-FP8',
    quantization='W4A16AWQ',
)

# Load quantized model
llm = LLM(
    model='Qwen/Qwen3-30B-A3B-Instruct-FP8',
    tensor_parallel_size=1,
    max_model_len=16384,
)
```

### 2.4 Baseline Performance Measurement

```bash
# Benchmark with vLLM's built-in benchmark
python3 -c "
import time
from vllm import LLM, SamplingParams

llm = LLM(
    model='Qwen/Qwen3-30B-A3B-Instruct',
    tensor_parallel_size=1,
    max_model_len=8192,
    gpu_memory_utilization=0.85,
)

prompts = ['Write a detailed explanation of how neural networks learn.' for _ in range(10)]
sampling_params = SamplingParams(temperature=0.8, top_p=0.95, max_tokens=512)

# Warmup
llm.generate(prompts[:2], sampling_params)

# Benchmark
start = time.time()
results = llm.generate(prompts, sampling_params)
elapsed = time.time() - start

total_tokens = sum(len(r.outputs[0].token_ids) for r in results)
print(f'Prompts: {len(prompts)}')
print(f'Total tokens: {total_tokens}')
print(f'Time: {elapsed:.2f}s')
print(f'Tokens/sec: {total_tokens/elapsed:.1f}')
print(f'Latency per prompt: {elapsed/len(prompts)*1000:.0f}ms')
"
```

---

## 3. Speculative Decoding

### 3.1 How It Works

Speculative decoding uses a small **draft model** (the "speculator") to propose multiple tokens ahead, then the large **target model** (the "verifier") to verify them in a single forward pass. Accepted tokens are output immediately; rejected tokens trigger a re-sample.

Key benefits:
- **Lossless** — every accepted token matches the target model's distribution exactly
- **Faster first-token latency** under low-QPS (single-user) workloads
- **Higher throughput** for medium-to-low concurrency scenarios

### 3.2 Method Comparison

| Method | Speedup | Draft Model Needed | Notes |
|--------|---------|-------------------|-------|
| **EAGLE** | High | Yes | Best general-purpose choice |
| **EAGLE3** | High | Yes | Autoregressive variant; often better than EAGLE for some workloads |
| **MLPSpeculator** | Medium–High | Yes | Good when a compatible pre-trained model exists |
| **MTP** | High | Only if model has native MTP | Limited model support |
| **N-gram** | Low–Medium | No | No extra model; dynamic speculation |
| **Suffix decoding** | Low–Medium | No | No extra model; suffix-tree based |

**Recommendation for Qwen3-30B-A3B:** Use **EAGLE3** with `RedHatAI/Qwen3-30B-A3B-Instruct-2507-speculator.eagle3`.

### 3.3 Pre-Trained EAGLE3 Speculators

Available speculators on HuggingFace:

| Target Model | Speculator | Size |
|-------------|-----------|------|
| Qwen3-30B-A3B-Instruct | `RedHatAI/Qwen3-30B-A3B-Instruct-2507-speculator.eagle3` | 0.5B |
| Qwen3-8B | `RedHatAI/Qwen3-8B-speculator.eagle3` | 1B |
| Qwen3-14B | `RedHatAI/Qwen3-14B-speculator.eagle3` | 1B |
| Qwen3-32B | `RedHatAI/Qwen3-32B-speculator.eagle3` | 2B |
| Llama-3.1-8B-Instruct | `RedHatAI/Llama-3.1-8B-Instruct-speculator.eagle3` | 1B |
| Llama-3.3-70B-Instruct | `RedHatAI/Llama-3.3-70B-Instruct-speculator.eagle3` | 2B |

> **Note for Qwen3-30B-A3B:** This model uses a MoE architecture (35B total / 3B active). There is a pre-trained EAGLE3 speculator for it: `RedHatAI/Qwen3-30B-A3B-Instruct-2507-speculator.eagle3` (500M params).

### 3.4 Running vLLM with Speculative Decoding

**EAGLE method:**
```python
from vllm import LLM, SamplingParams

llm = LLM(
    model='Qwen/Qwen3-30B-A3B-Instruct',
    tensor_parallel_size=1,
    max_model_len=16384,
    gpu_memory_utilization=0.80,     # Lower to leave room for draft model
    speculative_config={
        'model': 'RedHatAI/Qwen3-30B-A3B-Instruct-2507-speculator.eagle3',
        'draft_tensor_parallel_size': 1,
        'num_speculative_tokens': 2,    # Draft 2 tokens ahead
        'method': 'eagle',               # EAGLE (not autoregressive)
    },
)

sampling_params = SamplingParams(temperature=0.7, top_p=0.8, max_tokens=512)
outputs = llm.generate(['Explain the concept of entropy.'], sampling_params)

for output in outputs:
    print(output.outputs[0].text)
```

**EAGLE3 method (autoregressive):**
```python
from vllm import LLM, SamplingParams

llm = LLM(
    model='Qwen/Qwen3-30B-A3B-Instruct',
    tensor_parallel_size=1,
    max_model_len=16384,
    gpu_memory_utilization=0.75,     # Leave more room for EAGLE3
    speculative_config={
        'model': 'RedHatAI/Qwen3-30B-A3B-Instruct-2507-speculator.eagle3',
        'draft_tensor_parallel_size': 1,
        'num_speculative_tokens': 2,
        'method': 'eagle3',              # EAGLE3 (autoregressive)
    },
)
```

**MLPSpeculator (if using IBM's pre-trained models):**
```python
llm = LLM(
    model='meta-llama/Meta-Llama-3.1-8B-Instruct',  # Example
    tensor_parallel_size=1,
    speculative_config={
        'model': 'ibm-ai-platform/llama3-8b-accelerator',
        'draft_tensor_parallel_size': 1,
        'method': 'mlp_speculator',
    },
)
```

### 3.5 Tuning `num_speculative_tokens`

- **2** is a safe default for most setups
- **Higher values** (4–8) can help if draft model acceptance rate is very high (>95%)
- **Lower values** (1) if acceptance rate is low or VRAM is tight
- Monitor acceptance rate in vLLM logs — aim for >85% acceptance

### 3.6 Training a Custom P-EAGLE Drafter

If no pre-trained speculator exists for your target model, use the [`speculators`](https://github.com/vllm-project/speculators) library to train one:

```bash
# Install speculators
pip install speculators

# Or for development version:
git clone https://github.com/vllm-project/speculators.git
cd speculators
pip install -e ".[datagen]"
```

**Step 1: Generate training data (hidden states from vLLM)**

```python
# From speculators/examples/data_generation_and_training/qwen3_8b_sharegpt_ultrachat.py
# Run hidden state extraction on your target model
from speculators import SpeculatorDatasetGenerator
from vllm import LLM

generator = SpeculatorDatasetGenerator(
    model='Qwen/Qwen3-30B-A3B-Instruct',
    output_dir='./training_data/',
    dataset_name='teknium/OpenHermes-2.5',
    num_samples=5000,
    tensor_parallel_size=1,
)
generator.generate()
```

**Step 2: Train the draft model**

```python
from speculators import EAGLETrainer

trainer = EAGLETrainer(
    target_model='Qwen/Qwen3-30B-A3B-Instruct',
    training_data='./training_data/',
    output_dir='./my-custom-speculator',
    drafter architecture='eagle3',    # or 'eagle'
    num_layers=2,                     # Number of draft model layers
    hidden_size=2048,
    lr=1e-4,
    epochs=5,
    batch_size=8,
)
trainer.train()
```

**Step 3: Deploy in vLLM**

```python
llm = LLM(
    model='Qwen/Qwen3-30B-A3B-Instruct',
    tensor_parallel_size=1,
    speculative_config={
        'model': './my-custom-speculator',
        'draft_tensor_parallel_size': 1,
        'num_speculative_tokens': 2,
        'method': 'eagle3',
    },
)
```

### 3.7 Measuring Speedup from Speculative Decoding

```bash
python3 -c "
import time
from vllm import LLM, SamplingParams

# WITHOUT speculative decoding
print('=== Baseline (no speculative decoding) ===')
llm_baseline = LLM(
    model='Qwen/Qwen3-30B-A3B-Instruct',
    tensor_parallel_size=1,
    max_model_len=8192,
    gpu_memory_utilization=0.85,
)
sampling_params = SamplingParams(temperature=0.7, max_tokens=512)
prompts = ['What is the capital of France?' for _ in range(5)]

# Warmup
llm_baseline.generate(prompts[:2], sampling_params)

start = time.time()
results_baseline = llm_baseline.generate(prompts, sampling_params)
baseline_time = time.time() - start
baseline_tokens = sum(len(r.outputs[0].token_ids) for r in results_baseline)
print(f'Time: {baseline_time:.2f}s, Tokens: {baseline_tokens}, Tok/s: {baseline_tokens/baseline_time:.1f}')

# WITH speculative decoding
print()
print('=== With EAGLE3 speculative decoding ===')
llm_spec = LLM(
    model='Qwen/Qwen3-30B-A3B-Instruct',
    tensor_parallel_size=1,
    max_model_len=8192,
    gpu_memory_utilization=0.75,
    speculative_config={
        'model': 'RedHatAI/Qwen3-30B-A3B-Instruct-2507-speculator.eagle3',
        'draft_tensor_parallel_size': 1,
        'num_speculative_tokens': 2,
        'method': 'eagle3',
    },
)

# Warmup
llm_spec.generate(prompts[:2], sampling_params)

start = time.time()
results_spec = llm_spec.generate(prompts, sampling_params)
spec_time = time.time() - start
spec_tokens = sum(len(r.outputs[0].token_ids) for r in results_spec)
print(f'Time: {spec_time:.2f}s, Tokens: {spec_tokens}, Tok/s: {spec_tokens/spec_time:.1f}')
print(f'Speedup: {baseline_time/spec_time:.2f}x')
"
```

---

## 4. Connecting to Clients

### 4.1 Start the OpenAI-Compatible API Server

```bash
python3 -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen3-30B-A3B-Instruct \
    --host 0.0.0.0 \
    --port 8000 \
    --served-model-name qwen3-30b-a3b \
    --tensor-parallel-size 1 \
    --max-model-len 16384 \
    --gpu-memory-utilization 0.80 \
    --dtype float16
```

**With speculative decoding:**
```bash
python3 -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen3-30B-A3B-Instruct \
    --host 0.0.0.0 \
    --port 8000 \
    --served-model-name qwen3-30b-a3b-spec \
    --tensor-parallel-size 1 \
    --max-model-len 16384 \
    --gpu-memory-utilization 0.75 \
    --speculative-model RedHatAI/Qwen3-30B-A3B-Instruct-2507-speculator.eagle3 \
    --num-speculative-tokens 2 \
    --speculative-method eagle3
```

The server is now accessible at:
- **Chat completions:** `http://localhost:8000/v1/chat/completions`
- **Completions:** `http://localhost:8000/v1/completions`
- **Models:** `http://localhost:8000/v1/models`

### 4.2 Basic API Test

```bash
curl http://localhost:8000/v1/models

curl http://localhost:8000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "qwen3-30b-a3b",
        "messages": [{"role": "user", "content": "Say hello in one sentence."}],
        "max_tokens": 100,
        "temperature": 0.7
    }'
```

### 4.3 Python Client

```python
from openai import OpenAI

client = OpenAI(
    base_url='http://localhost:8000/v1',
    api_key='not-needed',  # or set --api-key on server
)

response = client.chat.completions.create(
    model='qwen3-30b-a3b-spec',
    messages=[
        {'role': 'system', 'content': 'You are a helpful assistant.'},
        {'role': 'user', 'content': 'What is 2+2?'}
    ],
    temperature=0.7,
    max_tokens=200,
)

print(response.choices[0].message.content)
```

### 4.4 Connecting OpenCode (Claude Code Alternative)

OpenCode connects via OpenAI-compatible API. In your OpenCode config:

```json
{
  "models": {
    "qwen3-30b-a3b": {
      "provider": "openai",
      "api_base": "http://localhost:8000/v1",
      "api_key": "not-needed",
      "model_id": "qwen3-30b-a3b-spec"
    }
  },
  "model": "qwen3-30b-a3b"
}
```

### 4.5 Connecting Jan

Jan (jan.ai) is a local AI app that supports OpenAI-compatible APIs:

1. Open Jan → Settings → **Models**
2. Click **Add Model** or configure the API Endpoint
3. Set:
   - **API Base URL:** `http://localhost:8000/v1`
   - **API Key:** `not-needed` (or whatever you set)
   - **Model Name:** `qwen3-30b-a3b-spec`
4. Save and select the model

### 4.6 Connecting text-generation-webui (oobabooga)

In text-generation-webui:
1. Go to **UI Settings** → **API** tab
2. Enable **API**
3. Set **API port** (default 5000)
4. In **Model** tab, set **model loader** to **vLLM** (if available) or use the **OpenAI compatible** endpoint:

```bash
# In text-generation-webui's model panel, use Custom Node:
# API base: http://localhost:8000/v1
# Model: qwen3-30b-a3b-spec
```

Or run text-generation-webui in **openai** mode pointing to your vLLM server:
```bash
python3 server.py --model qwen3-30b-a3b-spec --openai-api-compatible --listen
```

### 4.7 Authentication

To add API key auth:
```bash
python3 -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen3-30B-A3B-Instruct \
    --api-key my-secret-key \
    --host 0.0.0.0 \
    --port 8000
```

Then in clients:
```python
client = OpenAI(
    base_url='http://localhost:8000/v1',
    api_key='my-secret-key',
)
```

For production, consider running behind a reverse proxy (nginx) with TLS termination.

---

## 5. Performance Optimization

### 5.1 Tensor Parallelism (Multi-GPU)

If you have multiple AMD GPUs (e.g., 2× or 4× Strix Halo in a workstation):
```bash
# 2 GPUs
--tensor-parallel-size 2

# 4 GPUs
--tensor-parallel-size 4
```

> **Note:** Tensor parallelism with ROCm uses NCCL for communication. Ensure `rccl` is installed:
> ```bash
> pip install rccl
> ```

### 5.2 KV Cache Tuning

The KV cache is critical for throughput. Key parameters:

```bash
--max-model-len 16384          # Context length; set as high as you need
--block-size 16                 # Larger blocks = less overhead, less fragmentation
--num-gpu-blocks-override      # Manually override KV cache GPU blocks
--gpu-memory-utilization 0.80  # Fraction of VRAM for KV cache
```

Calculate required KV cache size:
```
KV_cache_size = 2 * num_layers * num_heads * head_dim * bytes_per_param * max_model_len * batch_size
```

For Qwen3-30B-A3B: 56 layers, 128 heads, 128 head_dim, BF16.

### 5.3 Batch Sizes and Concurrency

```bash
--max-num-batched-tokens 8192     # Max tokens in a single batch
--max-num-seqs 256                # Max concurrent sequences
--max-los-adapters 8              # Max LoRAs (if using LoRA)
```

For single-user (latency-focused) workloads, keep `max-num-seqs` low (8–16). For throughput, increase it.

### 5.4 Continuous Batching

vLLM uses continuous batching by default, which maximizes GPU utilization across interleaved requests.

### 5.5 CUDA Graphs

Enabled by default (`enforce_eager=False`). This captures and replays computation graphs for faster kernel launches. Keep it enabled unless debugging.

### 5.6 Chunked Prefill

Enabled by default. Splits large prefill sequences into chunks to reduce memory spikes and improve latency under concurrent load.

### 5.7 Memory Optimization Checklist

For 128GB VRAM with Qwen3-30B-A3B + speculative decoding:

```bash
--gpu-memory-utilization 0.75     # Leave headroom for draft model + KV cache
--max-model-len 16384             # Don't over-allocate context
--block-size 16                   # Good balance
--enforce-eager False             # CUDA graphs (default)
```

Expected VRAM usage:
- Qwen3-30B-A3B-Instruct (FP16): ~65–70GB
- EAGLE3 speculator (500M, FP16): ~1–2GB
- KV cache (16K ctx, batch 16): ~10–15GB
- **Total: ~80–85GB** — well within 128GB

---

## 6. Troubleshooting

### 6.1 Common ROCm Issues

**"ROCm not found" / `hipErrorNoBinaryForGpu`**
```
Solution: Set the correct GPU architecture
export PYTORCH_ROCM_ARCH="gfx1100"   # or whatever your rocminfo shows
# Rebuild vLLM after changing this
```

**"hipErrorInvalidIndex" during model loading**
```
Cause: Incorrect PYTORCH_ROCM_ARCH or ROCm version mismatch
Fix: Verify with rocminfo | grep gfx, then rebuild with correct arch
```

**"hipBLASLt not found" or BLAS errors**
```
Fix: Install ROCm's BLAS library
pip install rocblas rocsolver
```

**Triton compilation errors**
```
Fix: Use the exact Triton commit from Dockerfile:
git checkout f9e5bf54
```

### 6.2 Memory Errors

**OOM during model loading:**
```
torch.cuda.OutOfMemoryError
```
Fixes:
- Reduce `--gpu-memory-utilization` (e.g., 0.75 → 0.70)
- Reduce `--max-model-len`
- Enable quantization: `--quantization fp8`
- Disable speculative decoding (frees draft model memory)

**OOM during KV cache allocation:**
```
ValueError: Cannot allocate kv cache. 
```
Fixes:
- Reduce `--max-model-len`
- Reduce `--gpu-memory-utilization`
- Reduce batch size

**KV cache allocation failure with no OOM:**
```
Cause: fragmentation in KV cache blocks
Fix: Reduce `--block-size` to 8, or increase `--gpu-memory-utilization` slightly
```

### 6.3 Model Loading Failures

**"safetensors" or "-shard" file errors:**
```bash
# Re-download the model
rm -rf ~/.cache/huggingface/hub/<model-name>
# Then re-run
```

**Wrong model architecture:**
```
ValueError: Model architecture not supported
```
Fix: Check that the model is in vLLM's supported models list. Qwen3-30B-A3B should be supported in vLLM 0.6+.

**Missing tokenizer:**
```python
# Manually specify tokenizer
llm = LLM(
    model='Qwen/Qwen3-30B-A3B-Instruct',
    tokenizer='Qwen/Qwen3-30B-A3B-Instruct',  # Force tokenizer
    ...
)
```

### 6.4 Speculative Decoding Issues

**Low acceptance rate (< 50%):**
- Increase `num_speculative_tokens` (try 1 instead of 2, or 4 instead of 2)
- Use a different draft model — not all draft models work well with all targets
- EAGLE3 often has better acceptance rates than EAGLE for some models

**"Speculative model type not supported":**
```
Cause: Draft model not compatible with target model
Fix: Only use pre-trained speculators designed for your specific target model
     Or train a custom speculator with speculators library
```

**Server hangs on first request with speculative decoding:**
- This is often a warmup issue. Run 2–3 warmup prompts before measuring
- Reduce `num_speculative_tokens` to 1

**vLLM log shows "rejected X/Y tokens":**
```
This is normal! Acceptance rate = X/Y
Target: >85% for good performance
If much lower, try a different draft model or method
```

### 6.5 Strix Halo Specific Issues

**Strix Halo GPU not visible to ROCm:**
```
# Check if HIP can see the device
hipinfo
# If empty or shows no devices, ROCm may not support your kernel/driver

# Check kernel version — ROCm needs a recent kernel
uname -r
# ROCm 7.x typically needs kernel 5.15+

# Try ROCm 7.2 (latest stable) or 7.0 if having issues
```

**RDNA 3.5 (gfx115x) not supported in ROCm 7.0:**
```
ROCm 7.0 only has limited RDNA 3 support.
ROCm 7.2 has better RDNA 3.5 support.
Check https://rocm.docs.amd.com/en/latest/release/gpu-os-support.html
```

**Poor performance on Strix Halo:**
- ROCm on consumer RDNA GPUs may not be as optimized as MI series
- Try `--enforce_eager True` to rule out CUDA graph issues
- Report issues to ROCm GitHub with your exact GPU and ROCm version

---

## FAQ

**Q: Should I use pip install vllm or build from source?**
On AMD GPUs, you **must** build from source. pip wheels are CUDA-only.

**Q: Can I use vLLM with ROCm on Windows?**
No. ROCm only supports Linux. Use WSL2 if on Windows.

**Q: My Strix Halo has 128GB VRAM — is that real?**
Yes, Strix Halo (Ryzen AI Max) uses unified memory architecture. The "VRAM" is actually system RAM that's accessible by the GPU with a shared pool. Performance is good but bandwidth is lower than a discrete GPU with dedicated HBM.

**Q: What's the difference between EAGLE and EAGLE3?**
EAGLE (P-EAGLE) is the original method — it uses a separate draft model that conditions on context vectors. EAGLE3 is an autoregressive variant that also conditions on previously drafted tokens. EAGLE3 often performs better for same model size.

**Q: Can I use speculative decoding with tensor parallelism?**
Yes, set `--speculative-draft-tensor-parallel-size` independently from the target model TP size. For single GPU, both are 1.

**Q: Why is speculative decoding slower for high-QPS (many concurrent users)?**
Speculative decoding is designed for latency reduction under **low QPS** (1–4 concurrent users). At high concurrency, continuous batching alone provides better throughput. Speculative decoding adds overhead that doesn't pay off when the batch is already large.

**Q: How do I check if speculative decoding is actually running?**
```
# Look for acceptance rate in vLLM server logs
# vLLM logs "Accepted X/Y tokens" for each request
# Or check metrics endpoint:
curl http://localhost:8000/metrics | grep spec

# The vLLM metric to watch:
# vllm:spec_decode_accept_rate - acceptance rate per request
```

**Q: Can I use vLLM with OctoAI or other cloud providers instead?**
Yes, OctoAI, Together, Anyscale, etc. all offer vLLM-backed OpenAI-compatible APIs. This guide is for self-hosted local inference. Cloud endpoints work the same API-wise — just change the `base_url`.

**Q: What's the best way to monitor vLLM performance?**
```bash
# Prometheus metrics endpoint
curl http://localhost:8000/metrics

# Key metrics:
# - vllm:num_tokens_running           (current batch size)
# - vllm:gpu_cache_usage_ratio       (KV cache utilization)
# - vllm:spec_decode_acceptance_rate  (speculative acceptance)
# - vllm:time_to_first_token          (first token latency)
# - vllm:time_per_output_token        (inter-token latency)
```

**Q: I see different results with vs without speculative decoding on greedy sampling. Is this a bug?**
Greedy sampling with speculative decoding should be **lossless** and produce identical results. If you see differences:
- This can happen due to floating-point precision differences in batched vs non-batched execution
- It's not a correctness bug — outputs are statistically equivalent
- For reproducible results, disable speculative decoding

**Q: Can I use LoRA adapters with speculative decoding?**
Yes, MultiLoRA is supported with speculative decoding. Set `--max-loras` and specify the LoRA at request time.

---

## Quick-Reference: Complete Start Commands

### Minimal start (no speculative decoding)
```bash
python3 -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen3-30B-A3B-Instruct \
    --host 0.0.0.0 --port 8000 \
    --tensor-parallel-size 1 \
    --max-model-len 16384 \
    --gpu-memory-utilization 0.85 \
    --dtype float16
```

### With EAGLE3 speculative decoding
```bash
python3 -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen3-30B-A3B-Instruct \
    --host 0.0.0.0 --port 8000 \
    --tensor-parallel-size 1 \
    --max-model-len 16384 \
    --gpu-memory-utilization 0.75 \
    --speculative-model RedHatAI/Qwen3-30B-A3B-Instruct-2507-speculator.eagle3 \
    --num-speculative-tokens 2 \
    --speculative-method eagle3 \
    --dtype float16
```

### With FP8 quantization + speculative decoding
```bash
python3 -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen3-30B-A3B-Instruct \
    --quantization fp8 \
    --host 0.0.0.0 --port 8000 \
    --tensor-parallel-size 1 \
    --max-model-len 16384 \
    --gpu-memory-utilization 0.80 \
    --speculative-model RedHatAI/Qwen3-30B-A3B-Instruct-2507-speculator.eagle3 \
    --num-speculative-tokens 2 \
    --speculative-method eagle3
```

---

*Guide compiled March 2026. For the latest vLLM ROCm instructions, check [vLLM AMD Installation Docs](https://docs.vllm.ai/en/latest/getting_started/installation/gpu/index.html) and the [Speculators library](https://github.com/vllm-project/speculators).*
