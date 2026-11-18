export const BLOCK = 42;
export const MIN = -168;
export const MAX = 168;
export const ROAD = 12;
export const SAVE_KEY = 'solano-streets-v1';
export const MODELS = [
  { name: 'Comet S', width: 1.95, length: 4.4, max: 30, accel: 10, color: [0.76, 0.29, 0.19] },
  { name: 'Mule', width: 2.15, length: 5.1, max: 26, accel: 8, color: [0.27, 0.47, 0.44] },
  { name: 'Falcon GT', width: 2.03, length: 4.55, max: 43, accel: 15, color: [0.96, 0.64, 0.13] },
];
export const JOB = {
  name: 'First Pickup', reward: 750,
  pickup: { x: 0, z: -84, name: 'Mariner Market' },
  delivery: { x: 126, z: 84, name: 'Sunset Pier' },
};
export const PALETTE = {
  sand: [0.84, 0.72, 0.51], road: [0.19, 0.24, 0.25], curb: [0.65, 0.65, 0.55],
  water: [0.12, 0.53, 0.58], trunk: [0.43, 0.32, 0.21],
};
