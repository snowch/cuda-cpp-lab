// Copyright © 2026 Christopher Snow.
// Authored learning sequences. A diagram adds an ownership/dependency relation
// to the parent lesson; the pause asks about a new case before its answer.
import {examples as e,fp} from './architecture-recording-models.mjs';
import {svg,text,rect,arrow,values,array,compare,flow,captionCode,statement,blockWarps,smState,sectors,masks,bankView,gate,tileView,cacheView,routingView} from './architecture-recording-design.mjs';
const S=(title,captions,visual,extra={})=>({title,captions,visual,captionMaxChars:48,captionSettings:'position:50% size:92% align:center',...extra});
const predict=(title,captions,visual)=>S(title,captions,visual,{hold:5,prediction:true});
const pairRows=(a,av,b,bv,integer=false)=>svg(values(a,av,{y:48,integer})+values(b,bv,{y:198,integer}));
const counts=(a,n,b,m,detail='')=>compare([a,n,detail],[b,m,'']);
const words=a=>a.join(', ');
const plans=[];
function P(slug,lesson,title,outcome,scope,scenes){
 plans.push({slug,lesson,title,outcome,scope,scenes:scenes.map((s,i)=>({...s,id:'s'+String(i+1).padStart(2,'0')}))});
}

P('more-threads-than-elements',3,'Why eight threads can form two warps',
 'Distinguish launched threads, valid array participants and block-local warp membership.',
 '32-thread NVIDIA warps · illustrative SM placement · no execution timing',[
 S('Eight threads, five elements',[
  'Five inputs need five array updates. The supplied launch creates two blocks of four threads, so eight threads start.',
  'Follow where those threads fit in the GPU, including the three that have no input element.'],
  ()=>compare(['Launched threads',e.bounds.threads.length,'Two blocks of four'],['Input elements',e.bounds.input.length,'Five valid array positions'])),
 S('A block uses shared SM hardware',[
  'An SM is a streaming multiprocessor: hardware that executes the threads of assigned blocks.',
  'Both blocks are drawn on one SM here as a possible placement. The launch does not assign each thread its own physical processor.'],
  ()=>flow([{title:'GPU launch',value:'2 blocks'},{title:'One SM',value:'Shared units',kind:'chip'},{title:'GPU memory',value:'5 inputs'}],{active:1})),
 S('Each block forms its own warp',[
  'A warp is a group of up to thirty-two threads from one block whose instructions are issued together.',
  'A four-thread block occupies a partially filled warp. Threads from the second block cannot fill the first block’s unused positions.'],
  ()=>blockWarps(e.bounds,{guard:false})),
 S('The guard changes participation',[
  'All eight launched threads calculate their indices. Only indices below five execute the guarded array reads and writes.',
  'Threads five, six and seven skip those operations. They are different from warp positions that were never launched.'],
  ()=>blockWarps(e.bounds)),
 predict('Regroup the same eight threads',[
  'Consider changing threadsPerBlock from four to eight. There are still five inputs.',
  'Pause and predict the number of blocks and partially filled warps. Should the five output values change?'],
  ()=>captionCode('const int threadsPerBlock = 8;','Prediction · regroup the launch')),
 S('One block, one partially filled warp',[
  'The launch now needs one block of eight threads, so it uses one partially filled warp.',
  'Five threads still perform the array operations and three skip them. The grouping changed, not the requested calculation.'],
  ()=>blockWarps(e.boundsOther)),
 S('Check grouping separately from values',[
  'In the CUDA source editor, set threadsPerBlock to eight and click Compile and run.',
  'Trace CUDA calls shows one block of eight threads. Console’s five outputs stay the same; the warp diagram explains grouping, not measured execution time.'],
  ()=>array('Output · the same five values',e.boundsOther.output)),
]);

P('from-cpu-array-to-gpu-result',4,'Follow values across two memory domains',
 'Explain allocation, host/device copies and SM execution as separate operations.',
 'Simplified discrete GPU · logical transfers and source ordering',[
 S('The CPU and GPU arrays are separate',[
  'The five starting values live in a CPU array in system RAM. GPU execution needs a device input array and a device output array.',
  'Follow one value across these separate memory domains.'],
  ()=>flow([{title:['CPU side','System RAM'],value:'x[0] = 1.0'},{title:'GPU memory',value:'d_x / d_y'},{title:'GPU chip',value:'SM',kind:'chip'}])),
 S('Allocation reserves storage',[
  'cudaMalloc reserves device storage. Reserving an address does not copy the CPU input into it.',
  'Five FP32 values need twenty bytes in each device array. FP32 means a four-byte floating-point value here.'],
  ()=>compare(['GPU input allocation',e.copies.bytes+' B','Reserved storage'],['GPU output allocation',e.copies.bytes+' B','Separate reserved storage'])),
 S('The input copy supplies the values',[
  'The host-to-device copy fills the GPU input array from the CPU array. The original CPU array remains a separate object.',
  'The kernel receives the address of the device array, not the CPU array.'],
  ()=>flow([{title:['System RAM','x[0]'],value:fp(e.copies.input[0])},{title:'Input copy',value:'CPU → GPU'},{title:['GPU memory','d_x[0]'],value:fp(e.copies.input[0])}],{active:1})),
 S('The SM performs the calculation',[
  'An SM executes the thread instructions. The thread reads its device input, multiplies the value and writes the device output.',
  'A CPU output variable has not received that result merely because the GPU wrote its own array.'],
  ()=>flow([{title:'GPU input',value:fp(e.copies.input[0])},{title:'SM arithmetic',value:'× 2.0',kind:'chip'},{title:'GPU output',value:fp(e.copies.output[0])}],{active:1})),
 S('Copy back before the CPU prints',[
  'The supplied device-to-host copy fills the CPU output array before main prints it.',
  'This copy connects GPU-produced values to CPU observation. It is a separate data movement from the kernel’s arithmetic.'],
  ()=>flow([{title:'GPU output',value:fp(e.copies.output[0])},{title:'Result copy',value:'GPU → CPU'},{title:['System RAM','y[0]'],value:fp(e.copies.output[0])}],{active:1})),
 predict('Now prepare nine inputs',[
  'Consider an input array containing nine FP32 values. Pause and predict the size of each device array and the size of each complete array copy.',
  'Does doubling the values require doubling that byte count again?'],
  ()=>compare(['Elements',e.copiesOther.input.length,'FP32 · 4 bytes each'],['Bytes per array','?','Same element count after multiplying'])),
 S('Count elements and bytes separately',[
  'Each nine-value array needs thirty-six bytes. The input copy and the result copy each move thirty-six payload bytes.',
  'Multiplying by two changes the values, not how many FP32 elements the arrays hold. Allocation, copying and computation solve different jobs.'],
  ()=>compare(['Input copy',e.copiesOther.bytes+' B','Nine FP32 inputs'],['Result copy',e.copiesOther.bytes+' B','Nine FP32 results'])),
]);

