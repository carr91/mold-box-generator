import * as THREE from 'three';
import { ModelTransform, BoxSettings, STLMesh } from '../types';

// Analytical 3D rotation around origin (Pitch -> Roll -> Yaw)
export function rotateXYZ(
  x: number,
  y: number,
  z: number,
  ax: number, // pitch (rad)
  ay: number, // roll (rad)
  az: number  // yaw (rad)
): [number, number, number] {
  const cx = Math.cos(ax), sx = Math.sin(ax);
  const cy = Math.cos(ay), sy = Math.sin(ay);
  const cz = Math.cos(az), sz = Math.sin(az);

  // Rotate X (mesh Pitch)
  let x1 = x;
  let y1 = y * cx - z * sx;
  let z1 = y * sx + z * cx;

  // Rotate Y (mesh Roll)
  let x2 = x1 * cy + z1 * sy;
  let y2 = y1;
  let z2 = -x1 * sy + z1 * cy;

  // Rotate Z (mesh Yaw)
  let x3 = x2 * cz - y2 * sz;
  let y3 = x2 * sz + y2 * cz;
  let z3 = z2;

  return [x3, y3, z3];
}

// STL Parser
export function parseSTL(buffer: ArrayBuffer, name = 'imported.stl'): STLMesh {
  const view = new DataView(buffer);

  // Determine if binary or ASCII
  let isBinary = false;
  if (buffer.byteLength > 84) {
    const numFaces = view.getUint32(80, true);
    const expectedSize = 80 + 4 + numFaces * 50;
    if (expectedSize === buffer.byteLength) {
      isBinary = true;
    }
  }

  if (!isBinary) {
    const textHeader = new TextDecoder().decode(buffer.slice(0, 80));
    // Check for "solid" keyword at start, and check that it's text
    if (textHeader.trim().toLowerCase().startsWith('solid')) {
      // It is highly likely ASCII
    } else {
      isBinary = true;
    }
  }

  if (isBinary) {
    return parseBinarySTL(buffer, name);
  } else {
    return parseAsciiSTL(buffer, name);
  }
}

function parseBinarySTL(buffer: ArrayBuffer, name: string): STLMesh {
  const view = new DataView(buffer);
  const numFaces = view.getUint32(80, true);

  const positions = new Float32Array(numFaces * 9);
  const normals = new Float32Array(numFaces * 9);

  let offset = 84;
  for (let i = 0; i < numFaces; i++) {
    if (offset + 50 > buffer.byteLength) break;

    // Normal
    const nx = view.getFloat32(offset, true);
    const ny = view.getFloat32(offset + 4, true);
    const nz = view.getFloat32(offset + 8, true);
    offset += 12;

    // 3 Vertices
    for (let v = 0; v < 3; v++) {
      const idx = i * 9 + v * 3;
      positions[idx] = view.getFloat32(offset, true);
      positions[idx + 1] = view.getFloat32(offset + 4, true);
      positions[idx + 2] = view.getFloat32(offset + 8, true);
      offset += 12;

      normals[idx] = nx;
      normals[idx + 1] = ny;
      normals[idx + 2] = nz;
    }

    // Attribute byte count
    offset += 2;
  }

  return { positions, normals, name };
}

function parseAsciiSTL(buffer: ArrayBuffer, name: string): STLMesh {
  const text = new TextDecoder().decode(buffer);
  const lines = text.split('\n');

  const positions: number[] = [];
  const normals: number[] = [];

  let nx = 0, ny = 0, nz = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.startsWith('facet normal')) {
      const parts = line.split(/\s+/);
      nx = parseFloat(parts[2]) || 0;
      ny = parseFloat(parts[3]) || 0;
      nz = parseFloat(parts[4]) || 0;
    } else if (lowerLine.startsWith('vertex')) {
      const parts = line.split(/\s+/);
      const vx = parseFloat(parts[1]) || 0;
      const vy = parseFloat(parts[2]) || 0;
      const vz = parseFloat(parts[3]) || 0;
      positions.push(vx, vy, vz);
      normals.push(nx, ny, nz);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    name,
  };
}

