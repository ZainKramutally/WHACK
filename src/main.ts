import { bus } from './bus';
import { createApp } from './render/app';

async function boot() {
  const app = await createApp();
  // Exposed for other lanes and for debugging from the console.
  (window as unknown as { app: unknown }).app = app;

  // No selection screen yet: start the carbon world at Earth's defaults so there is something to see.
  bus.emit('world:selected', { worldId: 'carbon', requested: { temperature: 15, nitrogen: 1, oxygen: 21 } });
}

boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f88;position:fixed;top:0;left:0">${String(e)}</pre>`);
});
