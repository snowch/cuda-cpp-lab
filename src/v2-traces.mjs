// Copyright © 2026 Christopher Snow.
import { simulateLoad } from './model.mjs';
import { scheduleWarps, branchWarp, sharedBanks } from './architecture.mjs';
import { reduceBlock, tiledMatmul, precisionMatmul, attention, inferenceBudget } from './ai-models.mjs';
import { parallelModels } from './parallel-models.mjs';
import { resultView } from './parallel-view.mjs';
import { escape, table } from './continuation-ui.mjs';

const vector = values => '[' + values.join(', ') + ']';
const float = value => Number.isInteger(value) ? value.toFixed(1) : Number(value.toPrecision(7)).toString();
const floats = values => vector(values.map(float));
const metrics = rows => table(['Quantity', 'Result'], rows, 'Run summary');
const steps = (events, heading, headers, rows) => events.map((event, index) =>
  table(headers, rows(event), typeof heading === 'string' ? heading + ' ' + (index + 1) : heading(event)));
const single = html => [html];

const traces = {
  coalescing(stride) {
    const { sectors, usefulBytes, coveredBytes } = simulateLoad({ stride });
    return {
      answer: sectors.length,
      summary: metrics([['Sectors touched', sectors.length], ['Requested bytes', usefulBytes], ['Sector coverage in bytes', coveredBytes]]),
      frames: single(table(['Sector', 'Byte range', 'Lanes'], sectors.map(sector =>
        [sector.id, sector.startAddress + '–' + (sector.startAddress + 31), sector.laneIds.join(', ')]), 'One global input load')),
    };
  },
  scheduling(warps) {
    const model = scheduleWarps({ warps });
    return {
      answer: model.trace.findIndex(event => event.instruction === 'idle'),
      summary: metrics([['Instructions issued', model.issued], ['Idle slots', model.idle], ['Total issue slots', model.cycles]]),
      frames: steps(model.trace, event => 'Issue slot ' + event.cycle, ['Warp', 'Before issue', 'Instruction issued'],
        event => event.before.map((warp, id) => [id, warp.status, event.selected === id ? event.instruction : '—'])),
    };
  },
  divergence(pattern) {
    const { lanes, trace, paths, utilisation } = branchWarp({ pattern, negativeOps: 1 });
    return {
      answer: paths,
      summary: metrics([['Paths taken', paths], ['Active lane slots', (utilisation * 100).toFixed(1) + '%']]),
      frames: steps(trace, event => event.label, ['Lane', 'Input', 'Participation', 'Output from this path'],
        event => lanes.map(lane => [lane.id, float(lane.input), event.mask.includes(lane.id) ? 'Active' : 'Other path',
          event.mask.includes(lane.id) ? float(lane.output) : '—'])),
    };
  },
  reduction(size) {
    const { inputs, trace, result, levels } = reduceBlock({ size });
    return {
      answer: levels[1].length,
      summary: metrics([['Inputs', floats(inputs)], ['Final sum', float(result)]]),
      frames: steps(trace, event => event.label, ['Shared word', 'Value after this step', 'Inputs in current partial'],
        event => event.shared.map((value, index) => {
          const partial = levels.slice(0, event.level + 1).reverse().find(level => level[index])?.[index];
          return [index, value === null ? 'Unwritten' : float(value), value === null ? '—' : partial.threads.join(', ')];
        })),
    };
  },
  'shared-memory-banks'(stride) {
    const { rounds, banksUsed, distinctWords, trace } = sharedBanks({ stride: stride || 1, broadcast: stride === 0 });
    return {
      answer: rounds,
      summary: metrics([['Banks used', banksUsed], ['Distinct words', distinctWords], ['Service rounds', rounds]]),
      frames: steps(trace, 'Service round', ['Bank', 'Shared word', 'Lanes served'],
        event => event.served.map(request => [request.bank, request.word, request.laneIds.join(', ')])),
    };
  },
  matmul(tile) {
    const { a, b, inputLoads, output, trace } = tiledMatmul({ n: 4, tile });
    return {
      answer: inputLoads,
      summary: metrics([['Global input element loads', inputLoads], ['C row 0', floats(output[0])]]),
      frames: trace.filter(step => step.row === 0 && step.col === 0).map(step =>
        table(['Operand', 'Coordinates', 'Values'], [
          ['A', step.aCells.map(vector).join(' '), floats(step.aCells.map(([i, j]) => a[i][j]))],
          ['B', step.bCells.map(vector).join(' '), floats(step.bCells.map(([i, j]) => b[i][j]))],
          ['Partial C', step.cCells.map(([i, j]) => vector([i, j])).join(' '), floats(step.cCells.map(cell => cell[2]))],
        ], step.label)),
    };
  },
  precision(format) {
    const { changed, result, reference, trace } = precisionMatmul({ format });
    return {
      answer: changed,
      summary: metrics([['Changed inputs', changed], ['Final FP32 sum', float(result)], ['Sum with FP32 inputs', float(reference)]]),
      frames: single(table(['Index', 'Input', 'Stored', 'Running FP32 sum'],
        trace.map(step => [step.k, float(step.input), float(step.converted), float(step.partial)]), 'First-operand rounding')),
    };
  },
  'tensor-cores'(start) {
    const dot = Array.from({ length: 16 }, () => 1 * 1).reduce((a, b) => a + b, 0);
    const output = start + dot;
    return {
      answer: output,
      summary: metrics([['Dot product', float(dot)], ['C[0,0]', float(output)]]),
      frames: single(table(['Collective call', 'Data used by the warp'], [
        ['fill_fragment', 'Set the accumulator to ' + float(start)],
        ['load_matrix_sync', 'Load the A and B operand fragments'],
        ['mma_sync', float(dot) + ' + ' + float(start) + ' at coordinate [0, 0]'],
        ['store_matrix_sync', 'Write the 16 × 16 result tile'],
      ], 'One warp with 32 participating threads')),
    };
  },
  attention(choice) {
    const materialised = choice === 'materialised';
    const { intermediateWrites, maxError, trace, output } = attention({
      mode: materialised ? 'materialised' : 'online', tile: materialised ? 2 : choice,
    });
    return {
      answer: intermediateWrites,
      summary: metrics([['Intermediate elements written', intermediateWrites], ['Query 0 output', floats(output[0])],
        ['Largest absolute difference between algorithms', maxError.toExponential(2)]]),
      frames: steps(trace, event => event.label, ['Quantity', 'Value'], event => materialised ?
        [['Query 0 values', floats(event.values)], ['Operation', event.description]] :
        [['Scores', floats(event.block)], ['Previous maximum', float(event.previous.m)], ['Updated maximum', float(event.m)],
          ['Earlier terms multiplied by', float(event.rescale)], ['Denominator', float(event.l)], ['Weighted sum', floats(event.acc)]]),
    };
  },
  inference(sequence) {
    const model = inferenceBudget({ sequence });
    return {
      answer: model.kvReadBytes / (2 ** 20),
      summary: metrics([['Cache bytes read per decode step', model.kvReadBytes], ['Existing data read in MiB', model.kvReadBytes / (2 ** 20)], ['Cache bytes appended', model.kvWriteBytes]]),
      frames: single(table(['Phase', 'Occupied tokens', 'Occupied cache bytes'], [
        ['Before decode', sequence, model.kvCacheBytes], ['After append', model.cacheTokensAfter, model.kvCacheBytes + model.kvWriteBytes],
      ], 'One sequence across 32 layers')),
    };
  },
  'matmul-investigation'(tile) {
    const model = tiledMatmul({ n: 8, tile, sharedBudget: 128 });
    return {
      answer: model.residentBlocks,
      summary: metrics([['Blocks per teaching SM', model.residentBlocks], ['Global input loads', model.inputLoads]]),
      frames: single(table(['Resource', 'Capacity per SM', 'Used per block'], [
        ['Shared memory (bytes)', model.resourceCapacity.shared, model.sharedBytes],
        ['Registers', model.resourceCapacity.registers, model.registersPerBlock],
        ['Warp slots', model.resourceCapacity.warps, 1],
      ], 'Teaching resource budgets')),
    };
  },
};

const parallelTrace = (model, settings, getAnswer) => value => {
  const result = parallelModels[model](settings(value));
  return { answer: getAnswer(result), summary: '', frames: result.steps.map((_, index) => resultView(result, index)) };
};

Object.assign(traces, {
  histograms: parallelTrace('histograms', strategy => ({ strategy }), r => r.globalUpdates),
  scan: parallelTrace('scan', kind => ({ kind }), r => r.values[5]),
  compaction: parallelTrace('compaction', predicate => ({ predicate, order: 'reverse' }), r => r.count - 1),
  progress: parallelTrace('barrier', participation => ({ participation }), r => r.valid ? 4 : 2),
  pipelines: parallelTrace('pipeline', mode => ({ mode }), r => r.events[2].copyStart),
  'token-routing': parallelTrace('routing', distribution => ({ distribution, goal: 'group' }), r => r.destinations[4]),
});

export function runTrace(slug, value) {
  return traces[slug](value);
}

export { escape };
