// Homologação no celular (390 px): o mesmo roteiro de test/homologacao.test.mjs.
globalThis.__VP = 'celular';
await import('./homologacao.test.mjs');