// Procedural Default Model (a beautiful, highly detailed 5-point tapered Star Vase)
export function generateDefaultStar(): STLMesh {
  const positions: number[] = [];
  const normals: number[] = [];

  const pointsCount = 5;
  const rOuterMin = 14;      // outer base radius (mm)
  const rInnerMin = 6;       // inner base radius (mm)
  const rOuterMax = 12;      // outer top radius (tapered for draft angle!)
  const rInnerMax = 5;       // inner top radius (tapered)
  const height = 18;          // height of star (mm)

  // 10 base vertices (Z = 0) and 10 top vertices (Z = height)
  const baseOuter: [number, number][] = [];
  const baseInner: [number, number][] = [];
  const topOuter: [number, number][] = [];
  const topInner: [number, number][] = [];

  for (let i = 0; i < pointsCount; i++) {
    // Outer points
    const angleOuter = (i * 2 * Math.PI) / pointsCount - Math.PI / 2;
    baseOuter.push([Math.cos(angleOuter) * rOuterMin, Math.sin(angleOuter) * rOuterMin]);
    topOuter.push([Math.cos(angleOuter) * rOuterMax, Math.sin(angleOuter) * rOuterMax]);

    // Inner points (offset by half a step)
    const angleInner = ((i + 0.5) * 2 * Math.PI) / pointsCount - Math.PI / 2;
    baseInner.push([Math.cos(angleInner) * rInnerMin, Math.sin(angleInner) * rInnerMin]);
    topInner.push([Math.cos(angleInner) * rInnerMax, Math.sin(angleInner) * rInnerMax]);
  }

  // Interleave base and top vertices to form the loops
  const baseLoop: [number, number, number][] = [];
  const topLoop: [number, number, number][] = [];

  for (let i = 0; i < pointsCount; i++) {
    baseLoop.push([baseOuter[i][0], baseOuter[i][1], 0]);
    baseLoop.push([baseInner[i][0], baseInner[i][1], 0]);

    topLoop.push([topOuter[i][0], topOuter[i][1], height]);
    topLoop.push([topInner[i][0], topInner[i][1], height]);
  }

  const N = baseLoop.length; // 10 vertices

  // Helper to add triangles with auto-normals
  const pushTriangle = (p1: [number, number, number], p2: [number, number, number], p3: [number, number, number]) => {
    const ux = p2[0] - p1[0], uy = p2[1] - p1[1], uz = p2[2] - p1[2];
    const vx = p3[0] - p1[0], vy = p3[1] - p1[1], vz = p3[2] - p1[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    const n = len > 0 ? [nx / len, ny / len, nz / len] : [0, 0, 1];

    positions.push(...p1, ...p2, ...p3);
    normals.push(...n, ...n, ...n);
  };

  // 1. Bottom flat face of star: triangulate with a center point at (0, 0, 0)
  // Since we want Z- normal, bottom face loop winding clockwise looking from bottom
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    pushTriangle([0, 0, 0], baseLoop[next], baseLoop[i]);
  }

  // 2. Top flat face of star: tapered pointing pyramid (looks incredible!)
  // Or a flat star with top center at (0,0,height)
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    // We add top center peak at height + 3 for an aesthetic spire!
    pushTriangle([0, 0, height + 4], topLoop[i], topLoop[next]);
  }

  // 3. Side Walls: loft between baseLoop and topLoop
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    const bCurrent = baseLoop[i];
    const bNext = baseLoop[next];
    const tCurrent = topLoop[i];
    const tNext = topLoop[next];

    // Triangle 1
    pushTriangle(bCurrent, bNext, tNext);
    // Triangle 2
    pushTriangle(bCurrent, tNext, tCurrent);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    name: 'pristine_star.stl',
  };
}

