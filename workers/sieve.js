// workers/sieve.js
// Sieve of Eratosthenes computed off-main-thread for the Ulam spiral.
self.onmessage = (event) => {
  if (!event.data || event.data.type !== 'sieve') return;
  const max = Math.max(2, Number(event.data.max) || 0);
  const sieve = new Uint8Array(max + 1);
  sieve.fill(1, 2);
  const limit = Math.floor(Math.sqrt(max));
  for (let p = 2; p <= limit; p += 1) {
    if (sieve[p]) {
      for (let multiple = p * p; multiple <= max; multiple += p) {
        sieve[multiple] = 0;
      }
    }
  }
  postMessage({ type: 'sieve-result', buffer: sieve.buffer }, [sieve.buffer]);
};
