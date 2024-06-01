# DreamShot Task

## Running
Run `npm start` to build and run the project. Available on `localhost:8000`.
Aternatively `npm run dev` for watch mode or `npm run build` for bundle only.

## Design choices
I opted out of using GSAP for animations, because as good as it is for tweening, handmade keyframes and simple timing functions, it would be a hinderance for the animations I was going for.

- The handle interaction is not blocked by input and spins freely with rotational speed and acceleration. This way the animation is very easily tweaked and allows for a smooth 'click' at the end of the motion, which imo gives more weight. **It also ties with the gameplay, since the player can miss the right combination if the handle hasn't stopped in place.**
- The reset spin of the handle is also using a loosely timed animation. It is based on an exponential impulse, which snaps to the closest rotation step when at min speed. This approach allows for describing the motion more freely, removing the need to fit rotations in time, while *allowing precise control of how fast or how long we want it to run.*
- For the particles I used a simple `sin` based flicker. Again moving the controls away from specific durations.

## Controls
- Click on either side of the screeen to rotate the handle.
- Rotations are non-blocking, meaning they can stack and the combination will be checked when all pending rotations are over.
