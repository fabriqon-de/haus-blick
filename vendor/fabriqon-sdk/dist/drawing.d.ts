import { type DrawingPlan } from './model.js';
export interface DxfOptions {
    unit?: 'm' | 'cm' | 'mm';
    name?: string;
    height?: number;
    thickness?: number;
    center?: boolean;
}
export interface DrawingImport {
    plan: DrawingPlan;
    warnings: string[];
}
/** Prepared ASCII DXF: LINE/LWPOLYLINE on WALLS/ROOMS layers; all output distances are metres. */
export declare function importDxf(text: string, options?: DxfOptions): DrawingImport;
