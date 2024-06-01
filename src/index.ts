import '@pixi/math-extras';
import { Application, Sprite, Container, FederatedPointerEvent } from 'pixi.js';

import { loadTextures, textureMap } from './texture';
import { expImpulse, safeSign } from './math-util';

import './index.css';
import { VaultCombination, generateVaultCombination } from './vault-combination';
import { MainScene } from './main.scene';

const HANDLE_TURN_RADIANS = Math.PI / 3;
const VAULT_COMBINATION_LENGTH = 3;

let mainScene: MainScene;

async function main() {
    // Enable live reloading
    new EventSource('/esbuild').addEventListener('change', () => location.reload());

    const app = new Application();

    await app.init({ resizeTo: document.body });

    document.body.appendChild(app.canvas);

    try {
        await loadTextures(textureMap);
    } catch (error) {
        console.error(error);
        return;
    }

    mainScene = new MainScene(app);
    mainScene.init();
}

main();
