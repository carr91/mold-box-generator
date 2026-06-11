export interface ModelTransform {
  translationX: number; // mm
  translationY: number; // mm
  translationZ: number; // mm (offset from floor contact)
  rotationX: number; // Pitch (degrees)
  rotationY: number; // Roll (degrees)
  rotationZ: number; // Yaw (degrees)
}

export interface BoxSettings {
  wallHeight: number; // mm
  wallThickness: number; // mm
  floorThickness: number; // mm
  moatWidth: number; // mm
  cornerRadius: number; // mm
}

export interface STLMesh {
  positions: Float32Array;
  normals: Float32Array;
  name: string;
}
