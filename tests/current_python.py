# Copyright © 2026 Christopher Snow.
"""Check the six current PyTorch reference calculations on the CPU."""
import contextlib
import io
import json
import math
from pathlib import Path
import subprocess
import torch

root=Path(__file__).resolve().parents[1]
sources=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {practicalPython} from './src/v2-practical-python.mjs';console.log(JSON.stringify(practicalPython))"],cwd=root,text=True))
weights=[math.exp(x-1) for x in [-2,0,1]]
expected={
 'verify-every-output':('y',[[4,8],[11,20]]),
 'grid-stride-loops':('y',[((i%13)-6)*.25*2.5 for i in range(70)]),
 'multi-block-scan':('offsets',[sum(j%3==0 for j in range(i)) for i in range(70)]),
 'resource-tradeoffs':('y',[i*2+1 for i in range(8)]),
 'measure-a-kernel':('y',[i*2+1 for i in range(4096)]),
 'softmax-capstone':('y',[[w/sum(weights) for w in weights]]*2),
}
assert sources.keys()==expected.keys()
for slug,source in sources.items():
 namespace={}
 with contextlib.redirect_stdout(io.StringIO()):exec(compile(source,slug+'.py','exec'),namespace)
 name,values=expected[slug];actual=namespace[name]
 assert actual.device.type=='cpu',slug
 torch.testing.assert_close(actual,torch.tensor(values,dtype=actual.dtype),rtol=1e-5,atol=1e-6)
 print('PASS CPU reference:',slug)
print('CPU value checks do not validate CUDA execution or GPU performance.')
