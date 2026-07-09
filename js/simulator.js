/* ======================================================================
   2. TINY, STRING-AWARE PARSER HELPERS
   ====================================================================== */
function findMatchingClose(str, openIdx, openCh, closeCh){
  let depth = 1, i = openIdx + 1, inStr = null;
  while (i < str.length && depth > 0){
    const c = str[i];
    if (inStr){
      if (c === '\\'){ i += 2; continue; }
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`'){ inStr = c; i++; continue; }
    if (c === openCh) depth++;
    else if (c === closeCh) depth--;
    i++;
  }
  return i - 1;
}

function splitStatements(code){
  const stmts = [];
  let depth = 0, current = '', inStr = null;
  for (let i = 0; i < code.length; i++){
    const c = code[i];
    if (inStr){
      current += c;
      if (c === '\\'){ current += code[++i] || ''; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`'){ inStr = c; current += c; continue; }
    if (c === '{' || c === '(' || c === '[') depth++;
    if (c === '}' || c === ')' || c === ']') depth--;
    current += c;
    if (c === ';' && depth === 0){
      const t = current.trim();
      if (t) stmts.push(t);
      current = '';
    } else if (c === '}' && depth === 0){
      let j = i + 1;
      while (j < code.length && /\s/.test(code[j])) j++;
      if (code[j] === '.' || code[j] === ')') continue; // part of a chained call
      const t = current.trim();
      if (t) stmts.push(t);
      current = '';
    }
  }
  const rest = current.trim();
  if (rest) stmts.push(rest);
  return stmts;
}

function matchNamedCall(stmt, name){
  const s = stmt.trim();
  if (!s.startsWith(name + '(')) return null;
  const openIdx = name.length;
  const closeIdx = findMatchingClose(s, openIdx, '(', ')');
  return { argsStr: s.slice(openIdx + 1, closeIdx) };
}

function splitArgs(s){
  const args = [];
  let depth = 0, current = '', inStr = null;
  for (let i = 0; i < s.length; i++){
    const c = s[i];
    if (inStr){
      current += c;
      if (c === '\\'){ current += s[++i] || ''; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`'){ inStr = c; current += c; continue; }
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0){ args.push(current.trim()); current = ''; continue; }
    current += c;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function parseCallbackBody(argStr){
  argStr = (argStr || '').trim();
  let m = argStr.match(/^\(?\s*([^()=]*?)\s*\)?\s*=>\s*([\s\S]*)$/);
  if (m){
    let body = m[2].trim();
    if (body.startsWith('{')){
      const inner = body.slice(1, body.lastIndexOf('}'));
      return splitStatements(inner);
    }
    return [body.replace(/;$/, '')];
  }
  m = argStr.match(/^function\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/);
  if (m) return splitStatements(m[2]);
  return [];
}

function isPromiseThenChain(stmt){
  return /^Promise\.(resolve|reject)\s*\(/.test(stmt.trim()) && stmt.includes('.then(');
}

function parseThenChain(stmt){
  let s = stmt.trim().replace(/;$/, '');
  let i = 0;
  const m = s.match(/^Promise\.(resolve|reject)\s*\(/);
  if (m){
    const openIdx = m[0].length - 1;
    i = findMatchingClose(s, openIdx, '(', ')') + 1;
  }
  const chain = [];
  while (true){
    const thenIdx = s.indexOf('.then(', i);
    if (thenIdx < 0) break;
    const openIdx = thenIdx + 5;
    const closeIdx = findMatchingClose(s, openIdx, '(', ')');
    chain.push(parseCallbackBody(s.slice(openIdx + 1, closeIdx)));
    i = closeIdx + 1;
  }
  return chain;
}

function evalLogArg(argStr){
  const t = (argStr || '').trim();
  const m = t.match(/^(['"`])([\s\S]*)\1$/);
  return m ? m[2] : t;
}

function extractFunctions(code){
  const stmts = splitStatements(code);
  const functions = {};
  const mainStmts = [];
  for (const s of stmts){
    let m = s.match(/^async\s+function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/);
    if (m){ functions[m[1]] = { isAsync: true, body: splitStatements(m[3]) }; continue; }
    m = s.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/);
    if (m){ functions[m[1]] = { isAsync: false, body: splitStatements(m[3]) }; continue; }
    mainStmts.push(s);
  }
  return { functions, mainStmts };
}

