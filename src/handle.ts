import { Container, Sprite, Ticker } from 'pixi.js';
import { textureMap } from './texture';
import { expImpulse } from './math-util';

const HANDLE_TURN_RADIANS = Math.PI / 3;

export class Handle extends Container {

    private handle: Sprite;
    private handleShadow: Sprite;

    private speed = 0;
    private acceleration = Math.PI * 1.8;

    targetRotation = 0;
    targetRotationQueue: number[] = [];

    isResetting = false;
    private timeSinceReset = 0;

    get handleRotation(): number {
        return this.handle.rotation;
    }

    constructor(baseScale: number) {
        super();

        this.handle = new Sprite({
            texture: textureMap['handle'],
            anchor: { x: 0.5, y: 0.5 },
            zIndex: 1,
        });

        this.handleShadow = new Sprite({
            texture: textureMap['handleShadow'],
            anchor: { x: 0.5, y: 0.5 },
        });

        this.addChild(this.handle);
        this.addChild(this.handleShadow);

        this.resize(baseScale);
    }

    addRotation(direction: number) {
        if (this.targetRotationQueue.length > 0) {
            this.targetRotationQueue[this.targetRotationQueue.length - 1] += direction * HANDLE_TURN_RADIANS;
        } else {
            this.targetRotation += direction * HANDLE_TURN_RADIANS;
        }
    }

    setNewRotation(direction: number) {
        let newTargetRotation = this.targetRotation + direction * HANDLE_TURN_RADIANS;
        if (this.targetRotation != this.handle.rotation) {
            this.targetRotationQueue.push(newTargetRotation);
        } else {
            this.targetRotation = newTargetRotation;
        }
    }

    reset() {
        this.isResetting = true;
        this.timeSinceReset = 0;
    }

    updateRotation(ticker: Ticker) {
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

    updateResetRotation(ticker: Ticker) {
        if (!this.isResetting) return;

        this.timeSinceReset += ticker.deltaMS * 0.001;
        let f = expImpulse(this.timeSinceReset, 3);
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
                this.isResetting = false;
                this.handle.rotation = nextSnapRotation;
                this.handleShadow.rotation = nextSnapRotation;
                this.targetRotation = nextSnapRotation;
            }
        }
    }

    resize(baseScale: number) {
        this.handle.width = textureMap['handle'].width * baseScale;
        this.handle.height = textureMap['handle'].height * baseScale;
        this.handle.position = {
            x: -39 * baseScale,
            y: -53.6 * baseScale,
        };

        this.handleShadow.width = textureMap['handleShadow'].width * baseScale;
        this.handleShadow.height = textureMap['handleShadow'].height * baseScale;
        this.handleShadow.position = {
            x: this.handle.position.x + 10.7 * baseScale,
            y: this.handle.position.y + 35.7 * baseScale,
        };
    }
}