P('coalescing',5,'Follow a warp’s addresses into memory requests',
 'Distinguish useful values, addressed sectors and physical device-memory traffic.',
 '32 active lanes · FP32 · aligned 32-byte sectors · no cache-miss or timing model',[
 S('Same values, different address grouping',[
  'One warp requests thirty-two FP32 values. That is one hundred and twenty-eight useful bytes.',
  'Changing the input stride can change the number of addressed sectors even when every lane still reads one value.'],
  ()=>compare(['Active lanes',32,'One value per lane'],['Useful data',e.adjacent.usefulBytes+' B','Same in both cases'])),
 S('Addresses begin at the SM',[
  'The warp’s threads supply addresses to the SM’s load and store hardware.',
  'The memory path groups these addresses. Caches can satisfy requests before a miss reaches device memory.'],
  ()=>flow([{title:['SM','Lane addresses'],value:'One warp',kind:'chip'},{title:['L1 / L2','Caches'],value:'May supply data'},{title:'GPU memory',value:'On a miss'}],{active:0})),
 S('Adjacent words share sectors',[
  'With stride one, lanes zero, one and two read byte addresses zero, four and eight. Those words share the first aligned sector.',
  'Across the whole warp, the thirty-two addresses occupy four sectors.'],
  ()=>sectors(e.adjacent)),
 predict('Move each lane eight words apart',[
  'Now use stride eight. Each input word is four bytes, so neighbouring lanes are thirty-two bytes apart.',
  'Pause and predict whether the warp still addresses four sectors. The useful value count has not changed.'],
  ()=>captionCode('input[lane * 8]','Prediction · one FP32 load per lane')),
 S('Each lane now reaches another sector',[
  'Stride eight places each lane’s word in a different sector. The warp addresses thirty-two sectors for the same thirty-two values.',
  'That covers one thousand and twenty-four sector bytes while only one hundred and twenty-eight bytes contain the requested words.'],
  ()=>sectors(e.strided)),
 S('A sector count is not a DRAM read count',[
  'These counts describe the addresses touched by one load instruction. They do not tell us how many requests miss the caches or how long the GPU takes.',
  'To explain the count, follow lane addresses into aligned sectors. To explain real memory traffic, additional cache and hardware evidence is needed.'],
  ()=>statement('Address grouping ≠ measured memory traffic','Same useful values · different sector coverage')),
]);

P('scheduling',6,'Watch ready warps share one SM',
 'Explain how another ready warp can use shared arithmetic hardware while a load is pending.',
 'One chosen functional sequence · first element per thread · no cycle or throughput claim',[
 S('A pending load creates a dependency',[
  'Each thread in this starter doubles two inputs. Follow just the first load, multiply and store sequence.',
  'A multiply cannot use its input before that input arrives. What can the SM do during that wait?'],
  ()=>flow([{title:'Load input',value:'Requested'},{title:'Multiply',value:'Needs data'},{title:'Store output',value:'Needs result'}],{active:0})),
 S('Warps keep separate working values',[
  'The SM holds state for multiple resident warps. Registers hold values belonging to their threads.',
  'Resident means the warp’s state and required resources are present on this SM; it does not mean every instruction is ready.'],
  ()=>smState(e.sm[0])),
 S('Warp A’s operands become ready',[
  'In this chosen sequence, warp A requests its data and then receives it. Its first thread can now multiply one point zero.',
  'The scheduler selects ready instructions; the picture is not a measured schedule or a fixed GPU latency.'],
  ()=>smState(e.sm[2])),
 S('Warp B waits while A stays ready',[
  'Warp B now has an outstanding load. Warp A still has usable operands in its own registers.',
  'The two warps do not need separate arithmetic units to make progress.'],
  ()=>smState(e.sm[3])),
 predict('Must the whole SM wait for B?',[
  'Pause here. Warp B’s load is pending, but warp A’s multiply has its operands.',
  'Can the scheduler choose A’s ready multiply without discarding B’s state?'],
  ()=>smState(e.sm[3])),
 S('Shared arithmetic runs a ready instruction',[
  'Yes. The arithmetic hardware uses A’s ready operands and produces two point zero for the selected thread.',
  'B’s state remains resident while its load is pending. This is hardware sharing between warps, not one processor reserved for every thread.'],
  ()=>smState(e.sm[4])),
 S('The same hardware can later run B',[
  'When B’s values arrive, the same arithmetic hardware can use them. Its selected input of thirty-three point zero becomes sixty-six point zero.',
  'More resident warps can supply ready instructions, but dependencies and resource limits still matter. This sequence does not predict a speed-up.'],
  ()=>smState(e.sm[7])),
]);