// 2D Rounded Rectangle path helper (guarantees exactly 4 * numSegments points for matching lofts)
export function getRoundedRectPoints(w: number, d: number, r: number, numSegments = 16): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  const halfW = w / 2;
  const halfD = d / 2;
  const clampedR = Math.max(0, Math.min(r, halfW, halfD));

  // Top-right corner (0 to PI/2)
  const trCenterX = halfW - clampedR;
  const trCenterY = halfD - clampedR;
  for (let i = 0; i < numSegments; i++) {
    const angle = (i / numSegments) * (Math.PI / 2);
    points.push(new THREE.Vector2(trCenterX + Math.cos(angle) * clampedR, trCenterY + Math.sin(angle) * clampedR));
  }

  // Top-left corner (PI/2 to PI)
  const tlCenterX = -halfW + clampedR;
  const tlCenterY = halfD - clampedR;
  for (let i = 0; i < numSegments; i++) {
    const angle = (Math.PI / 2) + (i / numSegments) * (Math.PI / 2);
    points.push(new THREE.Vector2(tlCenterX + Math.cos(angle) * clampedR, tlCenterY + Math.sin(angle) * clampedR));
  }

  // Bottom-left corner (PI to 3*PI/2)
  const blCenterX = -halfW + clampedR;
  const blCenterY = -halfD + clampedR;
  for (let i = 0; i < numSegments; i++) {
    const angle = Math.PI + (i / numSegments) * (Math.PI / 2);
    points.push(new THREE.Vector2(blCenterX + Math.cos(angle) * clampedR, blCenterY + Math.sin(angle) * clampedR));
  }

  // Bottom-right corner (3*PI/2 to 2*PI)
  const brCenterX = halfW - clampedR;
  const brCenterY = -halfD + clampedR;
  for (let i = 0; i < numSegments; i++) {
    const angle = (3 * Math.PI / 2) + (i / numSegments) * (Math.PI / 2);
    points.push(new THREE.Vector2(brCenterX + Math.cos(angle) * clampedR, brCenterY + Math.sin(angle) * clampedR));
  }

  return points;
}

// Generates the entire coordinates of model mesh transformed in space
export function getTransformedModelMesh(
  mesh: STLMesh,
  transform: ModelTransform,
  floorThickness: number
): {
  positions: Float32Array;
  normals: Float32Array;
  bbox: THREE.Box3;
} {
  const { positions, normals } = mesh;
  const len = positions.length;

  const resPositions = new Float32Array(len);
  const resNormals = new Float32Array(len);

  // 1. First, find original model boundaries & center (excluding transformations)
  let minX0 = Infinity, maxX0 = -Infinity;
  let minY0 = Infinity, maxY0 = -Infinity;
  let minZ0 = Infinity, maxZ0 = -Infinity;

  for (let i = 0; i < len; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < minX0) minX0 = x;
    if (x > maxX0) maxX0 = x;
    if (y < minY0) minY0 = y;
    if (y > maxY0) maxY0 = y;
    if (z < minZ0) minZ0 = z;
    if (z > maxZ0) maxZ0 = z;
  }

  const cx0 = (minX0 + maxX0) / 2;
  const cy0 = (minY0 + maxY0) / 2;
  const cz0 = (minZ0 + maxZ0) / 2;

  // 2. Compute rotated vertices relative to original center
  const rotRadX = (transform.rotationX * Math.PI) / 180;
  const rotRadY = (transform.rotationY * Math.PI) / 180;
  const rotRadZ = (transform.rotationZ * Math.PI) / 180;

  const tempRotated = new Float32Array(len);
  let minZRotated = Infinity;

  for (let i = 0; i < len; i += 3) {
    // Center at 0
    const xc = positions[i] - cx0;
    const yc = positions[i + 1] - cy0;
    const zc = positions[i + 2] - cz0;

    // Apply rotation
    const [rx, ry, rz] = rotateXYZ(xc, yc, zc, rotRadX, rotRadY, rotRadZ);
    tempRotated[i] = rx;
    tempRotated[i + 1] = ry;
    tempRotated[i + 2] = rz;

    if (rz < minZRotated) {
      minZRotated = rz;
    }
  }

  // 3. Offset so the lowest rotated Z coordinate rests perfectly at [floorThickness]
  // and then apply translation offsets.
  let finalMinX = Infinity, finalMaxX = -Infinity;
  let finalMinY = Infinity, finalMaxY = -Infinity;
  let finalMinZ = Infinity, finalMaxZ = -Infinity;

  for (let i = 0; i < len; i += 3) {
    // Offset relative to center-rotation + floor offset + user Z slider
    const finalX = tempRotated[i] + transform.translationX;
    const finalY = tempRotated[i + 1] + transform.translationY;
    const finalZ = (tempRotated[i + 2] - minZRotated) + floorThickness + transform.translationZ;

    resPositions[i] = finalX;
    resPositions[i + 1] = finalY;
    resPositions[i + 2] = finalZ;

    if (finalX < finalMinX) finalMinX = finalX;
    if (finalX > finalMaxX) finalMaxX = finalX;
    if (finalY < finalMinY) finalMinY = finalY;
    if (finalY > finalMaxY) finalMaxY = finalY;
    if (finalZ < finalMinZ) finalMinZ = finalZ;
    if (finalZ > finalMaxZ) finalMaxZ = finalZ;

    // Rotate Normals! Normals only rotate (no position translation offset)
    const nx = normals[i];
    const ny = normals[i + 1];
    const nz = normals[i + 2];
    const [rnx, rny, rnz] = rotateXYZ(nx, ny, nz, rotRadX, rotRadY, rotRadZ);
    resNormals[i] = rnx;
    resNormals[i + 1] = rny;
    resNormals[i + 2] = rnz;
  }

  const bbox = new THREE.Box3(
    new THREE.Vector3(finalMinX, finalMinY, finalMinZ),
    new THREE.Vector3(finalMaxX, finalMaxY, finalMaxZ)
  );

  return {
    positions: resPositions,
    normals: resNormals,
    bbox,
  };
}

