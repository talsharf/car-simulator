import { Vector3 } from '../core/interfaces';

/**
 * Global Constants
 * Convention: Right-Handed Z-Up
 * Forward: +X
 * Left: +Y
 * Up: +Z
 */

export const SIMULATION_RATE = 60; // Hz
export const FIXED_TIMESTEP = 1.0 / SIMULATION_RATE; // seconds

export const GRAVITY: Vector3 = { x: 0, y: 0, z: -9.81 }; // m/s^2

/**
 * Unit conversions
 */
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export const KMH2MS = 1 / 3.6;
export const MS2KMH = 3.6;
