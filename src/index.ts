import '@pixi/math-extras';
import { Application, Sprite, Assets, Texture, Container, Point, FederatedPointerEvent } from 'pixi.js';

import './index.css';

function mix(a: number, b: number, x: number): number {
    return a * (1 - x) + b * x;
}

function expImpulse(x: number, k: number): number {
    let h = k * x;
    return h * Math.exp(1 - h);
}

function safeSign(x: number): number {
    const sign = Math.sign(x);
    return sign != 0 ? sign : -1;
}

const textureNames = ['bg', 'blink', 'door', 'doorOpen', 'doorOpenShadow', 'handle', 'handleShadow'] as const;
type TextureName = typeof textureNames[number];

const HANDLE_TURN_RADIANS = Math.PI / 3;
const VAULT_COMBINATION_LENGTH = 3;

// All textures loaded
let textureMap: Record<TextureName, Texture> = {} as Record<TextureName, Texture>;

async function loadTextures(cachedTextureMap: Record<TextureName, Texture>) {
    let texturePromises: Promise<Texture>[] = [];
    for (let textureName of textureNames) {
        texturePromises.push(Assets.load<Texture>(`../assets/${textureName}.png`));
    }

    let textures = await Promise.all(texturePromises);

    // Fill texture map
    textureNames.forEach((tn, i) => cachedTextureMap[tn] = textures[i]);
}

type VaultCombinationPair = { count: number, direction: 'clockwise' | 'counter-clockwise' };
type VaultCombination = VaultCombinationPair[];

