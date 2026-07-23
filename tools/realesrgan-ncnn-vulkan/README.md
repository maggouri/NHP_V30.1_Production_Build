# Local Real-ESRGAN Upscaler

Put the free `realesrgan-ncnn-vulkan` executable here:

```text
tools/realesrgan-ncnn-vulkan/realesrgan-ncnn-vulkan.exe
```

Studio will use it only when the `Local AI Upscale (Real-ESRGAN)` checkbox is enabled.
If the executable is missing or fails, Studio falls back to the current Canvas 5K resize path.

Alternative: set the environment variable `NHP_REALESRGAN_EXE` to the full path of `realesrgan-ncnn-vulkan.exe`.

