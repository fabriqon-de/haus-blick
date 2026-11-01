/** Renderer-independent model contract. No runtime imports or platform globals. */
export interface Point {
    x: number;
    z: number;
}
export interface DrawingWall {
    id: string;
    start: Point;
    end: Point;
    height: number;
    thickness: number;
}
export interface DrawingRoom {
    id: string;
    name: string;
    polygon: Point[];
}
export interface DrawingPlan {
    schemaVersion: 1;
    name: string;
    unit: 'm';
    walls: DrawingWall[];
    rooms: DrawingRoom[];
}
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}
export interface SceneAsset {
    id: string;
    name: string;
    shape: 'box' | 'cylinder' | 'sphere';
    kind?: 'machine' | 'robot' | 'conveyor' | 'controller' | 'server' | 'gateway' | 'sensor' | 'generic';
    position: Vector3;
    size: Vector3;
    color?: number;
}
export interface SceneConnection {
    id: string;
    sourceId: string;
    targetId: string;
}
export interface SceneZone {
    id: string;
    name: string;
    assetIds: string[];
    bounds?: {
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
    };
}
export interface SceneModel {
    schemaVersion: 1;
    name: string;
    assets: SceneAsset[];
    connections: SceneConnection[];
    zones?: SceneZone[];
    drawing?: DrawingPlan;
}
export interface ValidationIssue {
    path: string;
    message: string;
}
export declare class ModelValidationError extends Error {
    readonly issues: readonly ValidationIssue[];
    constructor(path: string, message: string);
}
/** Validate and return a detached copy. Invalid input throws ModelValidationError. */
export declare function parseDrawingPlan(value: unknown): DrawingPlan;
/** Validate and return a detached copy, with finite bounds and checked references. */
export declare function parseSceneModel(value: unknown): SceneModel;
export declare function serializeSceneModel(model: SceneModel): string;