// Watertight tray geometry generator
// Generates the rectangular open-top box with rounded corners
export function generateTrayGeometry(
  modelBbox: THREE.Box3,
  settings: BoxSettings
): {
  positions: Float32Array;
  normals: Float32Array;
} {
  const positionsList: number[] = [];
  const normalsList: number[] = [];

  // Compute model dimensions
  const modelWidth = modelBbox.max.x - modelBbox.min.x;
  const modelDepth = modelBbox.max.y - modelBbox.min.y;
  const modelCenter = modelBbox.getCenter(new THREE.Vector3());

  // Interior Sizing
  const wInt = modelWidth + 2 * settings.moatWidth;
  const dInt = modelDepth + 2 * settings.moatWidth;

  // Exterior Sizing
  const wExt = wInt + 2 * settings.wallThickness;
  const dExt = dInt + 2 * settings.wallThickness;

  // Corner radiuses (clamped)
  const rExt = Math.min(settings.cornerRadius, wExt / 2, dExt / 2);
  const rInt = Math.max(0, rExt - settings.wallThickness);

  // Height definitions
  const hFloor = settings.floorThickness;
  const hTotal = hFloor + settings.wallHeight;

  // Generate 2D profiles aligned at model center X & Y
  const outerProfile2D = getRoundedRectPoints(wExt, dExt, rExt);
  const innerProfile2D = getRoundedRectPoints(wInt, dInt, rInt);

  // Loft loop vertex lists
  const outerBottom: [number, number, number][] = outerProfile2D.map(p => [modelCenter.x + p.x, modelCenter.y + p.y, 0]);
  const outerTop: [number, number, number][] = outerProfile2D.map(p => [modelCenter.x + p.x, modelCenter.y + p.y, hTotal]);
  const innerFloor: [number, number, number][] = innerProfile2D.map(p => [modelCenter.x + p.x, modelCenter.y + p.y, hFloor]);
  const innerTop: [number, number, number][] = innerProfile2D.map(p => [modelCenter.x + p.x, modelCenter.y + p.y, hTotal]);

  const numOuter = outerBottom.length;
  const numInner = innerFloor.length;

  const pushTriangle = (p1: [number, number, number], p2: [number, number, number], p3: [number, number, number]) => {
    // Face normal computation
    const ux = p2[0] - p1[0], uy = p2[1] - p1[1], uz = p2[2] - p1[2];
    const vx = p3[0] - p1[0], vy = p3[1] - p1[1], vz = p3[2] - p1[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    const n = len > 0 ? [nx / len, ny / len, nz / len] : [0, 0, 1];

    positionsList.push(...p1, ...p2, ...p3);
    normalsList.push(...n, ...n, ...n);
  };

  // 1. Bottom plate face: Outer Bottom profile (Z = 0) facing DOWN (Normal Z-)
  // We can treat (modelCenter.x, modelCenter.y, 0) as the center point
  const cBottom: [number, number, number] = [modelCenter.x, modelCenter.y, 0];
  for (let i = 0; i < numOuter; i++) {
    const next = (i + 1) % numOuter;
    pushTriangle(cBottom, outerBottom[next], outerBottom[i]);
  }

  // 2. Inside cavity floor: Inner Floor profile (Z = hFloor) facing UP (Normal Z+)
  const cInnerFloor: [number, number, number] = [modelCenter.x, modelCenter.y, hFloor];
  for (let i = 0; i < numInner; i++) {
    const next = (i + 1) % numInner;
    pushTriangle(cInnerFloor, innerFloor[i], innerFloor[next]);
  }

  // 3. Outer Walls: Loft between outerBottom (Z=0) and outerTop (Z=hTotal)
  // Winding index to ensure normals point outwards
  for (let i = 0; i < numOuter; i++) {
    const next = (i + 1) % numOuter;
    pushTriangle(outerBottom[i], outerBottom[next], outerTop[next]);
    pushTriangle(outerBottom[i], outerTop[next], outerTop[i]);
  }

  // 4. Inner Walls: Loft between innerFloor (Z=hFloor) and innerTop (Z=hTotal)
  // Winding index to ensure normals point inwards towards cavity
  for (let i = 0; i < numInner; i++) {
    const next = (i + 1) % numInner;
    pushTriangle(innerFloor[i], innerTop[next], innerFloor[next]);
    pushTriangle(innerFloor[i], innerTop[i], innerTop[next]);
  }

  // 5. Top Rim flat wall connection: connecting outerTop (Z=hTotal) and innerTop (Z=hTotal)
  // Outer top loop and inner top loop have the same number of points ONLY if they use the same number of segments.
  // Wait! Do they?
  // Yes, both are generated with the same segment count in `getRoundedRectPoints`! Let's double check alignment.
  // Since numOuter and numInner are equal, we can loft them beautifully point-by-point.
  // If for some reason they don't match, we map them indices or handle safely. They will match perfectly because they call getRoundedRectPoints with identical default segment counts.
  const numPoints = Math.min(numOuter, numInner);
  for (let i = 0; i < numPoints; i++) {
    const next = (i + 1) % numPoints;
    // Outer i, Inner i, Inner next, Outer next
    // Normal needs to face UP (Z+)
    pushTriangle(outerTop[i], innerTop[next], innerTop[i]);
    pushTriangle(outerTop[i], outerTop[next], innerTop[next]);
  }

  return {
    positions: new Float32Array(positionsList),
    normals: new Float32Array(normalsList),
  };
}

// STL Exporter: Generates a single waterproof watertight binary STL ArrayBuffer
export function exportToSTL(
  modelPos: Float32Array,
  modelNorm: Float32Array,
  boxPos: Float32Array,
  boxNorm: Float32Array
): ArrayBuffer {
  const nModelTriangles = modelPos.length / 9;
  const nBoxTriangles = boxPos.length / 9;
  const nTotalTriangles = nModelTriangles + nBoxTriangles;

  const headerText = 'Mold Box Generator - Plaster Mold Box Tray Export';
  const bufferSize = 80 + 4 + nTotalTriangles * 50;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // Write ASCII Header (80 bytes)
  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(headerText);
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < headerBytes.length ? headerBytes[i] : 0);
  }

  // Write Num triangles (4 bytes unsigned int)
  view.setUint32(80, nTotalTriangles, true);

  let byteOffset = 84;

  // Helper to write a float32 array of triangles
  function writeTriangles(positions: Float32Array, normals: Float32Array, count: number) {
    for (let i = 0; i < count; i++) {
      // Normal (take from vertex 0 normal or calculate face average)
      const nx = normals[i * 9];
      const ny = normals[i * 9 + 1];
      const nz = normals[i * 9 + 2];
      view.setFloat32(byteOffset, nx, true);
      view.setFloat32(byteOffset + 4, ny, true);
      view.setFloat32(byteOffset + 8, nz, true);
      byteOffset += 12;

      // Vertex 1
      view.setFloat32(byteOffset, positions[i * 9], true);
      view.setFloat32(byteOffset + 4, positions[i * 9 + 1], true);
      view.setFloat32(byteOffset + 8, positions[i * 9 + 2], true);
      byteOffset += 12;

      // Vertex 2
      view.setFloat32(byteOffset, positions[i * 9 + 3], true);
      view.setFloat32(byteOffset + 4, positions[i * 9 + 4], true);
      view.setFloat32(byteOffset + 8, positions[i * 9 + 5], true);
      byteOffset += 12;

      // Vertex 3
      view.setFloat32(byteOffset, positions[i * 9 + 6], true);
      view.setFloat32(byteOffset + 4, positions[i * 9 + 7], true);
      view.setFloat32(byteOffset + 8, positions[i * 9 + 8], true);
      byteOffset += 12;

      // Attribute byte count (2 bytes)
      view.setUint16(byteOffset, 0, true);
      byteOffset += 2;
    }
  }

  // Write model triangles
  writeTriangles(modelPos, modelNorm, nModelTriangles);

  // Write box triangles
  writeTriangles(boxPos, boxNorm, nBoxTriangles);

  return arrayBuffer;
}
