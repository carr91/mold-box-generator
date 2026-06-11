import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ModelTransform, BoxSettings, STLMesh } from '../types';
import { getTransformedModelMesh, generateTrayGeometry } from '../utils/geometry';
import { Eye, EyeOff, Box, RefreshCw } from 'lucide-react';

interface PreviewProps {
  model: STLMesh;
  transform: ModelTransform;
  settings: BoxSettings;
  onDimensionsUpdate: (dimensions: {
    modelWidth: number;
    modelDepth: number;
    modelHeight: number;
    boxWidth: number;
    boxDepth: number;
    boxHeight: number;
  }) => void;
  onGeometriesGenerated: (data: {
    modelPos: Float32Array;
    modelNorm: Float32Array;
    boxPos: Float32Array;
    boxNorm: Float32Array;
  }) => void;
}

export default function MoldBoxPreview({
  model,
  transform,
  settings,
  onDimensionsUpdate,
  onGeometriesGenerated,
}: PreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastModelNameRef = useRef<string | null>(null);

  // View parameters
  const [yaw, setYaw] = useState<number>(-Math.PI / 4);
  const [pitch, setPitch] = useState<number>(Math.PI / 5);
  const [zoom, setZoom] = useState<number>(3.5);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);

  // States
  const [transparentBox, setTransparentBox] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Track dragging state variables
  const dragStartRef = useRef<{
    x: number;
    y: number;
    yaw: number;
    pitch: number;
    panX: number;
    panY: number;
    type: 'orbit' | 'pan';
    touchDist?: number;
    startZoom?: number;
  } | null>(null);

  // 1. Autozoom & Center calculation when model changes
  useEffect(() => {
    if (!model) return;
    const { bbox } = getTransformedModelMesh(model, transform, settings.floorThickness);
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 40;

    if (lastModelNameRef.current !== model.name) {
      lastModelNameRef.current = model.name;
      // Reset camera parameters
      setPanX(0);
      setPanY(0);
      setYaw(-Math.PI / 4);
      setPitch(Math.PI / 5);
      
      const width = mountRef.current?.clientWidth || 500;
      const initialZoom = Math.max(1.5, Math.min(18.0, (width * 0.4) / maxDim));
      setZoom(initialZoom);
    }
  }, [model, transform, settings.floorThickness]);

  // Handle Dimensions compilation & geometries callback dispatch
  useEffect(() => {
    if (!model) return;
    
    // Get transformed coordinates and geometry
    const { positions: tPos, normals: tNorm, bbox } = getTransformedModelMesh(
      model,
      transform,
      settings.floorThickness
    );

    const { positions: bPos, normals: bNorm } = generateTrayGeometry(bbox, settings);

    // Communicate to parent component
    onGeometriesGenerated({
      modelPos: tPos,
      modelNorm: tNorm,
      boxPos: bPos,
      boxNorm: bNorm,
    });

    const modelWidth = bbox.max.x - bbox.min.x;
    const modelDepth = bbox.max.y - bbox.min.y;
    const modelHeight = bbox.max.z - bbox.min.z;

    const interiorW = modelWidth + 2 * settings.moatWidth;
    const interiorD = modelDepth + 2 * settings.moatWidth;
    const boxWidth = interiorW + 2 * settings.wallThickness;
    const boxDepth = interiorD + 2 * settings.wallThickness;
    const boxHeight = settings.floorThickness + settings.wallHeight;

    onDimensionsUpdate({
      modelWidth,
      modelDepth,
      modelHeight,
      boxWidth,
      boxDepth,
      boxHeight,
    });
  }, [model, transform, settings, onDimensionsUpdate, onGeometriesGenerated]);

  // 2. Beautiful Canvas-draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const clientWidth = mountRef.current?.clientWidth || 500;
    const clientHeight = mountRef.current?.clientHeight || 400;

    // Retina support layout multiplier
    const dpr = window.devicePixelRatio || 1;
    canvas.width = clientWidth * dpr;
    canvas.height = clientHeight * dpr;
    ctx.scale(dpr, dpr);

    // Warm-white studio backdrop
    ctx.fillStyle = '#fdfdfc';
    ctx.fillRect(0, 0, clientWidth, clientHeight);

    // 3. Coordinate math vectors load 
    const { positions: tPos, normals: tNorm, bbox } = getTransformedModelMesh(
      model,
      transform,
      settings.floorThickness
    );

    const { positions: bPos, normals: bNorm } = generateTrayGeometry(bbox, settings);

    const center = bbox.getCenter(new THREE.Vector3());
    const cx = center.x;
    const cy = center.y;
    const cz = center.z;

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    const centerX = clientWidth / 2;
    const centerY = clientHeight / 2;

    // 3D Point Projection Helper (Z-Up CAD layout projection)
    const projectPoint = (wx: number, wy: number, wz: number) => {
      // Step 1: subtract CAD origin center
      const dx = wx - cx;
      const dy = wy - cy;
      const dz = wz - cz;

      // Step 2: Rotate around Z (Horizontal Orbit)
      const rx1 = dx * cosY - dy * sinY;
      const ry1 = dx * sinY + dy * cosY;
      const rz1 = dz;

      // Step 3: Rotate around X (Vertical Tilt Angle)
      const rx2 = rx1;
      const ry2 = ry1 * cosP - rz1 * sinP;
      const rz2 = ry1 * sinP + rz1 * cosP;

      // Map to 2D screen positions with orthographic projection
      const screenX = centerX + rx2 * zoom + panX;
      const screenY = centerY - ry2 * zoom + panY; // invert CAD Y-up standard

      return { x: screenX, y: screenY, depth: rz2 };
    };

    // 1. Draw printer grid helper underneath
    if (showGrid) {
      const size = 150;
      const step = 15;
      
      const drawGridLine = (p1x: number, p1y: number, p1z: number, p2x: number, p2y: number, p2z: number) => {
        const proj1 = projectPoint(p1x, p1y, p1z);
        const proj2 = projectPoint(p2x, p2y, p2z);
        ctx.beginPath();
        ctx.moveTo(proj1.x, proj1.y);
        ctx.lineTo(proj2.x, proj2.y);
        ctx.stroke();
      };

      for (let i = -size; i <= size; i += step) {
        ctx.strokeStyle = i === 0 ? '#94a3b8' : '#e2e8f0';
        ctx.lineWidth = i === 0 ? 1.5 : 0.75;
        // Lines along Y-plane (varying X)
        drawGridLine(i, -size, 0, i, size, 0);
        // Lines along X-plane (varying Y)
        drawGridLine(-size, i, 0, size, i, 0);
      }
    }

    // 2. Triangles compiler with flat shading & camera backface filtering
    interface Triangle {
      p0: { x: number; y: number; depth: number };
      p1: { x: number; y: number; depth: number };
      p2: { x: number; y: number; depth: number };
      depth: number;
      color: string;
      strokeColor: string;
      meshType: 'model' | 'box';
    }

    const triangles: Triangle[] = [];

    const compileTriangles = (pos: Float32Array, norm: Float32Array, meshType: 'model' | 'box') => {
      const len = pos.length;
      // High-performance adaptive decimation stride during camera drags for massive STL meshes
      const dragAdaptiveDecimation = isDragging && meshType === 'model' && len > 12000;
      const stride = dragAdaptiveDecimation ? Math.max(3, Math.floor(len / 18000)) * 9 : 9;

      for (let i = 0; i < len; i += stride) {
        if (i + 8 >= len) break;

        const wx0 = pos[i];
        const wy0 = pos[i + 1];
        const wz0 = pos[i + 2];

        const wx1 = pos[i + 3];
        const wy1 = pos[i + 4];
        const wz1 = pos[i + 5];

        const wx2 = pos[i + 6];
        const wy2 = pos[i + 7];
        const wz2 = pos[i + 8];

        const nx = norm[i];
        const ny = norm[i + 1];
        const nz = norm[i + 2];

        const p0 = projectPoint(wx0, wy0, wz0);
        const p1 = projectPoint(wx1, wy1, wz1);
        const p2 = projectPoint(wx2, wy2, wz2);

        // Vector cross product winding to quickly cull camera backfaces
        const ux = p1.x - p0.x;
        const uy = p1.y - p0.y;
        const vx = p2.x - p0.x;
        const vy = p2.y - p0.y;
        const crossZ = ux * vy - uy * vx;

        const isBackface = crossZ < 0;

        // Cull opaque back-facing faces of the model to keep screen clean and speed up math
        if (meshType === 'model' && isBackface) {
          continue;
        }

        const avgDepth = (p0.depth + p1.depth + p2.depth) / 3;

        // Soft diffuse lighting matrix
        // Light coming from upper top-right bounds
        const dot = nx * 0.45 - ny * 0.45 + nz * 0.76;
        const diffuse = Math.max(0.15, Math.min(1.0, dot));

        let fillColor = '';
        let outlineColor = 'transparent';

        if (meshType === 'model') {
          // Sharp slate grey gradient lighting
          const r = Math.round(51 + (170 - 51) * diffuse);
          const g = Math.round(65 + (185 - 65) * diffuse);
          const b = Math.round(85 + (210 - 85) * diffuse);
          fillColor = `rgb(${r}, ${g}, ${b})`;
          outlineColor = `rgb(${Math.round(r * 0.75)}, ${Math.round(g * 0.75)}, ${Math.round(b * 0.75)})`;
        } else {
          // Solid/Transparent casting plaster box white theme
          const shade = Math.round(185 + (255 - 185) * diffuse);
          const opacVal = transparentBox ? 0.42 : 0.96;
          fillColor = `rgba(${shade}, ${shade}, ${shade}, ${opacVal})`;
          outlineColor = transparentBox 
            ? 'rgba(0, 0, 0, 0.12)' 
            : 'rgba(0, 0, 0, 0.28)';
        }

        triangles.push({
          p0,
          p1,
          p2,
          depth: avgDepth,
          color: fillColor,
          strokeColor: outlineColor,
          meshType,
        });
      }
    };

    compileTriangles(tPos, tNorm, 'model');
    compileTriangles(bPos, bNorm, 'box');

    // Painter's algorithm sort (largest depth / furthest away gets drafted first)
    triangles.sort((a, b) => b.depth - a.depth);

    // Rasterize sorted facets
    const totalTris = triangles.length;
    for (let i = 0; i < totalTris; i++) {
      const t = triangles[i];
      ctx.fillStyle = t.color;
      ctx.strokeStyle = t.strokeColor;
      ctx.lineWidth = t.meshType === 'model' ? 0.35 : 0.65;

      ctx.beginPath();
      ctx.moveTo(t.p0.x, t.p0.y);
      ctx.lineTo(t.p1.x, t.p1.y);
      ctx.lineTo(t.p2.x, t.p2.y);
      ctx.closePath();
      ctx.fill();

      if (t.strokeColor !== 'transparent') {
        ctx.stroke();
      }
    }
  }, [model, transform, settings, yaw, pitch, zoom, panX, panY, transparentBox, showGrid, isDragging]);

  // Click interaction managers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const isRightClick = e.button === 2 || e.button === 1 || e.shiftKey;

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      yaw,
      pitch,
      panX,
      panY,
      type: isRightClick ? 'pan' : 'orbit',
    };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStartRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (dragStartRef.current.type === 'pan') {
      setPanX(dragStartRef.current.panX + dx);
      setPanY(dragStartRef.current.panY + dy);
    } else {
      const sensitivity = 0.007;
      setYaw(dragStartRef.current.yaw - dx * sensitivity);
      setPitch(
        Math.max(
          0.05,
          Math.min(Math.PI / 2 - 0.05, dragStartRef.current.pitch + dy * sensitivity)
        )
      );
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((z) => Math.max(0.2, Math.min(45.0, z * factor)));
  };

  // Touch interface converters
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        yaw,
        pitch,
        panX,
        panY,
        type: 'orbit',
      };
      setIsDragging(true);
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

      dragStartRef.current = {
        x: cx,
        y: cy,
        yaw,
        pitch,
        panX,
        panY,
        type: 'pan',
        touchDist: dist,
        startZoom: zoom,
      };
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStartRef.current) return;

    if (e.touches.length === 1 && dragStartRef.current.type === 'orbit') {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      const sensitivity = 0.009;
      setYaw(dragStartRef.current.yaw - dx * sensitivity);
      setPitch(
        Math.max(
          0.05,
          Math.min(Math.PI / 2 - 0.05, dragStartRef.current.pitch + dy * sensitivity)
        )
      );
    } else if (e.touches.length === 2 && dragStartRef.current.type === 'pan') {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

      // Pan offset updates
      const dx = cx - dragStartRef.current.x;
      const dy = cy - dragStartRef.current.y;
      setPanX(dragStartRef.current.panX + dx);
      setPanY(dragStartRef.current.panY + dy);

      // Pinch zoom updates
      if (dragStartRef.current.touchDist && dragStartRef.current.startZoom) {
        const factor = dist / dragStartRef.current.touchDist;
        setZoom(Math.max(0.2, Math.min(45.0, dragStartRef.current.startZoom * factor)));
      }
    }
  };

  // Viewing presets centering logic
  const resetCamera = (viewType: 'iso' | 'top' | 'front' | 'side') => {
    setPanX(0);
    setPanY(0);

    switch (viewType) {
      case 'iso':
        setYaw(-Math.PI / 4);
        setPitch(Math.PI / 5);
        break;
      case 'top':
        setYaw(0);
        setPitch(0.001); // almost flat
        break;
      case 'front':
        setYaw(0);
        setPitch(Math.PI / 2 - 0.001);
        break;
      case 'side':
        setYaw(-Math.PI / 2);
        setPitch(Math.PI / 2 - 0.001);
        break;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#fdfdfc] border-2 border-black rounded-none overflow-hidden relative">
      {/* Visual Canvas Drawing Area */}
      <div 
        ref={mountRef} 
        className="flex-1 w-full h-full min-h-[380px] relative overflow-hidden select-none"
      >
        <canvas
          id="cad-canvas-renderer"
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute top-0 left-0 w-full h-full block cursor-grab active:cursor-grabbing"
        />
      </div>

      {/* Dynamic Overlay Rendering Controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-auto select-none">
        <button
          id="toggle-transparency-btn"
          onClick={() => setTransparentBox(!transparentBox)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none text-[10px] font-bold uppercase tracking-wider transition-all border border-black cursor-pointer ${
            transparentBox
              ? 'bg-[#f97316] text-white'
              : 'bg-white text-black hover:bg-neutral-50'
          }`}
          title="Toggle wall visibility inside cavity"
        >
          {transparentBox ? <Eye size={14} /> : <EyeOff size={14} />}
          <span>{transparentBox ? 'X-Ray Active' : 'Solid Walls'}</span>
        </button>

        <button
          id="toggle-grid-btn"
          onClick={() => setShowGrid(!showGrid)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none text-[10px] font-bold uppercase tracking-wider transition-all border border-black cursor-pointer ${
            showGrid
              ? 'bg-black text-white'
              : 'bg-white text-black hover:bg-neutral-50'
          }`}
        >
          <Box size={14} />
          <span>{showGrid ? 'Hide Printer Grid' : 'Show Printer Grid'}</span>
        </button>
      </div>

      {/* Isometric CAD Presets */}
      <div className="absolute top-4 right-4 flex items-center gap-1 bg-white border border-black p-1 rounded-none shadow-none text-black select-none">
        <span className="text-[9px] text-neutral-400 font-mono font-bold px-2 uppercase tracking-tight">
          Views:
        </span>
        <button
          id="camera-iso-btn"
          onClick={() => resetCamera('iso')}
          className="px-2 py-0.5 text-[9px] font-mono font-bold text-black border border-transparent hover:border-black transition uppercase cursor-pointer"
        >
          ISO
        </button>
        <button
          id="camera-top-btn"
          onClick={() => resetCamera('top')}
          className="px-2 py-0.5 text-[9px] font-mono font-bold text-black border border-transparent hover:border-black transition uppercase cursor-pointer"
        >
          Top
        </button>
        <button
          id="camera-front-btn"
          onClick={() => resetCamera('front')}
          className="px-2 py-0.5 text-[9px] font-mono font-bold text-black border border-transparent hover:border-black transition uppercase cursor-pointer"
        >
          Front
        </button>
        <button
          id="camera-side-btn"
          onClick={() => resetCamera('side')}
          className="px-2 py-0.5 text-[9px] font-mono font-bold text-black border border-transparent hover:border-black transition uppercase cursor-pointer"
        >
          Side
        </button>
      </div>

      {/* Manual Drag Indicator */}
      <div className="absolute bottom-4 left-4 bg-black text-white border border-black py-1 px-2.5 text-[9px] tracking-widest font-mono uppercase font-black flex items-center gap-2 pointer-events-none select-none">
        <RefreshCw size={9} className="animate-spin text-[#f97316] stroke-[2.5]" />
        <span>Drag Rotate • Shift/Right-drag Pan • Scroll Zoom</span>
      </div>
    </div>
  );
}
