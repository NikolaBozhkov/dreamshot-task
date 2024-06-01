export type VaultCombinationPair = { count: number, direction: 'clockwise' | 'counter-clockwise' };
export type VaultCombination = VaultCombinationPair[];

export function generateVaultCombination(length: number): VaultCombination {
    let combination: VaultCombination = [];
    let lastDirection: VaultCombinationPair['direction'] = Math.random() < 0.5 ? 'clockwise' : 'counter-clockwise';
    for (let i = 0; i < length; i++) {
        combination.push({
            count: 1 + Math.floor(Math.random() * 9),
            direction: lastDirection == 'clockwise' ? 'counter-clockwise' : 'clockwise',
        });

        lastDirection = combination[i].direction;
    }

    return combination;
}