P('divergence',7,'Follow participating lanes through two paths',
 'Distinguish a warp’s threads from the lane set participating in a particular instruction.',
 '32-thread warp · illustrative active masks · compiler lowering and timing may differ',[
 S('One warp contains both kinds of input',[
  'The starter alternates positive two point zero and negative two point zero across one warp.',
  'The positive path doubles its value. The negative path negates it. The question is which lanes participate in each operation.'],
  ()=>array('First eight inputs of the 32-thread warp',e.mixed.lanes.slice(0,8).map(l=>l.input))),
 S('A lane is a position within the warp',[
  'A lane identifies a thread’s position in its warp. These positions do not represent separate physical processors owned by those threads.',
  'A warp instruction can have only a subset of its lanes participating.'],
  ()=>statement('One warp · 32 logical lane positions','Instruction participation can change without creating new threads.')),
 S('Positive lanes take the multiply',[
  'Sixteen lanes have positive inputs. Those lanes participate in the doubling operation; the negative lanes do not update their results through this path.',
  'The diagram shows participation, not a claim that the compiler must emit this exact branch order.'],
  ()=>masks(e.mixed,'positive')),
 S('Negative lanes take the negation',[
  'The other sixteen lanes participate in negation. Their negative two point zero becomes positive two point zero.',
  'The same warp still contains all thirty-two threads. A lane inactive for one operation has not disappeared.'],
  ()=>masks(e.mixed,'negative')),
 S('The threads retain distinct results',[
  'After the paths, lane zero has four point zero and lane one has two point zero. Each thread writes its own output position.',
  'Both lane sets belong to the original warp.'],
  ()=>masks(e.mixed)),
 predict('Make all inputs positive',[
  'Now consider thirty-two positive inputs. Pause and predict which lane set needs the negative-path operation.',
  'Does changing the signs change the warp’s size?'],
  ()=>array('A new all-positive input case · first eight values',e.positive.lanes.slice(0,8).map(l=>l.input))),
 S('The unused path has no participating lanes',[
  'No lane needs negation in that case. All thirty-two can participate in doubling, and the warp is still thirty-two threads wide.',
  'Input patterns change instruction participation. They do not tell us an exact runtime without compiler and device evidence.'],
  ()=>masks(e.positive,'positive')),
]);

P('reduction',8,'Connect shared writes to safe partner reads',
 'Explain the block-scoped memory and collective barrier contract throughout a reduction.',
 'One block of eight threads · shared-memory dependencies · no scheduling or timing trace',[
 S('Eight values must become one sum',[
  'The block begins with values one through eight. The required total is thirty-six point zero.',
  'The important GPU question is how one thread can safely use values produced by other threads.'],
  ()=>array('Block inputs',e.reduction.inputs)),
 S('The block owns a shared workspace',[
  'Each thread writes its input into shared memory on the SM. This workspace belongs to this block.',
  'A thread’s own working value and the block’s shared array have different ownership.'],
  ()=>flow([{title:'GPU inputs',value:'8 values'},{title:['SM','Block workspace'],value:'Shared array',kind:'chip'},{title:'Thread 0',value:'Final sum'}],{active:1})),
 S('Complete writes before partner reads',[
  'All eight block threads reach the initial block barrier. A following partner read can then use the completed shared writes.',
  'The barrier does not synchronise an unrelated block on this or another SM.'],
  ()=>gate({arrivals:e.reduction.size,readers:4})),
 S('Only part of the block adds at a stage',[
  'At partner distance four, threads zero through three add the upper four values into the lower four positions.',
  'The next stage must use these completed partial sums, so every block thread reaches the following barrier.'],
  ()=>array('After the first partner-add stage',e.reduction.levels[1].map(x=>x.value))),
 S('The reduction narrows to one addition',[
  'The next partner stage leaves two partial sums: sixteen point zero and twenty point zero.',
  'Thread zero adds them to form thirty-six point zero. Fewer adding threads does not change the block’s matching barrier participants.'],
  ()=>array('Two partial sums before the last addition',e.reduction.levels[2].map(x=>x.value))),
 predict('One adds; how many arrive?',[
  'Only thread zero performs the final addition. None of the eight threads has exited the kernel.',
  'Pause and predict how many threads must reach the matching block barrier. Can the other seven simply skip it?'],
  ()=>compare(['Final adding threads',1,'One result'],['Required barrier arrivals','?','The same block still exists'])),
 S('All eight still participate',[
  'All eight must reach the matching barrier. The arithmetic condition selects who adds; it does not remove the other threads from the collective.',
  'The safe sequence is shared writes, a block barrier, then dependent reads. That relationship remains true as the reduction narrows.'],
  ()=>gate({arrivals:e.reduction.size,readers:1})),
]);

P('shared-memory-banks',9,'Follow shared-memory addresses to their banks',
 'Explain distinct-word conflicts separately from same-word broadcast.',
 '32 banks · four-byte words · one warp read · model rounds, not GPU clock cycles',[
 S('Shared memory is banked storage',[
  'On this teaching model, the SM’s shared memory has thirty-two banks, and successive four-byte words select successive banks.',
  'For a word index, taking the remainder after division by thirty-two identifies its bank.'],
  ()=>captionCode('bank = wordIndex % 32;','Address mapping · four-byte words')),
 S('Different words can select one bank',[
  'With stride thirty-two, lane zero requests word zero, lane one word thirty-two, and lane two word sixty-four.',
  'Those are different addresses, but each maps to bank zero.'],
  ()=>bankView(e.banks)),
 S('One bank has distinct words to serve',[
  'Across the warp, bank zero receives thirty-two distinct-word requests. The model needs thirty-two service rounds.',
  'Shared memory is on the SM, but being local does not make every address pattern equally serviceable.'],
  ()=>compare(['Banks used',e.banks.banksUsed,'Thirty-two distinct words'],['Model rounds',e.banks.rounds,'One distinct word per bank per round'])),
 S('Changing the address pattern spreads banks',[
  'Stride thirty-three changes the bank remainder for successive lanes. This warp’s words now use all thirty-two banks.',
  'The model can serve the distinct requests in one round.'],
  ()=>bankView(e.spread)),
 predict('All lanes request the same word',[
  'Consider a third case: every lane requests word zero. They all select bank zero again.',
  'Pause and predict whether that necessarily means thirty-two distinct-word service rounds.'],
  ()=>statement('32 readers · one shared word','The address is identical, not just the bank number.')),
 S('A same-word read can broadcast',[
  'There is only one distinct word to supply, so the model broadcasts it to the readers in one round.',
  'Count distinct words within each bank. The starter’s reported service rounds are address-model results, not measured GPU time.'],
  ()=>bankView(e.broadcast)),
]);

