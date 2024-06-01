import { Application, FederatedPointerEvent, LinearDodgeBlend, Sprite, Ticker } from 'pixi.js';

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
    private shineParticle: Sprite[];

    private prevDirection = 0;
    private didCheckLastCombination = true;

    private sceneTime: number = 0;

    constructor(private readonly app: Application) {
        console.log(this.vaultCombination);

        const backgroundTexture = textureMap['bg'];
        this.aspectRatio = backgroundTexture.width / backgroundTexture.height;
        this.baseScale = app.renderer.width / backgroundTexture.width;

        this.background = new Sprite({
            texture: textureMap['bg'],
            width: this.app.renderer.width,
            height: this.app.renderer.width / this.aspectRatio,
            anchor: { x: 0.5, y: 0.5 },
            position: {
                x: this.app.renderer.width / 2,
                y: this.app.renderer.height / 2
            },
        });

        this.door = new Sprite({
            texture: textureMap['door'],
            anchor: { x: 0.5, y: 0.5 },
            scale: this.baseScale,
            position: {
                x: this.app.renderer.width / 2 + 15,
                y: this.app.renderer.height / 2 - 12,
            },
        });

        this.doorOpen = new Sprite({
            texture: textureMap['doorOpen'],
            anchor: { x: 0.5, y: 0.5 },
            scale: this.baseScale,
            position: {
                x: this.app.renderer.width / 2 + textureMap['doorOpen'].width * this.baseScale + 60,
                y: this.app.renderer.height / 2 - 7,
            },
            zIndex: 1,
        });

        this.doorOpenShadow = new Sprite({
            texture: textureMap['doorOpenShadow'],
            anchor: { x: 0.5, y: 0.5 },
            scale: this.baseScale,
            position: {
                x: this.doorOpen.position.x + 20,
                y: this.doorOpen.position.y + 17,
            },
        });

        this.handle = new Handle(this.baseScale);
        this.handle.position = {
            x: this.app.renderer.width / 2,
            y: this.app.renderer.height / 2,
        }

        this.shineParticle = [];
        for (let i = 0; i < 3; i++) {
            this.shineParticle.push(new Sprite({
                texture: textureMap['blink'],
                anchor: { x: 0.5, y: 0.5 },
                scale: this.baseScale,
                rotation: Math.random() * Math.PI * 2,
            }));
        }

        this.shineParticle[0].position = {
            x: app.renderer.width / 2 - 150,
            y: app.renderer.height / 2,
        };

        this.shineParticle[1].position = {
            x: app.renderer.width / 2 - 25,
            y: app.renderer.height / 2 - 10,
        };

        this.shineParticle[2].position = {
            x: app.renderer.width / 2 + 45,
            y: app.renderer.height / 2 + 95,
        };
    }

    init() {
        this.background.interactive = true;
        this.background.on('pointerdown', this.handleInput.bind(this));

        this.app.stage.addChild(this.background);
        this.app.stage.addChild(this.door);
        this.app.stage.addChild(this.handle);

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
        console.log(this.vaultCombination);

        this.handle.reset();

        this.prevDirection = 0;

        this.app.stage.removeChild(this.doorOpen);
        this.app.stage.removeChild(this.doorOpenShadow);
        this.app.stage.removeChild(...this.shineParticle);

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
        this.app.stage.addChild(...this.shineParticle);

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
                this.openVault();
            }

            this.didCheckLastCombination = true;
        }
    }

    private updateSceneTime(ticker: Ticker) {
        this.sceneTime += ticker.deltaTime;
    }

    private updateShineParticles(ticker: Ticker) {
        for (let shineParticle of this.shineParticle) {
            let deltaTimeSeconds = ticker.deltaMS * 0.001;
            shineParticle.rotation += deltaTimeSeconds * Math.PI * 0.25;
            let particleTimeOffset = shineParticle.position.x + shineParticle.position.y;
            shineParticle.alpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(this.sceneTime * 0.001 * Math.PI * 13 + particleTimeOffset));
        }
    }
}