function generateVaultCombination(length: number): VaultCombination {
    let combination: VaultCombination = [];
    let lastDirection: VaultCombinationPair['direction'] = Math.random() < 0.5 ? 'clockwise' : 'counter-clockwise';
    for (let i = 0; i < length; i++) {
        combination.push({
            count: 1 + Math.floor(Math.random() * 4),
            direction: lastDirection == 'clockwise' ? 'counter-clockwise' : 'clockwise',
        });

        lastDirection = combination[i].direction;
    }

    return combination;
}

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

    let vaultCombination = generateVaultCombination(VAULT_COMBINATION_LENGTH);
    let playerVaultCombination: VaultCombination = [];

    console.log(vaultCombination);

    const backgroundTexture = textureMap['bg'];
    const aspectRatio = backgroundTexture.width / backgroundTexture.height;
    const baseScale = app.renderer.width / backgroundTexture.width;

    const background = new Sprite({
        texture: textureMap['bg'],
        width: app.renderer.width,
        height: app.renderer.width / aspectRatio,
        anchor: { x: 0.5, y: 0.5 },
        position: {
            x: app.renderer.width / 2,
            y: app.renderer.height / 2
        },
    });

    const door = new Sprite({
        texture: textureMap['door'],
        anchor: { x: 0.5, y: 0.5 },
        scale: baseScale,
        position: {
            x: app.renderer.width / 2 + 15,
            y: app.renderer.height / 2 - 12,
        },
    });

    const doorOpen = new Sprite({
        texture: textureMap['doorOpen'],
        anchor: { x: 0.5, y: 0.5 },
        scale: baseScale,
        position: {
            x: app.renderer.width / 2 + textureMap['doorOpen'].width * baseScale + 60,
            y: app.renderer.height / 2 - 7,
        },
        zIndex: 1,
    });

    const doorOpenShadow = new Sprite({
        texture: textureMap['doorOpenShadow'],
        anchor: { x: 0.5, y: 0.5 },
        scale: baseScale,
        position: {
            x: doorOpen.position.x + 20,
            y: doorOpen.position.y + 17,
        },
    });

    const handleGroup = new Container();
    handleGroup.position = { x: app.renderer.width / 2, y: app.renderer.height / 2 };

    const handle = new Sprite({
        texture: textureMap['handle'],
        anchor: { x: 0.5, y: 0.5 },
        width: textureMap['handle'].width * baseScale,
        height: textureMap['handle'].height * baseScale,
        position: { x: -11, y: -15 },
        zIndex: 1,
    });

    const handleShadow = new Sprite({
        texture: textureMap['handleShadow'],
        anchor: { x: 0.5, y: 0.5 },
        width: textureMap['handleShadow'].width * baseScale,
        height: textureMap['handleShadow'].height * baseScale,
        position: {
            x: handle.position.x + 3,
            y: handle.position.y + 10,
        },
    });

    let speed = 0;
    let acceleration = Math.PI * 1.8;
    let targetRotation = 0;
    let prevDirection = 0;
    let didCheckLastCombination = true;
    let targetRotationQueue: number[] = [];
    const handleInput = (event: FederatedPointerEvent) => {
        if (isHandleResetting) return;

        // Target rotation based on click position relative to center width
        const currentDirection = safeSign(event.clientX - app.renderer.width / 2);

        if (prevDirection == currentDirection) {
            playerVaultCombination[playerVaultCombination.length - 1].count += 1;
            didCheckLastCombination = false;

            if (targetRotationQueue.length > 0) {
                targetRotationQueue[targetRotationQueue.length - 1] += currentDirection * HANDLE_TURN_RADIANS;
            } else {
                targetRotation += currentDirection * HANDLE_TURN_RADIANS;
            }
        }

        if (prevDirection != currentDirection && playerVaultCombination.length < VAULT_COMBINATION_LENGTH) {
            playerVaultCombination.push({
                count: 1,
                direction: currentDirection == -1 ? 'counter-clockwise' : 'clockwise'
            });

            prevDirection = currentDirection;

            let newTargetRotation = targetRotation + currentDirection * HANDLE_TURN_RADIANS;
            if (targetRotation != handle.rotation) {
                targetRotationQueue.push(newTargetRotation);
            } else {
                targetRotation = newTargetRotation;
            }
        }
    };

    let isHandleResetting = false;
    let timeSinceHandleReset = 0;
    const resetGame = () => {
        vaultCombination = generateVaultCombination(VAULT_COMBINATION_LENGTH);
        playerVaultCombination = [];
        console.log(vaultCombination);

        isHandleResetting = true;
        timeSinceHandleReset = 0;
        prevDirection = 0;

        app.stage.removeChild(doorOpen);
        app.stage.removeChild(doorOpenShadow);

        if (!handleGroup.parent && !door.parent) {
            app.stage.addChild(door, handleGroup);
        }
    };

    background.interactive = true;
    background.on('pointerdown', handleInput);

    handleGroup.addChild(handle);
    handleGroup.addChild(handleShadow);

    app.stage.addChild(background);
    app.stage.addChild(door);
    app.stage.addChild(handleGroup);

    app.ticker.add((ticker) => {
        if (targetRotation == handle.rotation) {
            if (targetRotationQueue.length > 0) {
                targetRotation = targetRotationQueue.shift()!;
            } else {
                return;
            }
        }

        // Accelerate/deccelerate based on half a turn from target rotation
        let accelDir = Math.sign(Math.abs(handle.rotation - targetRotation) - HANDLE_TURN_RADIANS * 0.5);
        speed += accelDir * acceleration * ticker.deltaMS * 0.001;
        speed = Math.max(Math.PI * 0.2, Math.min(Math.PI * 0.75, speed));

        let rotationDelta = targetRotation - handle.rotation;
        handle.rotation += Math.sign(targetRotation - handle.rotation) * speed * ticker.deltaMS * 0.001;
        let newRotationDelta = targetRotation - handle.rotation;

        if (Math.sign(rotationDelta) != Math.sign(newRotationDelta)) {
            handle.rotation = targetRotation;
        }

        handleShadow.rotation = handle.rotation;
    });

    // Check combination match
    app.ticker.add(() => {
        // Check only if the handle has 'clicked' in place
        // The player can overshoot the correct position by spinning the handle too fast
        if (!didCheckLastCombination && handle.rotation == targetRotation && targetRotationQueue.length == 0) {
            for (let i = 0; i < playerVaultCombination.length; i++) {
                let countCanIncrease = i == playerVaultCombination.length - 1;

                // Combination is wrong if
                // - the count can't increase and it's different that the target pair
                // - the count can increase but it's more than the target
                // - the direction is wrong
                if (!countCanIncrease && playerVaultCombination[i].count != vaultCombination[i].count
                    || countCanIncrease && playerVaultCombination[i].count > vaultCombination[i].count
                    || playerVaultCombination[i].direction != vaultCombination[i].direction) {
                    resetGame();
                    didCheckLastCombination = true;
                    return;
                }
            }

            // Only check count since direction was already checked
            const doesMatchLastPair = playerVaultCombination[playerVaultCombination.length - 1].count == vaultCombination[vaultCombination.length - 1].count;
            if (playerVaultCombination.length == vaultCombination.length && doesMatchLastPair) {
                app.stage.removeChild(door);
                app.stage.removeChild(handleGroup);
                app.stage.addChild(doorOpen);
                app.stage.addChild(doorOpenShadow);
                setTimeout(resetGame, 5000);
            }

            didCheckLastCombination = true;
        }
    });

    // Handle reset spin
    app.ticker.add((ticker) => {
        if (!isHandleResetting) return;

        timeSinceHandleReset += ticker.deltaMS * 0.001;
        let f = expImpulse(timeSinceHandleReset, 3);
        let rotSpeed = f * Math.PI * 10;
        let minSpeed = Math.PI * 0.2;
        let nextSnapRotation = HANDLE_TURN_RADIANS * (Math.floor(handle.rotation / HANDLE_TURN_RADIANS) + 1);

        rotSpeed = Math.max(rotSpeed, minSpeed);
        handle.rotation += ticker.deltaMS * 0.001 * rotSpeed;
        handleShadow.rotation = handle.rotation;
        targetRotation = handle.rotation;

        if (rotSpeed == minSpeed) {
            let postUpdateNextSnapRotation = HANDLE_TURN_RADIANS * (Math.floor(handle.rotation / HANDLE_TURN_RADIANS) + 1);

            // Rotation finished
            if (nextSnapRotation != postUpdateNextSnapRotation) {
                isHandleResetting = false;
                handle.rotation = nextSnapRotation;
                handleShadow.rotation = nextSnapRotation;
                targetRotation = nextSnapRotation;
            }
        }
    });
}

main();
