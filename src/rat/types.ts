import type { Vec2 } from '../math';
import type { Foot, Gait } from './locomotion';

export type Action = 'idle' | 'walk' | 'scurry' | 'sniff' | 'listen' | 'groom';
export interface Pose extends Vec2 {
  motionTime:number; tempo:number;
  heading: number; speed: number; stride: number; time: number;
  tail: Vec2[]; action: Action; mood: number;
  feet:Foot[]; gait:Gait; gallop:number; activity:number;
  sniff:number; listen:number; groom:number; headYaw:number;
}
