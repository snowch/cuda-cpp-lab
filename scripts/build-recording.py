# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = ["playwright==1.58.0", "numpy", "soundfile"]
# ///
# Copyright © 2026 Christopher Snow.
"""Export a prepared native 4K recap with pinned record-demo speech.
Run recording-production.py prepare/narrate/phonemes/screen first.
"""
import argparse
import json
from pathlib import Path
from recording_export import export
from recording_catalog import refresh_duration_catalog

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('chapter', nargs='?', default='reduction')
parser.add_argument('--slides-only', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
plan = json.loads((root/'test-results/record-demo-all/plan.json').read_text())
recordings = [r for r in plan['recordings'] if r['kind'] == 'deck' and r['slug'] == args.chapter]
assert len(recordings) == 1, 'Unknown recording'
export(recordings, slides_only=args.slides_only)
if not args.slides_only:
    refresh_duration_catalog()
