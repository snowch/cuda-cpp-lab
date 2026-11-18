# GPU Lab: how the GPU result reaches Console: narrated deck walkthrough, shot list

Each slide appears 0.5 s before its narration and holds after it, so every boundary is a clean cut point. 3840×2160, 30 fps, narration at -16 LUFS (the same as the demo video). Each video comes narrated, with soft English captions, and silent.

## l1-review (2:10.8)

| Slide | Time | Narration |
|---|---|---|
| 1 | 0:00.0 – 0:08.1 | The lesson supplies a complete starter program. This walkthrough explains how its GPU result reaches the Console. |
| 2 | 0:08.1 – 0:15.1 | The GPU writes 42.0, but the CPU prints it. What connects those two steps? |
| 3 | 0:15.1 – 0:24.4 | hello is a kernel: a function that runs on the GPU. Its body writes 42.0 into output[0]. |
| 4 | 0:24.4 – 0:31.6 | The supplied setup reserves space for that value in GPU memory. You can leave this setup unchanged. |
| 5 | 0:31.6 – 0:38.1 | In main, the CPU launches hello. The two ones request one block containing one thread. |
| 6 | 0:38.1 – 0:47.8 | A thread is one execution of the kernel. An SM, or streaming multiprocessor, is GPU hardware that executes its instructions. |
| 7 | 0:47.8 – 0:54.4 | The thread writes 42.0 into output[0] in GPU memory. |
| 8 | 0:54.4 – 1:01.8 | The program also has a CPU variable named value. main initialises it to 0.0. |
| 9 | 1:01.8 – 1:09.1 | Suppose the GPU write and the CPU initialisation have both finished. The copy has not started. |
| 10 | 1:09.1 – 1:22.9 | Pause here. Is the CPU variable value still 0.0, or has the GPU write changed it to 42.0? |
| 11 | 1:22.9 – 1:31.8 | value is still 0.0. The GPU wrote to output[0], a different location in GPU memory. |
| 12 | 1:31.8 – 1:38.5 | The cudaMemcpy call copies the GPU result into value in CPU memory. |
| 13 | 1:38.5 – 1:46.2 | For this call, main waits for the copy to complete before continuing. value now holds 42.0. |
| 14 | 1:46.2 – 1:54.3 | The CPU reads value and prints 42.0 in Console. The kernel itself did not print that line. |
| 15 | 1:54.3 – 2:03.3 | The SM executes the thread. GPU memory holds its result. The copy makes that result available to CPU code. |
| 16 | 2:03.3 – 2:10.8 | Return to the lesson. Find the assignment inside hello, then the copy and print calls inside main. |
