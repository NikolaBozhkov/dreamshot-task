import { Application, FederatedPointerEvent, LinearDodgeBlend, Sprite, Text, Ticker } from 'pixi.js';

import { VaultCombination, generateVaultCombination } from './vault-combination';
import { textureMap } from './texture';
import { safeSign } from './math-util';
import { Handle } from './handle';

const VAULT_COMBINATION_LENGTH = 3;

export class MainScene {

    vaultCombination = generateVaultCombination(VAULT_COMBINATION_LENGTH);
    playerVaultCombination: VaultCombination = [];

    private aspectRatio: number;
    private baseScale: number;

    private background: Sprite;
    private door: Sprite;
    private handle: Handle;
    private doorOpen: Sprite;
    private doorOpenShadow: Sprite;
    private shineParticles: Sprite[];

    private prevDirection = 0;
    private didCheckLastCombination = true;
    private didWin = false;

    private sceneTime: number = 0;

    private timerText: Text;
    private _playerTime = 0;

    private get playerTime() {
        return this._playerTime;
    }

    private set playerTime(time: number) {
        this._playerTime = time;
        this.timerText.text = (this.playerTime * 0.001).toFixed(1);
    }

    constructor(private readonly app: Application) {
        console.log(this.vaultCombination);

        const backgroundTexture = textureMap['bg'];
        this.aspectRatio = backgroundTexture.width / backgroundTexture.height;
        this.baseScale = app.renderer.width / backgroundTexture.width;

        console.log(this.baseScale);

        this.background = new Sprite({
            texture: textureMap['bg'],
            anchor: { x: 0.5, y: 0.5 },
        });

        this.door = new Sprite({
            texture: textureMap['door'],
            anchor: { x: 0.5, y: 0.5 },
        });

        this.doorOpen = new Sprite({
            texture: textureMap['doorOpen'],
            anchor: { x: 0.5, y: 0.5 },
            zIndex: 1,
        });

        this.doorOpenShadow = new Sprite({
            texture: textureMap['doorOpenShadow'],
            anchor: { x: 0.5, y: 0.5 },
        });

        this.handle = new Handle(this.baseScale);

        this.shineParticles = [];
        for (let i = 0; i < 3; i++) {
            this.shineParticles.push(new Sprite({
                texture: textureMap['blink'],
                anchor: { x: 0.5, y: 0.5 },
                rotation: Math.random() * Math.PI * 2,
            }));
        }

        this.timerText = new Text({
            text: '0.0',
            style: {
                fontFamily: 'monospace',
                fill: '0xfcfdfa',
                align: 'right',
            },
        });

        this.resize();
    }

    resize() {
        const backgroundTexture = textureMap['bg'];
        this.aspectRatio = backgroundTexture.width / backgroundTexture.height;
        this.baseScale = this.app.renderer.width / backgroundTexture.width;

        const rendererAspectRatio = this.app.renderer.width / this.app.renderer.height;
        this.background.width = this.app.renderer.width;
        this.background.height = this.app.renderer.width / this.aspectRatio;

        // If width needs to be padded
        if (rendererAspectRatio > this.aspectRatio) {
            this.background.height = this.app.renderer.height;
            this.background.width = this.app.renderer.height * this.aspectRatio;
            this.baseScale = this.background.width / backgroundTexture.width;
        }

        this.background.position = {
            x: this.app.renderer.width / 2,
            y: this.app.renderer.height / 2,
        };

        this.door.scale = this.baseScale,
        this.door.position = {
            x: this.app.renderer.width / 2 + 54 * this.baseScale,
            y: this.app.renderer.height / 2 - 43 * this.baseScale,
        };

        this.doorOpen.scale = this.baseScale;
        this.doorOpen.position = {
            x: this.app.renderer.width / 2 + (textureMap['doorOpen'].width + 214) * this.baseScale,
            y: this.app.renderer.height / 2 - 25 * this.baseScale,
        };

        this.doorOpenShadow.scale = this.baseScale;
        this.doorOpenShadow.position = {
            x: this.doorOpen.position.x + 71.4 * this.baseScale,
            y: this.doorOpen.position.y + 60.7 * this.baseScale,
        };

        this.handle.resize(this.baseScale);
        this.handle.position = {
            x: this.app.renderer.width / 2,
            y: this.app.renderer.height / 2,
        }

        for (let shineParticle of this.shineParticles) {
            shineParticle.scale = this.baseScale;
        }

        this.shineParticles[0].position = {
            x: this.app.renderer.width / 2 - 536 * this.baseScale,
            y: this.app.renderer.height / 2,
        };

        this.shineParticles[1].position = {
            x: this.app.renderer.width / 2 - 89 * this.baseScale,
            y: this.app.renderer.height / 2 - 35.7 * this.baseScale,
        };

        this.shineParticles[2].position = {
            x: this.app.renderer.width / 2 + 160.7 * this.baseScale,
            y: this.app.renderer.height / 2 + 339 * this.baseScale,
        };

        this.timerText.style.fontSize = 64 * this.baseScale;
        this.timerText.position = {
            x: this.app.renderer.width / 2 - 1218 * this.baseScale,
            y: this.app.renderer.height / 2 - 185.7 * this.baseScale,
        };
    }

