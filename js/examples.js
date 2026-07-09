/* ======================================================================
   1. EXAMPLE SNIPPETS
   ====================================================================== */
const examples = [
  {
    name: "Sync vs Async basics",
    code:
`console.log('Start');

setTimeout(function () {
  console.log('Timeout callback');
}, 0);

Promise.resolve().then(function () {
  console.log('Promise callback');
});

console.log('End');`
  },
  {
    name: "Two timers, different delays",
    code:
`console.log('Script start');

setTimeout(function () {
  console.log('Timer A (100ms)');
}, 100);

setTimeout(function () {
  console.log('Timer B (0ms)');
}, 0);

Promise.resolve().then(function () {
  console.log('Promise 1');
});

console.log('Script end');`
  },
  {
    name: "Chained .then() microtasks",
    code:
`console.log('Start');

Promise.resolve().then(function () {
  console.log('then #1');
}).then(function () {
  console.log('then #2');
}).then(function () {
  console.log('then #3');
});

setTimeout(function () {
  console.log('Timeout callback');
}, 0);

console.log('End');`
  },
  {
    name: "async / await flow",
    code:
`console.log('A: script start');

function slow() {
  console.log('B: slow() called');
}

async function main() {
  console.log('C: main() start');
  slow();
  await null;
  console.log('D: main() after await');
}

main();

console.log('E: script end');`
  },
  {
    name: "Everything at once",
    code:
`console.log('1');

setTimeout(function () {
  console.log('2 (timeout)');
}, 0);

Promise.resolve().then(function () {
  console.log('3 (promise)');
}).then(function () {
  console.log('4 (promise chain)');
});

async function task() {
  console.log('5 (async, before await)');
  await null;
  console.log('6 (async, after await)');
}

task();

console.log('7 (sync end)');`
  }
];