P('matmul',10,'See which values a shared tile reuses',
 'Distinguish per-block input reuse from private output accumulation and cross-block sharing.',
 '4 × 4 starter matrices · 2 × 2 tiles · illustrated ownership, not a chip floor plan',[
 S('One output needs a row and a column',[
  'For output C at row zero and column zero, a thread combines row zero of A with column zero of B.',
  'Neighbouring outputs reuse parts of those inputs. The recording follows where that reuse happens on an SM.'],
  ()=>pairRows('A row 0',e.matrix.a[0],'B column 0',e.matrix.b.map(r=>r[0]))),
 S('A block loads two shared input tiles',[
  'Four threads form a two-by-two output block. They cooperatively load a two-by-two tile from each input into their block’s shared memory.',
  'The first block barrier completes those shared writes before the tile is consumed.'],
  ()=>tileView(e.matrix,0)),
 S('Shared inputs feed private working sums',[
  'Threads computing the same output row can reuse an A value. Threads computing the same output column can reuse a B value.',
  'Each thread keeps its own partial output sum. Sharing the inputs does not merge the output accumulators.'],
  ()=>tileView(e.matrix,0)),
 S('Finish using a tile before replacing it',[
  'The second block barrier protects the tile from being overwritten while another thread still uses it.',
  'The block loads the next K positions and continues its private sums. The shown C at row zero, column zero finishes at three point zero.'],
  ()=>tileView(e.matrix,1)),
 predict('Can another block use this shared tile?',[
  'Suppose two blocks are resident on the same SM. Pause and predict whether the second block’s shared array is the same workspace as the first block’s.',
  'Does sharing an SM make block-scoped arrays shared between blocks?'],
  ()=>flow([{title:['Block A','Shared tiles'],value:'A workspace',kind:'chip'},{title:'Same SM',value:'Shared hardware'},{title:['Block B','Shared tiles'],value:'B workspace',kind:'chip'}],{directions:[false,false]})),
 S('Shared-memory ownership stays per block',[
  'Each block has its own shared workspace, even when both use the same SM. One block cannot use the other block’s shared array as its tile.',
  'Reuse in this kernel comes from cooperating threads within a block, while each thread retains a private output sum.'],
  ()=>compare(['Shared input storage',e.matrix.sharedBytes+' B','Per block, not per SM program'],['Output ownership','Private','One partial sum per output thread'])),
]);

P('precision',11,'Separate stored precision from arithmetic state',
 'Explain where rounding occurs and why FP32 accumulation cannot restore lost input information.',
 '16 FP32 stored inputs · FP16 round-trip conversion · FP32 accumulation',[
 S('Where does information disappear?',[
  'The starter stores sixteen FP32 inputs: eight copies of one point zero zero zero three, then eight copies of negative one.',
  'Its question is what happens when each loaded value is rounded through FP16 before an FP32 accumulation.'],
  ()=>compare(['First eight values',fp(e.precision.row[0]),'Stored as FP32'],['Last eight values',fp(e.precision.row[8]),'Stored as FP32'])),
 S('The arrays still occupy FP32 storage',[
  'The device input allocation still uses four bytes per element. The conversion happens after loading a value into the thread’s working state.',
  'This particular kernel changes the value representation during computation; it does not change the input array’s allocated type.'],
  ()=>flow([{title:'GPU memory',value:'FP32 array'},{title:['SM','Convert value'],value:'FP16 → FP32',kind:'chip'},{title:'Working sum',value:'FP32'}],{active:1})),
 S('A narrow format has fewer representable values',[
  'Rounding sends one point zero zero zero three to exactly one point zero in this FP16 case.',
  'Negative one is exactly representable and stays unchanged. Conversion back to FP32 cannot recover the discarded difference.'],
  ()=>compare(['Loaded value',fp(e.precision.row[0]),'FP32'],['After round trip',fp(e.precision.converted[0]),'The lost difference is gone'])),
 S('Wider accumulation keeps the rounded operands',[
  'The rounded positive and negative contributions cancel to zero. Keeping FP32 operands gives a small positive reference result.',
  'An FP32 accumulator limits further accumulation rounding, but it cannot repair information removed before the addition.'],
  ()=>compare(['Rounded operands',fp(e.precision.result),'FP32 accumulation'],['FP32 operands',e.precision.reference.toFixed(7),'Same accumulation order'])),
 predict('Must every FP16 conversion lose information?',[
  'Consider a new row alternating one point zero and negative zero point five. Both values are exactly representable in FP16.',
  'Pause and predict whether the round trip must change the operands or the final sum.'],
  ()=>array('A different, exactly representable input case',e.exact.row.slice(0,4))),
 S('Representability decides this case',[
  'No input value changes in that case, and the illustrated sum remains four point zero.',
  'Reason separately about stored types, operand conversion and accumulation. A smaller format does not by itself establish an accuracy loss or a speed-up.'],
  ()=>compare(['Changed operands',e.exact.changed,'Of sixteen values'],['Accumulated result',fp(e.exact.result),'The reference agrees'])),
]);

