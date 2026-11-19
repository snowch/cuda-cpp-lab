// Copyright © 2026 Christopher Snow.
// Match the authored starter excerpts without depending on indentation or line
// numbers. Literal edits keep their location; comments never act as code anchors.
export function cudaTokens(source) {
  const pattern=/\/\/[^\n]*|\/\*[^]*?\*\/|"(?:\\[^]|[^"\\])*"|'(?:\\[^]|[^'\\])*'|(?:0[xX][\da-fA-F']+|(?:\d[\d']*(?:\.[\d']*)?|\.\d+)(?:[eE][+-]?\d+)?)[fFuUlL]*|[A-Za-z_]\w*|[^\s]/g;
  return [...source.matchAll(pattern)].filter(m=>!m[0].startsWith('//')&&!m[0].startsWith('/*')).map(m=>({
    key:/^(?:\d|\.\d)/.test(m[0])?'#number':m[0],index:m.index,end:m.index+m[0].length,
  }));
}

function locate(tokens, wanted) {
  if(!wanted.length)return null;
  const start=tokens.findIndex((token,index)=>token.key===wanted[0].key&&wanted.every((part,offset)=>tokens[index+offset]?.key===part.key));
  return start<0?null:{index:tokens[start].index,end:tokens[start+wanted.length-1].end};
}

export function locateCudaExcerpt(source, excerpt, tokens=cudaTokens(source)) {
  const wanted=cudaTokens(excerpt),whole=locate(tokens,wanted);
  if(whole)return {ranges:[whole],missing:[]};
  // A teaching excerpt can omit checks between statements, or omit the assignment
  // around a CUDA call. Match each complete statement rather than colouring every
  // occurrence of its identifiers elsewhere in the program.
  const groups=[];let group=[],parens=0;
  for(const token of wanted){
    group.push(token);
    if(token.key==='(')parens++;
    if(token.key===')')parens--;
    if(!parens&&[';','{','}'].includes(token.key)){groups.push(group);group=[];}
  }
  if(group.length)groups.push(group);
  const ranges=[],missing=[];
  for(const part of groups){
    const meaningful=part.some(t=>/^[A-Za-z_]\w*$/.test(t.key));
    const match=meaningful&&(locate(tokens,part)||
      (part.at(-1)?.key===';'&&part.at(-2)?.key===')'&&locate(tokens,part.slice(0,-1))));
    if(match)ranges.push(match);else missing.push(...part);
  }
  return {ranges,missing};
}

export function sourceExcerptRanges(source, excerpts) {
  const tokens=cudaTokens(source);
  return excerpts.flatMap(excerpt=>locateCudaExcerpt(source,excerpt,tokens).ranges);
}