    init() {
        this.background.interactive = true;
        this.background.on('pointerdown', this.handleInput.bind(this));

        this.app.stage.addChild(this.background);
        this.app.stage.addChild(this.door);
        this.app.stage.addChild(this.handle);
        this.app.stage.addChild(this.timerText);

        this.app.ticker.add(this.updateSceneTime.bind(this));

        this.app.ticker.add(this.handle.updateRotation.bind(this.handle));
        this.app.ticker.add(this.checkCombinationMatch.bind(this));
        this.app.ticker.add(this.handle.updateResetRotation.bind(this.handle));
    }

    destroy() {
        this.background.removeAllListeners();
        this.app.stage.removeChildren();
        this.app.ticker.remove(this.handle.updateRotation.bind(this.handle));
        this.app.ticker.remove(this.checkCombinationMatch.bind(this));
        this.app.ticker.remove(this.handle.updateResetRotation.bind(this.handle));
    }

    private handleInput(event: FederatedPointerEvent) {
        if (this.handle.isResetting) return;

        // Target rotation based on click position relative to center width
        const currentDirection = safeSign(event.clientX - this.app.renderer.width / 2);

        if (this.prevDirection == currentDirection) {
            this.playerVaultCombination[this.playerVaultCombination.length - 1].count += 1;
            this.didCheckLastCombination = false;

            this.handle.addRotation(currentDirection);
        }

        if (this.prevDirection != currentDirection && this.playerVaultCombination.length < VAULT_COMBINATION_LENGTH) {
            this.playerVaultCombination.push({
                count: 1,
                direction: currentDirection == -1 ? 'counter-clockwise' : 'clockwise'
            });

            this.prevDirection = currentDirection;
            this.didCheckLastCombination = false;

            this.handle.setNewRotation(currentDirection);
        }
    };

    private resetGame() {
        this.vaultCombination = generateVaultCombination(VAULT_COMBINATION_LENGTH);
        this.playerVaultCombination = [];
        this.playerTime = 0;
        console.log(this.vaultCombination);

        this.handle.reset();

        this.prevDirection = 0;

        this.app.stage.removeChild(this.doorOpen);
        this.app.stage.removeChild(this.doorOpenShadow);
        this.app.stage.removeChild(...this.shineParticles);

        this.app.ticker.remove(this.updateShineParticles.bind(this));

        if (!this.handle.parent && !this.door.parent) {
            this.app.stage.addChild(this.door, this.handle);
        }
    }

    private openVault() {
        this.app.stage.removeChild(this.door);
        this.app.stage.removeChild(this.handle);

        this.app.stage.addChild(this.doorOpen);
        this.app.stage.addChild(this.doorOpenShadow);
        this.app.stage.addChild(...this.shineParticles);

        this.app.ticker.add(this.updateShineParticles.bind(this));

        setTimeout(this.resetGame.bind(this), 5000);
    }

    private checkCombinationMatch() {
        // Check only if the handle has 'clicked' in place
        // The player can overshoot the correct position by spinning the handle too fast
        if (!this.didCheckLastCombination
            && this.handle.handleRotation == this.handle.targetRotation
            && this.handle.targetRotationQueue.length == 0) {
            for (let i = 0; i < this.playerVaultCombination.length; i++) {
                let countCanIncrease = i == this.playerVaultCombination.length - 1;

                // Combination is wrong if
                // - the count can't increase and it's different that the target pair
                // - the count can increase but it's more than the target
                // - the direction is wrong
                if (!countCanIncrease && this.playerVaultCombination[i].count != this.vaultCombination[i].count
                    || countCanIncrease && this.playerVaultCombination[i].count > this.vaultCombination[i].count
                    || this.playerVaultCombination[i].direction != this.vaultCombination[i].direction) {
                    this.resetGame();
                    this.didCheckLastCombination = true;
                    return;
                }
            }

            // Only check count since direction was already checked
            const doesMatchLastPair = this.playerVaultCombination[this.playerVaultCombination.length - 1].count
                == this.vaultCombination[this.vaultCombination.length - 1].count;
            if (this.playerVaultCombination.length == this.vaultCombination.length && doesMatchLastPair) {
                this.didWin = true;
                this.openVault();
            }

            this.didCheckLastCombination = true;
        }
    }

    private updateSceneTime(ticker: Ticker) {
        this.sceneTime += ticker.deltaMS;

        if (this.playerVaultCombination.length > 0 && !this.didWin) {
            this.playerTime += ticker.deltaMS;
        }
    }

    private updateShineParticles(ticker: Ticker) {
        for (let shineParticle of this.shineParticles) {
            let deltaTimeSeconds = ticker.deltaMS * 0.001;
            shineParticle.rotation += deltaTimeSeconds * Math.PI * 0.25;
            let particleTimeOffset = shineParticle.position.x + shineParticle.position.y;
            shineParticle.alpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(this.sceneTime * 0.001 * Math.PI * 1.3 + particleTimeOffset));
        }
    }
}