P('tensor-cores',12,'Follow a warp-level matrix operation through an SM',
 'Explain collective participation, distributed fragments and the accumulator’s role.',
 '16 × 16 × 16 WMMA example · opaque fragment layout · not a hardware instruction count',[
 S('A matrix tile is a collective operation',[
  'The starter’s two sixteen-by-sixteen input matrices contain ones. One warp cooperates on the matrix operation.',
  'Follow the data through that cooperation instead of assigning an output element to a particular lane.'],
  ()=>compare(['Cooperating threads',e.tensor.warp,'One warp'],['Output matrix entries',e.tensor.entries,'Sixteen by sixteen'])),
 S('Fragments are distributed working state',[
  'A fragment is the matrix API’s container for part of the collective operation’s working state.',
  'The fragment layout across lanes is implementation-dependent. The diagram therefore groups fragments by role, not by an invented lane-to-element mapping.'],
  ()=>flow([{title:['GPU memory','Input matrices'],value:'FP16'},{title:['Warp','Input fragments'],value:'Distributed',kind:'chip'},{title:['Warp','Accumulator'],value:'FP32'}],{active:1})),
 S('The SM supplies matrix arithmetic hardware',[
  'The warp-level matrix call uses the SM’s matrix execution capability with the input fragments and accumulator.',
  'It is a collective call. The API operation is not a promise about one particular machine instruction or a fixed execution duration.'],
  ()=>flow([{title:'Input fragments',value:'A and B'},{title:['SM','Matrix hardware'],value:'A × B + C',kind:'chip'},{title:'Accumulator',value:'Updated'}],{active:1})),
 S('The initial accumulator contributes to the result',[
  'For C at row zero and column zero, sixteen products of one contribute sixteen point zero. The initial accumulator is zero.',
  'The final store writes the collective result back to GPU memory.'],
  ()=>compare(['Initial accumulator',fp(e.tensor.start),'FP32'],['C at row 0, column 0',fp(e.tensor.result),'Sixteen products added'])),
 predict('Start the accumulator at five',[
  'Now consider startingValue equal to five point zero, with the same input matrices and warp.',
  'Pause and predict C at row zero, column zero. Does changing that starting value require a different set of cooperating threads?'],
  ()=>captionCode('constexpr float startingValue = 5.0f;','Prediction · initial accumulator')),
 S('The same warp adds into a different starting value',[
  'The selected output becomes twenty-one point zero: five plus the sixteen products. The same warp still participates collectively.',
  'Fragments supply operands and working state; the SM supplies shared matrix hardware; GPU memory receives the stored result.'],
  ()=>compare(['Cooperating threads',e.tensorOther.warp,'Still one warp'],['Selected output',fp(e.tensorOther.result),'Starting value plus products'])),
]);

const attentionState=state=>flow([
 {title:'Maximum',value:fp(state.maximum)},
 {title:'Weight sum',value:state.denominator.toFixed(3)},
 {title:'Weighted value',value:state.weighted.toFixed(3)},
],{active:1});
P('attention',13,'See what attention keeps between input tiles',
 'Explain how retained running state replaces materialised score and weight arrays in the scalar starter.',
 'One scalar query · eight keys/values · displayed state rounded · no GPU timing claim',[
 S('The inputs stay in GPU memory',[
  'This teaching kernel follows one scalar query over eight keys and eight values. The keys and values are input arrays in GPU memory.',
  'The question is which intermediate values the thread must keep while it visits those arrays.'],
  ()=>pairRows('Keys',e.attention.keys.slice(0,4),'Values at the same first four positions',e.attention.values.slice(0,4))),
 S('A tile feeds the thread’s working state',[
  'With two keys per tile, the thread visits four tiles. It updates a running maximum, a sum of weights and a weighted sum of values.',
  'These are per-thread working values during SM execution, not full arrays of scores stored between separate kernels.'],
  ()=>flow([{title:['GPU memory','Keys and values'],value:'8 of each'},{title:['SM','Current tile'],value:'2 keys',kind:'chip'},{title:'Running state',value:'Retained'}],{active:1})),
 S('Rescale before combining the next tile',[
  'When a later tile increases the maximum, the old sums are rescaled to that new maximum before new contributions are added.',
  'The first tile’s working state is shown here. The state survives so that earlier keys still contribute.'],
  ()=>attentionState(e.attention.trace[0])),
 S('The final division uses the retained state',[
  `After all eight keys, the weighted sum divided by the weight sum gives about ${e.attention.result.toFixed(3)}.`,
  'This scalar starter demonstrates the dependency and retained state; it is not a full high-performance attention implementation.'],
  ()=>attentionState(e.attention.trace.at(-1))),
 predict('Use four keys in each tile',[
  'Now consider four keys per tile, with the same query, keys and values. Pause and predict the tile count.',
  'Should visiting fewer tiles change which eight keys contribute to the result?'],
  ()=>compare(['Keys in each tile',e.attentionOther.tile,'Same eight total keys'],['Number of tiles','?','Same weighted calculation'])),
 S('Tile grouping changes; the required result does not',[
  'There are now two tiles. The same eight keys and values still contribute, and the illustrated result agrees.',
  'The memory benefit comes from retaining a small running state instead of materialising intermediate arrays. Tile count alone does not measure runtime.'],
  ()=>compare(['Visited tiles',e.attentionOther.trace.length,'Four keys per tile'],['Weighted result',e.attentionOther.result.toFixed(3),'Same calculation'])),
]);

P('inference',14,'Locate the key-value cache in device memory',
 'Separate logical cache history, allocated capacity, read payload and append payload.',
 'One layer · four FP32 values per key/value · requested payload, not physical memory traffic',[
 S('This cache is an application data structure',[
  'The key-value cache stores earlier tokens’ keys and values in device memory. It is not the GPU’s L1 or L2 hardware cache.',
  'The starter has room for seventeen token slots, with four FP32 values per key and four per value.'],
  ()=>cacheView(e.cache)),
 S('Allocated capacity and used history differ',[
  'Four token slots are logically part of the old history. Reserving seventeen slots does not mean all seventeen belong to that history.',
  'The kernel’s four threads each inspect one component across the four old tokens.'],
  ()=>compare(['Reserved slots',e.cache.capacity,'Device allocation'],['Old history slots',e.cache.cached,'Used by this decoding step'])),
 S('The SM consumes old cache values',[
  'A key and value together contain eight FP32 components per token, or thirty-two payload bytes.',
  'Four old tokens therefore supply one hundred and twenty-eight requested payload bytes to this step. Hardware caches may affect the physical traffic.'],
  ()=>flow([{title:['GPU memory','Old KV history'],value:e.cache.readBytes+' B'},{title:['SM','Read old values'],value:'4 threads',kind:'chip'},{title:'Working sum',value:fp(e.cache.laneSum)}],{active:1})),
 S('Append one token at the next position',[
  'The new key and value are written at token slot four. That is thirty-two append payload bytes.',
  'Reading old history and appending a new entry are different jobs, with different amounts of data.'],
  ()=>cacheView(e.cache,{append:true})),
 predict('Double the old history to eight tokens',[
  'Consider eight old tokens with the same component width and one new token. Pause and predict which payload doubles: the old-history read, the append, or both?',
  'The reserved capacity still has room for this case.'],
  ()=>compare(['Old tokens',e.cacheOther.cached,'Same width and dtype'],['New tokens',1,'One append'])),
 S('History reads grow; one append stays the same',[
  'The old-history read becomes two hundred and fifty-six payload bytes. The single-token append remains thirty-two bytes.',
  'Longer history changes how much old data is consumed, even when the number of new tokens is unchanged. These are payload counts, not measured bandwidth.'],
  ()=>cacheView(e.cacheOther,{append:true})),
]);

