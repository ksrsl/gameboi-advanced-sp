const cartridges=new Map();
export function registerCartridge(manifest){
  if(!manifest?.id||typeof manifest.create!=='function')throw new Error('Invalid cartridge manifest');
  cartridges.set(manifest.id,manifest);
}
export function listCartridges(){return [...cartridges.values()].map(({create,...info})=>info)}
export async function loadCartridge(id,host,services){
  const cartridge=cartridges.get(id);
  if(!cartridge)throw new Error(`Cartridge "${id}" was not found.`);
  host.replaceChildren();
  const game=cartridge.create();
  await game.mount(host,services);
  return game;
}
