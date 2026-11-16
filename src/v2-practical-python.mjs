// Copyright © 2026 Christopher Snow.
export const practicalPython = {
  'verify-every-output': `import torch
a = torch.tensor([[1.0, 2.0], [3.0, 5.0]])
b = torch.tensor([[2.0, 0.0], [1.0, 4.0]])
y = a @ b
print(y)`,
  'grid-stride-loops': `import torch
x = torch.arange(70, dtype=torch.float32)
x = (x.remainder(13) - 6.0) * 0.25
y = x * 2.5
print(y)`,
  'multi-block-scan': `import torch
flags = (torch.arange(70) % 3 == 0).to(torch.int64)
offsets = torch.cumsum(flags, dim=0) - flags
print(offsets)`,
  'resource-tradeoffs': `import torch
x = torch.arange(8, dtype=torch.float32)
y = x * 2.0 + 1.0
print(y)`,
  'measure-a-kernel': `import torch
x = torch.arange(4096, dtype=torch.float32)
y = x * 2.0 + 1.0
print(y)`,
  'softmax-capstone': `import torch
logits = torch.tensor([
    [-2.0, 0.0, 1.0],
    [1000.0, 1002.0, 1003.0],
])
y = torch.softmax(logits, dim=1)
print(y)`,
};