const resourceView=model=>svg(rect(15,5,1170,285,'chip')+text(35,47,'Imaginary SM budget · 128 shared bytes, 1024 registers','label')+
 rect(40,90,470,150,'box')+text(60,133,'Tile width','label')+text(275,205,model.tile,'big','middle')+
 rect(655,90,490,150,'active')+text(675,133,'Blocks that fit','label')+text(900,205,model.residentBlocks,'big','middle'));
P('matmul-investigation',15,'Balance reuse against SM resource demand',
 'Explain why operand-load counts and shared storage do not establish a faster tile configuration.',
 '8 × 8 calculation · explicitly imaginary resource budget · no real GPU occupancy or timing claim',[
 S('Reuse has a resource cost',[
  'For the eight-by-eight calculation, a larger tile can reduce the algorithm’s global operand loads.',
  'The same change also increases each block’s shared storage and thread working state. We need both sides of that comparison.'],
  ()=>compare(['Tile width 2',e.smallTile.inputLoads,'Calculated operand loads'],['Tile width 4',e.largeTile.inputLoads,'Calculated operand loads'])),
 S('Per-block storage grows with the tile',[
  'Two shared input tiles need thirty-two bytes per block at tile width two, and one hundred and twenty-eight at tile width four.',
  'These are storage requirements of this algorithm, not measurements of device-memory transactions.'],
  ()=>compare(['Tile width 2',e.smallTile.sharedBytes+' B','Shared storage per block'],['Tile width 4',e.largeTile.sharedBytes+' B','Shared storage per block'])),
 S('A finite SM budget limits resident blocks',[
  'Use an imaginary SM with one hundred and twenty-eight shared bytes, one thousand and twenty-four registers, and a maximum of eight blocks.',
  'These intentionally small teaching budgets are separate from a real device’s limits. The smaller tile allows four resident blocks in this model.'],
  ()=>resourceView(e.smallTile)),
 S('The larger tile leaves room for fewer blocks',[
  'At tile width four, one block consumes the whole shared-memory budget, so only one block fits.',
  'The reduced operand-load count does not tell us whether that loss of resident work helps or hurts execution time.'],
  ()=>resourceView(e.largeTile)),
 predict('Increase only the shared-memory budget',[
  'Keep tile width four and the same register budget, but raise shared capacity to five hundred and twelve bytes.',
  'Pause and predict whether eight blocks must now fit. Which other resource could still limit residency?'],
  ()=>compare(['Shared budget','512 B','Changed teaching capacity'],['Register budget',1024,'Unchanged teaching capacity'])),
 S('The tightest resource still wins',[
  'The model permits four blocks, not eight. Each larger block also needs two hundred and fifty-six registers under the chosen register assumption.',
  'Use counts to form a hypothesis, verify the full numerical result, then measure a named real GPU before ranking performance.'],
  ()=>compare(['Blocks that fit',e.moreShared.residentBlocks,'Minimum across resource limits'],['Performance conclusion','Measure','Counts alone are insufficient'])),
]);

P('histograms',16,'Follow local counts into global counters',
 'Explain per-block aggregation, indivisible updates and collective boundaries without timing claims.',
 'Eight tokens · two four-thread blocks · integer operation counts, not runtime',[
 S('Several threads can target one counter',[
  'The eight token categories include four zeros. Several threads therefore update the same category-zero count.',
  'An atomic addition makes one supported update indivisible. It does not make the block’s other operations a collective barrier.'],
  ()=>array('Token categories',e.histogram.input,{integer:true})),
 S('Each block has its own shared counters',[
  'With local aggregation, each block clears its own four-counter shared array on its SM.',
  'All four threads arrive at a barrier before those counters are used. The blocks’ shared arrays remain separate.'],
  ()=>pairRows('Block 0 shared partial counts',e.histogram.partial[0],'Block 1 shared partial counts',e.histogram.partial[1],true)),
 S('Local contributions are combined before merging',[
  'Threads make their atomic contributions to the block’s shared counters. A following block barrier completes this counting phase before the merge.',
  'Only nonzero partial counters need a global atomic merge in this example.'],
  ()=>flow([{title:['SM','Block 0 partials'],value:'Own workspace',kind:'chip'},{title:['GPU memory','Global counters'],value:words(e.histogram.counts)},{title:['SM','Block 1 partials'],value:'Own workspace',kind:'chip'}],{active:1,directions:['right','left']})),
 S('Read both kinds of operation count',[
  'Direct global counting makes eight global atomic additions. Local aggregation makes eight shared atomic additions and six global merges for these inputs.',
  'That changes where operations occur. Extra local work and synchronisation still matter, so these counts are not a speed measurement.'],
  ()=>compare(['Direct global updates',e.histogram.input.length,'Eight tokens'],['Global partial merges',e.histogram.globalUpdates,'Plus eight shared additions'])),
 predict('Every token chooses category zero',[
  'Now consider a hot category: all eight tokens choose zero. Pause and predict the number of nonzero block partials that must merge globally.',
  'Each of the two blocks still has its own shared workspace.'],
  ()=>array('New category IDs',e.hotHistogram.input,{integer:true})),
 S('Two completed partials reach the global counter',[
  'Each block contributes one nonzero category-zero partial, so the model needs two global merges. The final count is eight.',
  'Shared aggregation combines local contributions; atomic operations protect updates; barriers protect the phase boundaries. Those are separate responsibilities.'],
  ()=>compare(['Global merges',e.hotHistogram.globalUpdates,'One nonzero partial per block'],['Category-zero count',e.hotHistogram.counts[0],'Every token counted once'])),
]);

