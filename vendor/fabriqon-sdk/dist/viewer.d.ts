import * as THREE from 'three';
import { type SceneAsset, type SceneModel, type DrawingPlan, type SceneConnection, type Vector3 } from './model.js';
export interface ViewerSceneContext {
    readonly scene: THREE.Scene;
    readonly camera: THREE.PerspectiveCamera;
    readonly renderer: THREE.WebGLRenderer;
}
export interface ViewerFrameContext extends ViewerSceneContext {
    /** Seconds of active animation; zero delta while paused. */
    readonly delta: number;
    readonly elapsed: number;
}
export interface ViewerOptions {
    background?: number;
    canvas?: HTMLCanvasElement;
    onSelect?: (id: string | null) => void;
    autoRotate?: boolean;
    /** Limit updates and rendering to 1–60 frames per second. Default: 60. */
    maxFps?: number;
    keyboard?: 'select' | 'camera';
    /** Returned objects and their resources are owned and disposed by this viewer. */
    assetFactory?: (asset: SceneAsset) => THREE.Object3D;
    connectionFactory?: (connection: SceneConnection, source: THREE.Object3D, target: THREE.Object3D) => THREE.Object3D;
    /** Add decoration or configure rendering. Attached scene resources become viewer-owned. */
    configure?: (context: ViewerSceneContext) => void;
    /** Update custom animation and labels before rendering. Must not create another render loop. */
    onFrame?: (context: ViewerFrameContext) => void;
    onContextLost?: () => void;
}
export interface FabriqonViewer {
    setModel(model: SceneModel, options?: {
        fit?: boolean;
    }): void;
    select(id: string | null): void;
    fit(): void;
    setCamera(position: Vector3, target?: Vector3): void;
    setPaused(paused: boolean): void;
    setAutoRotate(enabled: boolean): void;
    dispose(): void;
}
/** @deprecated Use FabriqonViewer. Retained for source compatibility. */
export type PlantFrameViewer = FabriqonViewer;
export declare function createDrawingObject(input: DrawingPlan): THREE.Group;
export declare function createViewer(container: HTMLElement, options?: ViewerOptions): FabriqonViewer;
