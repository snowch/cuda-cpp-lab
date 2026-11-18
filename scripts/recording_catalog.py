# Copyright © 2026 Christopher Snow.
"""Keep the compact learner-facing duration catalogue aligned with measured media."""
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]


def refresh_duration_catalog():
    path=ROOT/'src/recording-durations.mjs'
    source=path.read_text()
    match=re.search(r'recordingDurations\s*=\s*({.*?})\s*;',source,re.S)
    assert match,'Missing duration catalogue'
    existing=json.loads(match[1])
    durations={slug:json.loads((ROOT/f'content/{slug}-media.json').read_text())['durationSeconds'] for slug in existing}
    pending=path.with_name('.'+path.name+'.pending')
    pending.write_text(source[:match.start(1)]+json.dumps(durations,indent=2)+source[match.end(1):])
    pending.replace(path)
