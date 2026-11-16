// Copyright © 2026 Christopher Snow.
export const practicalLessons = [
  {slug:'verify-every-output', title:'Check every GPU result', practical:true, program:true,
    goal:'Compare every output with a CPU reference, then diagnose a safe indexing error.', focus:'cpu'},
  {slug:'grid-stride-loops', title:'Process more inputs than the launch has threads', practical:true, program:true,
    goal:'Give each input one owner with a grid-stride loop, including tails and empty inputs.', focus:'sm'},
  {slug:'multi-block-scan', title:'Carry a prefix across blocks', practical:true, program:true,
    goal:'Combine local scans, block totals and block starts in an ordered GPU pipeline.', focus:'shared'},
  {slug:'resource-tradeoffs', title:'Explain an SM resource trade-off', practical:true,
    goal:'Calculate a residency limit and identify which hardware observation could test an optimisation.', focus:'registers'},
  {slug:'measure-a-kernel', title:'Measure a GPU kernel fairly', practical:true,
    goal:'Separate correctness, kernel timing and profiling, then interpret recorded evidence.', focus:'execution'},
  {slug:'softmax-capstone', title:'Build and verify a stable softmax', practical:true, program:true,
    goal:'Implement an independent row-wise kernel, verify unseen shapes and explain its bottleneck.', focus:'shared'},
];
