export function expImpulse(x: number, k: number): number {
    let h = k * x;
    return h * Math.exp(1 - h);
}

export function safeSign(x: number): number {
    const sign = Math.sign(x);
    return sign != 0 ? sign : -1;
}
