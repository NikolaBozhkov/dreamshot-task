import { Assets, Texture } from 'pixi.js';

const textureNames = ['bg', 'blink', 'door', 'doorOpen', 'doorOpenShadow', 'handle', 'handleShadow'] as const;
export type TextureName = typeof textureNames[number];

// All textures loaded
export let textureMap: Record<TextureName, Texture> = {} as Record<TextureName, Texture>;

export async function loadTextures(cachedTextureMap: Record<TextureName, Texture>) {
    let texturePromises: Promise<Texture>[] = [];
    for (let textureName of textureNames) {
        texturePromises.push(Assets.load<Texture>(`../assets/${textureName}.png`));
    }

    let textures = await Promise.all(texturePromises);

    // Fill texture map
    textureNames.forEach((tn, i) => cachedTextureMap[tn] = textures[i]);
}