P('scan',17,'Keep old shared state separate from new scan values',
 'Explain why private partner values and collective ordering protect each shared-memory scan stage.',
 'One eight-thread block · integer flags · illustrative dependencies, not clock cycles',[
 S('Offsets count earlier selected positions',[
  'A scan combines a row of flags into prefixes. An exclusive offset counts selected positions strictly before the current position.',
  'The GPU question is how every thread reads the old stage while the block builds a new one.'],
  ()=>pairRows('Flags',e.scan.input,'Exclusive offsets',e.scan.values,true)),
 S('The shared array is a completed stage',[
  'The block’s shared values begin as the eight flags. At each partner distance, a thread needs a value from the preceding stage.',
  'Shared memory lets threads exchange values, but it does not automatically keep those values unchanged during the exchange.'],
  ()=>array('Shared flags before the first stage',e.scan.input,{integer:true})),
 S('Capture the partner in private working state',[
  'Each participating thread first captures its old partner value in the private variable previous.',
  'All threads then reach a barrier before any thread is allowed to overwrite the old shared stage.'],
  ()=>flow([{title:['Shared memory','Old partner'],value:'Read'},{title:['Thread value','previous'],value:'Retained',kind:'chip'},{title:'Block barrier',value:'All arrive'}],{active:1})),
 S('Publish the new stage before reading it',[
  'After that barrier, threads update shared storage. Another block barrier completes those writes before the next partner distance begins.',
  'The barriers protect two different boundaries: old reads before overwrites, and new writes before later reads.'],
  ()=>pairRows('Old shared stage',e.scan.steps[0].cells,'After partner distance 1',e.scan.steps[1].cells,true)),
 predict('Can a later barrier protect an earlier read?',[
  'Imagine thread one has already replaced its old flag with one, while thread two still needs thread one’s old flag of zero.',
  'Pause and predict whether a barrier only after the writes would protect that old value. This is a possible race illustration, not an executed unsafe kernel.'],
  ()=>compare(['Thread 1 old value',e.scan.input[1],'Needed by its neighbour'],['Thread 1 new value',e.scan.steps[1].cells[1],'Already overwritten'])),
 S('Protect the snapshot before overwriting it',[
  'A later barrier cannot restore a value that was already overwritten. Capturing partners first, then collectively ordering the writes, preserves the intended stage.',
  'The private working value and the block’s shared array solve different parts of that dependency.'],
  ()=>flow([{title:'Read old values',value:'Private copy'},{title:'All arrive',value:'Then write',kind:'chip'},{title:'All arrive',value:'Next stage'}],{active:1})),
]);

P('compaction',18,'See why output order can survive unordered writes',
 'Explain stream-ordered phases and exclusive offsets as stable device-memory destinations.',
 'Eight token IDs · completed flags and offsets · chosen write inspection order, not a GPU schedule',[
 S('Keep selected tokens in input order',[
  'For category zero, the selected input token IDs are zero, two, five and seven.',
  'Their threads need unique output positions even if the GPU does not execute those threads in input order.'],
  ()=>array('Input category IDs',e.compact.input,{integer:true})),
 S('Completed phases communicate through device memory',[
  'The flag kernel writes selection flags. The scan kernel uses completed flags to produce offsets, and scatter uses completed offsets.',
  'The launches use one ordered stream. A block barrier is not the mechanism that orders these separate kernel phases.'],
  ()=>flow([{title:'Flag kernel',value:'Flags'},{title:'Scan kernel',value:'Offsets'},{title:'Scatter kernel',value:'Token IDs'}],{active:1})),
 S('An offset supplies a destination',[
  'Token five has two earlier selected tokens, so its exclusive offset is two.',
  'Its scatter writes token ID five into output position two. The address comes from the completed prefix, not from arrival order.'],
  ()=>compare(['Token ID',5,'Selected category zero'],['Output position',e.compact.offsets[5],'Two earlier survivors'])),
 predict('Let token seven write first',[
  'Pause and predict the destination if token seven’s write is inspected before token zero’s.',
  'Does writing first give token seven output position zero?'],
  ()=>compare(['First inspected writer',7,'Its offset is already complete'],['Chosen output position','?','Not an arrival-order ticket'])),
 S('Its offset still sends it to position three',[
  'Token seven writes position three because three selected tokens precede it in the input.',
  'The model inspects writes in reverse order and still produces token IDs zero, two, five and seven in the completed output.'],
  ()=>array('Completed compact output · reverse write inspection',e.compact.output,{integer:true})),
 S('Ordering data and ordering execution are different',[
  'Stream dependencies make flags and offsets ready before scatter. Prefix offsets determine the stable destination of each survivor.',
  'The SMs may execute independent writes in different orders; the completed output’s order follows the address calculation.'],
  ()=>statement('Stable destinations preserve token order','Completed phase inputs first · distinct writes next')),
]);

P('progress',19,'Separate consumers from barrier participants',
 'Explain why changing the reader subset does not change a matching block barrier’s participant set.',
 'One four-thread block · no early exits · invalid cases are diagnostics, not executed undefined CUDA',[
 S('Four writers prepare shared values',[
  'The four-thread block writes values one through four into its shared workspace.',
  'A block barrier follows those writes. Only after it do the selected readers consume neighbouring values.'],
  ()=>array('Shared values supplied by threads 0–3',[1,2,3,4],{integer:true})),
 S('A block barrier is a collective boundary',[
  'All four non-exited block threads must reach the matching barrier in this example.',
  'Having enough SM resources does not repair a missing participant. The barrier contract and the hardware’s capacity are different questions.'],
  ()=>gate({arrivals:4,readers:2})),
 S('The reader condition comes after the barrier',[
  'With two readers, threads zero and one consume shared values after all four writers have arrived.',
  'The condition selects consumers. It does not select which writers participate in the earlier collective.'],
  ()=>captionCode('__syncthreads();\nif (t < readers) { /* read shared values */ }','Correct ordering · the supplied kernel')),
 predict('Reduce the consumer set to one',[
  'Consider readers equal to one, with the same four launched threads and no early exits.',
  'Pause and predict the required number of barrier arrivals. Is it now one or four?'],
  ()=>compare(['Consumers',1,'Only thread zero reads'],['Barrier arrivals','?','Four threads supplied values'])),
 S('All four still reach the barrier',[
  'The required arrivals stay at four. Only the number of consumers changes.',
  'The safe program leaves the barrier outside the reader condition, so the shared writes precede the dependent reads.'],
  ()=>gate({arrivals:4,readers:1})),
 S('Diagnose participation without inventing a result',[
  'If some of these non-exited threads skip a barrier taken by the others, this is invalid collective participation.',
  'The diagnostic does not assign a numerical result or promise how a real GPU will fail. Fix the participant set before reasoning about the output.'],
  ()=>gate({arrivals:2,readers:2,phase:'bad'})),
]);