function validateSyntax(code){
  if (!code || !code.trim()){
    throw new Error('The code editor is empty — write or paste some JavaScript first.');
  }
  const openers = { '(': ')', '[': ']', '{': '}' };
  const closers = { ')': '(', ']': '[', '}': '{' };
  const stackChars = [];
  let inStr = null;
  for (let i = 0; i < code.length; i++){
    const c = code[i];
    if (inStr){
      if (c === '\\'){ i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`'){ inStr = c; continue; }
    if (openers[c]) stackChars.push(c);
    else if (closers[c]){
      const top = stackChars.pop();
      if (top !== closers[c]){
        throw new Error(`Found an unexpected "${c}" — check that every ( [ { has a matching ) ] }.`);
      }
    }
  }
  if (inStr){
    throw new Error('A string is missing its closing quote — check your \' " or ` marks.');
  }
  if (stackChars.length){
    const missing = openers[stackChars[stackChars.length - 1]];
    throw new Error(`Missing a closing "${missing}" somewhere — check that every ( [ { is closed.`);
  }
}

/* ======================================================================
   3. THE SIMULATOR / SCHEDULER
   ====================================================================== */
let stack, webApis, microtaskQ, macrotaskQ, output, steps;
let microtaskRunners, webApiRunners, macrotaskRunners, functionsMap, uidCounter;
let userEnv, activeIntervals;

function uid(prefix){ return prefix + '_' + (uidCounter++); }

function snapshot(desc, type){
  if (steps.length > 400){
    throw new Error('Simulation stopped — this code looks like it might loop forever. Try simplifying it.');
  }
  steps.push({
    desc, type,
    stack: stack.map(f => ({ ...f })),
    webApis: webApis.map(f => ({ ...f })),
    microtaskQ: microtaskQ.map(f => ({ ...f })),
    macrotaskQ: macrotaskQ.map(f => ({ ...f })),
    output: output.slice()
  });
}

function enqueueMicrotask(label, runFn){
  const id = uid('mt');
  microtaskQ.push({ id, label });
  microtaskRunners.set(id, runFn);
  snapshot(`"${label}" is added to the Microtask Queue.`, 'schedule-microtask');
}

function enqueueMacrotaskViaTimer(label, delay, runFn){
  const id = uid('api');
  webApis.push({ id, label, delay });
  webApiRunners.set(id, runFn);
  snapshot(`setTimeout hands "${label}" to the Web APIs — the browser starts a ${delay}ms timer.`, 'schedule-timer');
}

function runFrame(label, stmts){
  stack.push({ id: uid('f'), label });
  snapshot(`"${label}" begins running on the Call Stack.`, 'push');
  execStatements(stmts, { label, isAsync: false });
  stack.pop();
  snapshot(`"${label}" finishes and is popped off the Call Stack.`, 'pop');
}

function scheduleThenChain(chain, idx){
  if (idx >= chain.length) return;
  const label = `.then #${idx + 1}`;
  enqueueMicrotask(label, () => {
    runFrame(label, chain[idx]);
    scheduleThenChain(chain, idx + 1);
  });
}

function callFunction(name){
  const fn = functionsMap[name];
  stack.push({ id: uid('f'), label: name + '()' });
  snapshot(`"${name}()" is called and pushed onto the Call Stack.`, 'push');
  const suspended = execStatements(fn.body, { label: name + '()', isAsync: fn.isAsync });
  if (!suspended){
    stack.pop();
    snapshot(`"${name}()" finishes and is popped off the Call Stack.`, 'pop');
  }
}

function suspendAndContinue(ctx, remaining){
  const label = ctx.label;
  snapshot(`"${label}" reaches an 'await'. It must pause here until the awaited value settles.`, 'await-hit');
  enqueueMicrotask(label + ' (resume)', () => {
    stack.push({ id: uid('f'), label });
    snapshot(`"${label}" resumes on the Call Stack after the awaited value settles.`, 'push');
    const suspendedAgain = execStatements(remaining, ctx);
    if (!suspendedAgain){
      stack.pop();
      snapshot(`"${label}" completes and is popped off the Call Stack.`, 'pop');
    }
  });
  stack.pop();
  snapshot(`"${label}" suspends and is popped off the Call Stack; the rest of it is queued as a microtask.`, 'pop');
}

function execOne(stmt, ctx){
  stmt = stmt.trim();
  if (!stmt) return;

  const cl = matchNamedCall(stmt, 'console.log');
  if (cl){
    let text;
    try {
      text = String(new Function('env', `with(env) { return ${cl.argsStr}; }`)(userEnv));
    } catch(e) {
      text = evalLogArg(cl.argsStr);
    }
    output.push(text);
    snapshot(`Runs console.log(${cl.argsStr}) — synchronous, so it prints immediately.`, 'log');
    return;
  }

  const st = matchNamedCall(stmt, 'setTimeout');
  if (st){
    const args = splitArgs(st.argsStr);
    const cbStmts = parseCallbackBody(args[0] || '');
    const delay = parseInt(args[1], 10) || 0;
    const label = `setTimeout ${delay}ms`;
    enqueueMacrotaskViaTimer(label, delay, () => runFrame(label, cbStmts));
    return;
  }

  const si = matchNamedCall(stmt, 'setImmediate');
  if (si){
    const args = splitArgs(si.argsStr);
    const cbStmts = parseCallbackBody(args[0] || '');
    const label = `setImmediate`;
    enqueueMacrotaskViaTimer(label, 0, () => runFrame(label, cbStmts));
    return;
  }

  const sintMatch = stmt.match(/^(?:(?:let|const|var)\s+([\w$]+)\s*=\s*)?setInterval\s*\(/);
  if (sintMatch) {
    const openIdx = stmt.indexOf('setInterval(') + 11;
    const closeIdx = findMatchingClose(stmt, openIdx, '(', ')');
    const argsStr = stmt.slice(openIdx + 1, closeIdx);
    const args = splitArgs(argsStr);
    const cbStmts = parseCallbackBody(args[0] || '');
    const delay = parseInt(args[1], 10) || 0;
    const label = `setInterval ${delay}ms`;
    
    const id = uid('api_int');
    if (sintMatch[1]) {
      userEnv[sintMatch[1]] = id;
    }
    
    activeIntervals.add(id);
    const recurringRunFn = () => {
      if (!activeIntervals.has(id)) return;
      runFrame(label, cbStmts);
      if (activeIntervals.has(id)) {
        webApis.push({ id, label, delay });
        webApiRunners.set(id, recurringRunFn);
      }
    };
    
    webApis.push({ id, label, delay });
    webApiRunners.set(id, recurringRunFn);
    
    snapshot(`setInterval hands "${label}" to Web APIs.`, 'schedule-timer');
    return;
  }

  const ci = matchNamedCall(stmt, 'clearInterval');
  if (ci) {
    let intervalId;
    try {
      intervalId = new Function('env', `with(env) { return ${ci.argsStr}; }`)(userEnv);
    } catch(e) {
      intervalId = ci.argsStr.trim();
    }
    activeIntervals.delete(intervalId);
    const idx = webApis.findIndex(w => w.id === intervalId);
    if (idx !== -1) webApis.splice(idx, 1);
    webApiRunners.delete(intervalId);
    const mIdx = macrotaskQ.findIndex(m => m.id === intervalId);
    if (mIdx !== -1) macrotaskQ.splice(mIdx, 1);
    macrotaskRunners.delete(intervalId);
    snapshot(`clearInterval removes timer`, 'other');
    return;
  }

  if (stmt.startsWith('if')) {
    const s = stmt.trim();
    const openIdx = s.indexOf('(');
    if (openIdx !== -1) {
      const closeIdx = findMatchingClose(s, openIdx, '(', ')');
      const condStr = s.slice(openIdx + 1, closeIdx);
      
      const bodyStart = s.indexOf('{', closeIdx);
      if (bodyStart !== -1) {
        const bodyEnd = findMatchingClose(s, bodyStart, '{', '}');
        const bodyStr = s.slice(bodyStart + 1, bodyEnd);
        
        let cond = false;
        try {
          cond = new Function('env', `with(env) { return ${condStr}; }`)(userEnv);
        } catch(e) {
          cond = true;
        }
        snapshot(`Evaluates if (${condStr}) -> ${cond}`, 'other');
        if (cond) {
          const bodyStmts = splitStatements(bodyStr);
          execStatements(bodyStmts, ctx);
        }
        return;
      }
    }
  }

  const varDecl = stmt.match(/^(?:let|const|var)\s+([\w$]+)\s*(?:=\s*(.*))?$/);
  if (varDecl) {
    try {
      let valStr = varDecl[2];
      if (valStr && valStr.endsWith(';')) valStr = valStr.slice(0, -1);
      const val = valStr ? new Function('env', `with(env) { return ${valStr}; }`)(userEnv) : undefined;
      userEnv[varDecl[1]] = val;
    } catch(e) {}
    snapshot(`Runs: ${stmt}`, 'other');
    return;
  }

  const assign = stmt.match(/^([\w$]+)\s*=\s*(.*)$/);
  if (assign) {
    try {
      let valStr = assign[2];
      if (valStr && valStr.endsWith(';')) valStr = valStr.slice(0, -1);
      userEnv[assign[1]] = new Function('env', `with(env) { return ${valStr}; }`)(userEnv);
    } catch(e) {}
    snapshot(`Runs: ${stmt}`, 'other');
    return;
  }

  if (isPromiseThenChain(stmt)){
    scheduleThenChain(parseThenChain(stmt), 0);
    return;
  }

  const callM = stmt.match(/^([A-Za-z_$][\w$]*)\s*\(\s*\)\s*;?$/);
  if (callM && functionsMap[callM[1]]){
    callFunction(callM[1]);
    return;
  }

  try {
    new Function('env', `with(env) { ${stmt} }`)(userEnv);
  } catch(e) {}

  snapshot(`Runs: ${stmt.length > 70 ? stmt.slice(0, 70) + '…' : stmt}`, 'other');
}

function execStatements(stmts, ctx){
  for (let i = 0; i < stmts.length; i++){
    const stmt = stmts[i].trim();
    if (ctx.isAsync && /^(?:const|let|var)\s+[\w$]+\s*=\s*await\b|^await\b/.test(stmt)){
      suspendAndContinue(ctx, stmts.slice(i + 1));
      return true;
    }
    execOne(stmt, ctx);
  }
  return false;
}

function eventLoop(){
  let guard = 0;
  while (true){
    guard++;
    if (guard > 1000) throw new Error('Simulation stopped — the event loop seems stuck repeating. Try simplifying the code.');

    if (microtaskQ.length){
      snapshot('The Call Stack is empty, so the Event Loop drains the entire Microtask Queue before anything else.', 'tick');
      while (microtaskQ.length){
        const task = microtaskQ.shift();
        const runner = microtaskRunners.get(task.id);
        microtaskRunners.delete(task.id);
        snapshot(`"${task.label}" is taken off the Microtask Queue and runs on the Call Stack.`, 'dequeue-microtask');
        runner();
      }
      continue;
    }
    if (!macrotaskQ.length && webApis.length){
      webApis.sort((a, b) => a.delay - b.delay);
      const timer = webApis.shift();
      const fn = webApiRunners.get(timer.id);
      webApiRunners.delete(timer.id);
      macrotaskRunners.set(timer.id, fn);
      macrotaskQ.push({ id: timer.id, label: timer.label });
      snapshot(`"${timer.label}"'s timer elapses (${timer.delay}ms). Its callback moves from Web APIs to the Macrotask Queue.`, 'timer-fire');
      continue;
    }
    if (macrotaskQ.length){
      const task = macrotaskQ.shift();
      const runner = macrotaskRunners.get(task.id);
      macrotaskRunners.delete(task.id);
      snapshot(`"${task.label}" is taken off the Macrotask Queue and runs on the Call Stack.`, 'dequeue-macrotask');
      runner();
      continue;
    }
    break;
  }
  snapshot('All queues and the Call Stack are empty — execution is complete.', 'done');
}

function simulate(code){
  stack = []; webApis = []; microtaskQ = []; macrotaskQ = []; output = []; steps = [];
  microtaskRunners = new Map(); webApiRunners = new Map(); macrotaskRunners = new Map();
  functionsMap = {}; uidCounter = 0;
  userEnv = {}; activeIntervals = new Set();

  const { functions, mainStmts } = extractFunctions(code);
  functionsMap = functions;

  stack.push({ id: uid('f'), label: 'Script (global)' });
  snapshot('The script starts. Its global code is pushed onto the Call Stack as the first frame.', 'push');
  execStatements(mainStmts, { label: 'Script (global)', isAsync: false });
  stack.pop();
  snapshot('No synchronous code is left in the global scope — the Call Stack is now empty.', 'pop');

  eventLoop();
  return steps;
}
