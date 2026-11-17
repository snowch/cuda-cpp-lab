# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = ["playwright==1.58.0", "numpy", "soundfile"]
# ///
# Copyright © 2026 Christopher Snow.
"""Export prepared V2 recaps with Common Ground's pinned record-demo narration.
Run recording-production.py prepare/narrate/phonemes/screen first.
Ordinary course builds use committed media and never synthesise speech.
"""
import json
from pathlib import Path
import sys
from recording_export import export

root = Path(__file__).resolve().parents[1]
plan = json.loads((root/'test-results/record-demo-all/plan.json').read_text())
selected = [r for r in plan['recordings'] if r['kind'] == 'v2' and (not sys.argv[1:] or r['slug'] in sys.argv[1:])]
assert not sys.argv[1:] or len(selected) == len(sys.argv[1:]), 'Unknown lesson slug'
export(selected)
