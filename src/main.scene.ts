import { Application, Container, FederatedPointerEvent, Sprite, Ticker } from 'pixi.js';
import { VaultCombination, generateVaultCombination } from './vault-combination';
import { textureMap } from './texture';
import { expImpulse, safeSign } from './math-util';

const HANDLE_TURN_RADIANS = Math.PI / 3;
const VAULT_COMBINATION_LENGTH = 3;

export class MainScene {

    vaultCombination = generateVaultCombination(VAULT_COMBINATION_LENGTH);
    playerVaultCombination: VaultCombination = [];

    private aspectRatio: number;
    private baseScale: number;

    private background: Sprite;
    private door: Sprite;
    private doorOpen: Sprite;
    private doorOpenShadow: Sprite;
    private handleGroup: Container;
    private handle: Sprite;
    private handleShadow: Sprite;

    private speed = 0;
    private acceleration = Math.PI * 1.8;
    private targetRotation = 0;
    private prevDirection = 0;
    private didCheckLastCombination = true;
    private targetRotationQueue: number[] = [];

    private isHandleResetting = false;
    private timeSinceHandleReset = 0;

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

        this.handleGroup = new Container({
            position: {
                x: this.app.renderer.width / 2,
                y: this.app.renderer.height / 2,
            },
        });

        this.handle = new Sprite({
            texture: textureMap['handle'],
            anchor: { x: 0.5, y: 0.5 },
            width: textureMap['handle'].width * this.baseScale,
            height: textureMap['handle'].height * this.baseScale,
            position: { x: -11, y: -15 },
            zIndex: 1,
        });

