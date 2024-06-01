import '@pixi/math-extras';
import { Application } from 'pixi.js';

import { loadTextures, textureMap } from './texture';
import { MainScene } from './main.scene';

import './index.css';

let mainScene: MainScene;

async function main() {
    if ((window as Window & typeof globalThis & { ENV: string }).ENV === 'dev') {
        // Enable live reloading
        new EventSource('/esbuild').addEventListener('change', () => location.reload());
    }

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

    window.addEventListener('resize', () => {
        mainScene.resize();
    });
}

main();