const slotView=stage=>svg(
 text(30,42,'GPU input copy and SM execution use different resources','label')+
 rect(30,78,325,150,stage==='copy'?'active':'box')+text(50,122,'Copy engine','label')+text(50,187,stage==='released'?'Next input':'Free','value')+
 rect(438,78,325,150,stage==='waiting'?'guard':'box')+text(458,122,'GPU buffer A','label')+text(458,187,stage==='released'?'Reusable':'Still in use','value')+
 rect(845,78,325,150,'chip')+text(865,122,'SM execution','label')+text(865,187,stage==='released'?'Finished A':'Process A','value')+
 (stage==='released'?arrow(360,156,433,156):'')+text(30,280,stage==='released'?'used[0] follows the result copy; the next input can now reuse A.':'Wait for the previous consumer and result copy before overwriting A.','small'));
P('pipelines',20,'Follow readiness and buffer reuse between engines',
 'Explain event dependencies and safe slot reuse independently of an overlap timing claim.',
 'Four chunks · two GPU buffer slots · dependency diagram, not a measured timeline',[
 S('Two buffers can connect copy and compute work',[
  'The starter has four input chunks and two reusable GPU buffer slots. Copies supply values; SMs execute the doubling kernel.',
  'Separate resources can overlap eligible work, but streams express ordering rather than reserved hardware engines.'],
  ()=>slotView('copy')),
 S('A readiness event connects two queues',[
  'The copy stream records ready after supplying a slot’s input. The compute stream waits for that event before using the slot.',
  'An event marks completion of earlier work in its stream; the wait adds a dependency from the other stream.'],
  ()=>flow([{title:'Input copy',value:'Complete'},{title:'ready event',value:'Compute waits',kind:'chip'},{title:'SM kernel',value:'Can use input'}],{active:1})),
 S('The result copy is also a consumer',[
  'After the kernel, the compute stream copies the result back to the CPU. Only then does it record used for that slot.',
  'Finishing the input copy alone does not make a buffer safe for a later chunk to overwrite.'],
  ()=>flow([{title:'SM kernel',value:'Writes result'},{title:'Result copy',value:'Reads buffer'},{title:'used event',value:'Slot released'}],{active:1})),
 predict('The copy engine is free; buffer A is not',[
  'Chunk two wants to reuse slot A from chunk zero. The copy engine is available, but the previous computation or result copy still uses A.',
  'Pause and predict whether the next input can overwrite that slot immediately.'],
  ()=>slotView('waiting')),
 S('Wait for the slot’s last consumer',[
  'It must wait for used from the previous chunk in that slot. The next input copy can proceed after the kernel and result copy have finished using A.',
  'Slot B permits a different chunk to make progress while A is held; it does not remove A’s dependency.'],
  ()=>slotView('released')),
 S('Dependencies establish safety, not a speed-up',[
  'Correct overlap needs readiness before consumption and release before reuse. The supplied events express those edges.',
  'Actual overlap depends on the device and workload. A diagram of eligible work is not evidence of elapsed-time improvement.'],
  ()=>statement('Ready before use · released before reuse','Copies and SM work may overlap when their dependencies allow it.')),
]);

P('token-routing',21,'Connect category counts to stable token addresses',
 'Explain why safe counts need prefix ranks to become a stable grouping.',
 'Eight token IDs · four categories · stable destinations, not an instruction schedule',[
 S('Counts describe sizes, not token order',[
  'The eight tokens choose four categories. The counts tell us the size of each output region.',
  'They do not by themselves say where each token ID belongs within its category.'],
  ()=>pairRows('Input category IDs',e.routing.input,'Category counts',e.routing.counts,true)),
 S('Completed counts choose each region’s start',[
  'The count kernel finishes before the route kernel begins in the same stream. Device-memory counts therefore supply the region sizes before placement.',
  'Exclusive category starts identify where each category’s output region begins.'],
  ()=>pairRows('Counts by category',e.routing.counts,'Exclusive category starts',e.routing.offsets,true)),
 S('A prefix rank identifies earlier matching tokens',[
  'Token five belongs to category zero. Two earlier tokens have that category, so its within-category rank is two.',
  'The route kernel’s completed shared prefix stages supply this rank before the scatter write.'],
  ()=>routingView(e.routing,{focus:5})),
 S('Start plus rank forms a unique destination',[
  'A category’s start plus the token’s earlier-match rank gives the destination. Token five therefore writes output position two.',
  'The SM performs this address calculation; GPU memory holds the category regions and their stored token IDs.'],
  ()=>routingView(e.routing,{focus:5})),
 predict('Token seven executes its write first',[
  'Token seven also belongs to category zero. Suppose its write is inspected before the other category-zero writes.',
  'Pause and predict whether it should take position zero or retain the destination determined by its earlier-match rank.'],
  ()=>routingView(e.routing,{focus:7,show:false})),
 S('Its stable rank still chooses position three',[
  'Token seven has three earlier matching tokens, so it retains position three even if its write happens first.',
  'Atomic arrival tickets can make updates unique without preserving input order. Stable grouping needs the explicit prefix rank used here.'],
  ()=>routingView(e.routing,{focus:7})),
 S('The grouped IDs preserve order within each category',[
  'The completed grouping places zero, two, five and seven in the first region, followed by one and four, then three, then six.',
  'Choose the required output contract first: counts need safe additions; stable token grouping also needs ordered ranks and distinct destinations.'],
  ()=>array('Grouped token IDs · regions follow category order',e.routing.output,{integer:true})),
]);

export {plans};