        this.handleShadow = new Sprite({
            texture: textureMap['handleShadow'],
            anchor: { x: 0.5, y: 0.5 },
            width: textureMap['handleShadow'].width * this.baseScale,
            height: textureMap['handleShadow'].height * this.baseScale,
            position: {
                x: this.handle.position.x + 3,
                y: this.handle.position.y + 10,
            },
        });
    }

    init() {
        this.background.interactive = true;
        this.background.on('pointerdown', this.handleInput.bind(this));

        this.handleGroup.addChild(this.handle);
        this.handleGroup.addChild(this.handleShadow);

        this.app.stage.addChild(this.background);
        this.app.stage.addChild(this.door);
        this.app.stage.addChild(this.handleGroup);

        this.app.ticker.add(this.updateHandleRotation.bind(this));
        this.app.ticker.add(this.checkCombinationMatch.bind(this));
        this.app.ticker.add(this.updateResetHandleRotation.bind(this));
    }

    destroy() {
        this.background.removeAllListeners();
        this.app.stage.removeChildren();
        this.app.ticker.remove(this.updateHandleRotation.bind(this));
        this.app.ticker.remove(this.checkCombinationMatch.bind(this));
        this.app.ticker.remove(this.updateResetHandleRotation.bind(this));
    }

    private handleInput(event: FederatedPointerEvent) {
        if (this.isHandleResetting) return;

        // Target rotation based on click position relative to center width
        const currentDirection = safeSign(event.clientX - this.app.renderer.width / 2);

        if (this.prevDirection == currentDirection) {
            this.playerVaultCombination[this.playerVaultCombination.length - 1].count += 1;
            this.didCheckLastCombination = false;

            if (this.targetRotationQueue.length > 0) {
                this.targetRotationQueue[this.targetRotationQueue.length - 1] += currentDirection * HANDLE_TURN_RADIANS;
            } else {
                this.targetRotation += currentDirection * HANDLE_TURN_RADIANS;
            }
        }

        if (this.prevDirection != currentDirection && this.playerVaultCombination.length < VAULT_COMBINATION_LENGTH) {
            this.playerVaultCombination.push({
                count: 1,
                direction: currentDirection == -1 ? 'counter-clockwise' : 'clockwise'
            });

            this.prevDirection = currentDirection;
            this.didCheckLastCombination = false;

            let newTargetRotation = this.targetRotation + currentDirection * HANDLE_TURN_RADIANS;
            if (this.targetRotation != this.handle.rotation) {
                this.targetRotationQueue.push(newTargetRotation);
            } else {
                this.targetRotation = newTargetRotation;
            }
        }
    };

    private resetGame() {
        this.vaultCombination = generateVaultCombination(VAULT_COMBINATION_LENGTH);
        this.playerVaultCombination = [];
        console.log(this.vaultCombination);

        this.isHandleResetting = true;
        this.timeSinceHandleReset = 0;
        this.prevDirection = 0;

        this.app.stage.removeChild(this.doorOpen);
        this.app.stage.removeChild(this.doorOpenShadow);

        if (!this.handleGroup.parent && !this.door.parent) {
            this.app.stage.addChild(this.door, this.handleGroup);
        }
    };

    private updateHandleRotation(ticker: Ticker) {
        if (this.targetRotation == this.handle.rotation) {
            if (this.targetRotationQueue.length > 0) {
                this.targetRotation = this.targetRotationQueue.shift()!;
            } else {
                return;
            }
        }

        // Accelerate/deccelerate based on half a turn from target rotation
        let accelDir = Math.sign(Math.abs(this.handle.rotation - this.targetRotation) - HANDLE_TURN_RADIANS * 0.5);
        this.speed += accelDir * this.acceleration * ticker.deltaMS * 0.001;
        this.speed = Math.max(Math.PI * 0.2, Math.min(Math.PI * 0.75, this.speed));

        let rotationDelta = this.targetRotation - this.handle.rotation;
        this.handle.rotation += Math.sign(this.targetRotation - this.handle.rotation) * this.speed * ticker.deltaMS * 0.001;
        let newRotationDelta = this.targetRotation - this.handle.rotation;

        if (Math.sign(rotationDelta) != Math.sign(newRotationDelta)) {
            this.handle.rotation = this.targetRotation;
        }

        this.handleShadow.rotation = this.handle.rotation;
    }

    private checkCombinationMatch() {
        // Check only if the handle has 'clicked' in place
        // The player can overshoot the correct position by spinning the handle too fast
        if (!this.didCheckLastCombination
            && this.handle.rotation == this.targetRotation
            && this.targetRotationQueue.length == 0) {
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
                this.app.stage.removeChild(this.door);
                this.app.stage.removeChild(this.handleGroup);
                this.app.stage.addChild(this.doorOpen);
                this.app.stage.addChild(this.doorOpenShadow);
                setTimeout(this.resetGame.bind(this), 5000);
            }

            this.didCheckLastCombination = true;
        }
    }

    private updateResetHandleRotation(ticker: Ticker) {
        if (!this.isHandleResetting) return;

        this.timeSinceHandleReset += ticker.deltaMS * 0.001;
        let f = expImpulse(this.timeSinceHandleReset, 3);
        let rotSpeed = f * Math.PI * 10;
        let minSpeed = Math.PI * 0.2;
        let nextSnapRotation = HANDLE_TURN_RADIANS * (Math.floor(this.handle.rotation / HANDLE_TURN_RADIANS) + 1);

        rotSpeed = Math.max(rotSpeed, minSpeed);
        this.handle.rotation += ticker.deltaMS * 0.001 * rotSpeed;
        this.handleShadow.rotation = this.handle.rotation;
        this.targetRotation = this.handle.rotation;

        if (rotSpeed == minSpeed) {
            let postUpdateNextSnapRotation = HANDLE_TURN_RADIANS * (Math.floor(this.handle.rotation / HANDLE_TURN_RADIANS) + 1);

            // Rotation finished
            if (nextSnapRotation != postUpdateNextSnapRotation) {
                this.isHandleResetting = false;
                this.handle.rotation = nextSnapRotation;
                this.handleShadow.rotation = nextSnapRotation;
                this.targetRotation = nextSnapRotation;
            }
        }
    }
}
