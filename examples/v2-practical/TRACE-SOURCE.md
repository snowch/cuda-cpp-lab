# Published GPU trace excerpt

Eight unmodified kernel events and device properties extracted from PyTorch Kineto's
`tb_plugin/samples/resnet50_num_workers_0/worker0.1623143089861.pt.trace.json.gz`
at commit `486c083b84a53c60aec0d2c522c1fc5b99ce5284` (v0.4.0).

Source: https://github.com/pytorch/kineto/blob/486c083b84a53c60aec0d2c522c1fc5b99ce5284/tb_plugin/samples/resnet50_num_workers_0/worker0.1623143089861.pt.trace.json.gz

Compressed source SHA-256: `a91798b500ce9d6e21c416ce32dcd8ecf4788489df86f59ba2f944906c90b853`.

The source reports Tesla V100-DGXS-32GB devices. Filename identifies a ResNet50
sample with zero data-loader workers. Toolkit version, warm-up, repetitions,
validation and capture settings are not recorded here and remain unknown.
These are published profiled durations, not a CUDA C++ Lab benchmark or evidence for
our fusion kernel. Events, timestamps (microseconds), names and arguments are
unchanged; all other events were omitted. They cannot establish CPU/kernel
correlation without the omitted events. Do not infer end-to-end latency from this excerpt.

Copyright and BSD licence are retained in KINETO-LICENSE.txt.
