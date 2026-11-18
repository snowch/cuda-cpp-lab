# Lesson 1 recording — review copy

Question: How does a GPU-written value reach the CPU Console?

This is a narrated illustration of the supplied `examples/first-kernel.cu`, not a screen capture of a new execution or a hardware timing trace.

## Why is a copy needed?

The lesson supplies a complete starter program. This walkthrough explains how its GPU result reaches the Console. The GPU writes 42.0, but the CPU prints it. What connects those two steps?

## The kernel runs on the GPU

hello is a kernel: a function that runs on the GPU. Its body writes 42.0 into output[0].

## The starter prepares GPU storage

The supplied setup reserves space for that value in GPU memory. You can leave this setup unchanged.

## The CPU launches hello

In main, the CPU launches hello. The two ones request one block containing one thread.

## One thread executes on an SM

A thread is one execution of the kernel. An SM, or streaming multiprocessor, is GPU hardware that executes its instructions.

## The thread writes GPU memory

The thread writes 42.0 into output[0] in GPU memory.

## The CPU has a separate variable

The program also has a CPU variable named value. main initialises it to 0.0.

## Pause before the copy

Suppose the GPU write and the CPU initialisation have both finished. The copy has not started. Pause here. Is the CPU variable value still 0.0, or has the GPU write changed it to 42.0?

## The GPU write did not change value

value is still 0.0. The GPU wrote to output[0], a different location in GPU memory.

## The copy transfers the result

The cudaMemcpy call copies the GPU result into value in CPU memory.

## The copy completes before printing

For this call, main waits for the copy to complete before continuing. value now holds 42.0.

## The CPU prints its copy

The CPU reads value and prints 42.0 in Console. The kernel itself did not print that line.

## Execution, storage and transfer

The SM executes the thread. GPU memory holds its result. The copy makes that result available to CPU code.

## Try tracing the same path

Return to the lesson. Find the assignment inside hello, then the copy and print calls inside main.
