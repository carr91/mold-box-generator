import React, { useRef } from 'react';
import { ModelTransform, BoxSettings, STLMesh } from '../types';
import { parseSTL } from '../utils/geometry';
import { Upload, RotateCcw, Sliders, LayoutGrid, Info, Check } from 'lucide-react';

interface ControlPanelProps {
  model: STLMesh | null;
  onModelLoaded: (mesh: STLMesh) => void;
  transform: ModelTransform;
  onTransformChange: (transform: ModelTransform) => void;
  settings: BoxSettings;
  onSettingsChange: (settings: BoxSettings) => void;
}

export default function ControlPanel({
  model,
  onModelLoaded,
  transform,
  onTransformChange,
  settings,
  onSettingsChange,
}: ControlPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadSTLFile(file);
  };

  const loadSTLFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      try {
        const mesh = parseSTL(buffer, file.name);
        onModelLoaded(mesh);
      } catch (err) {
        alert('Failed to parse STL file. Please verify it is a valid ASCII or binary STL mesh.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.stl')) {
      loadSTLFile(file);
    } else {
      alert('Only .stl mesh files are supported.');
    }
  };

  // Generic transform update helpers
  const updateTransform = (key: keyof ModelTransform, val: number) => {
    onTransformChange({
      ...transform,
      [key]: val,
    });
  };

  const updateSetting = (key: keyof BoxSettings, val: number) => {
    onSettingsChange({
      ...settings,
      [key]: Math.max(0, val),
    });
  };

  const resetTransforms = () => {
    onTransformChange({
      translationX: 0,
      translationY: 0,
      translationZ: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
    });
  };

  return (
    <div className="flex flex-col gap-6 h-full font-sans text-black">
      {/* 1. STL File Import Area */}
      <div className="bg-[#f8f8f6] border-2 border-black p-5 rounded-none shadow-none">
        <h2 className="text-xs font-black uppercase mb-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-black rounded-full inline-block"></span>
          <span>Upload 3D Mesh</span>
        </h2>

        <div
          id="dropzone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-black hover:bg-white bg-neutral-50 rounded-none p-6 text-center cursor-pointer transition-all duration-150 group"
        >
          <input
            id="stl-file-input"
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".stl"
            className="hidden"
          />
          <div className="flex flex-col items-center gap-2">
            <div className="bg-black text-white p-2.5 rounded-none font-bold uppercase text-[10px] tracking-wide transition group-hover:scale-105">
              Select STL File
            </div>
            <p className="text-xs font-black uppercase text-black mt-1">
              Drag & Drop Your STL Here
            </p>
            <p className="text-[10px] text-neutral-500 font-mono">
              Binary & ASCII formats supported
            </p>
          </div>
        </div>

        {model && (
          <div className="mt-4 p-3 bg-white border border-black rounded-none flex items-center justify-between text-xs">
            <div className="overflow-hidden mr-2">
              <p className="font-extrabold text-black truncate font-mono text-[11px]" title={model.name}>
                {model.name}
              </p>
              <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                {(model.positions.length / 9).toLocaleString()} POLYGONS • ACTIVE
              </p>
            </div>
            <span className="bg-black text-white px-2 py-1 rounded-none text-[9px] font-mono font-bold whitespace-nowrap flex items-center gap-1">
              <Check size={10} className="stroke-[3]" /> LOADED
            </span>
          </div>
        )}
      </div>

      {/* 2. Position & Rotation Transforms */}
      <div className="bg-[#f8f8f6] border-2 border-black p-5 rounded-none shadow-none">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-black uppercase flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-black rounded-full inline-block"></span>
            <span>Model Transform</span>
          </h2>
          <button
            id="reset-transforms-btn"
            onClick={resetTransforms}
            className="text-[9px] text-white bg-black hover:bg-[#f97316] font-mono font-black uppercase px-2 py-1 rounded-none transition flex items-center gap-1 leading-none"
          >
            <RotateCcw size={10} />
            <span>Reset</span>
          </button>
        </div>

        {/* Translation Section */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-2">Translation (XYZ)</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="border border-black p-2 bg-white">
                <span className="text-[9px] block font-mono font-bold opacity-50">X (Shift)</span>
                <input
                  type="text"
                  readOnly
                  value={`${transform.translationX.toFixed(1)}mm`}
                  className="w-full font-mono text-xs font-bold outline-none border-none text-black select-none pointer-events-none"
                />
              </div>
              <div className="border border-black p-2 bg-white">
                <span className="text-[9px] block font-mono font-bold opacity-50">Y (Shift)</span>
                <input
                  type="text"
                  readOnly
                  value={`${transform.translationY.toFixed(1)}mm`}
                  className="w-full font-mono text-xs font-bold outline-none border-none text-black select-none pointer-events-none"
                />
              </div>
              <div className="border border-black p-2 bg-white bg-[#fffbeb] border-amber-500">
                <span className="text-[9px] block font-mono font-bold text-amber-800 opacity-80">Z (Lift)</span>
                <input
                  type="text"
                  readOnly
                  value={`${transform.translationZ.toFixed(1)}mm`}
                  className="w-full font-mono text-xs font-black outline-none border-none text-amber-700 select-none pointer-events-none"
                />
              </div>
            </div>

            {/* Slider Controls for micro adjustments */}
            <div className="space-y-2 pt-1">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-neutral-400">Drag X Slider</span>
                <input
                  id="transform-x"
                  type="range"
                  min="-60"
                  max="60"
                  step="0.5"
                  value={transform.translationX}
                  onChange={(e) => updateTransform('translationX', parseFloat(e.target.value))}
                  className="w-full accent-black cursor-ew-resize h-1 bg-neutral-300"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-neutral-400">Drag Y Slider</span>
                <input
                  id="transform-y"
                  type="range"
                  min="-60"
                  max="60"
                  step="0.5"
                  value={transform.translationY}
                  onChange={(e) => updateTransform('translationY', parseFloat(e.target.value))}
                  className="w-full accent-black cursor-ew-resize h-1 bg-neutral-300"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-neutral-400">Drag Z (Floor Clear) Slider</span>
                <input
                  id="transform-z"
                  type="range"
                  min="-15"
                  max="40"
                  step="0.5"
                  value={transform.translationZ}
                  onChange={(e) => updateTransform('translationZ', parseFloat(e.target.value))}
                  className="w-full accent-[#f97316] cursor-ew-resize h-1 bg-neutral-300"
                />
              </div>
            </div>
          </div>

          <hr className="border-black border-dashed opacity-30 my-4" />

          {/* Rotation Section */}
          <div>
            <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-2">Rotation (Degrees)</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="border border-black p-2 bg-white">
                <span className="text-[9px] block font-mono font-bold opacity-50">Pitch (X)</span>
                <input
                  type="text"
                  readOnly
                  value={`${transform.rotationX.toFixed(0)}°`}
                  className="w-full font-mono text-xs font-bold outline-none border-none text-black select-none pointer-events-none"
                />
              </div>
              <div className="border border-black p-2 bg-white">
                <span className="text-[9px] block font-mono font-bold opacity-50">Roll (Y)</span>
                <input
                  type="text"
                  readOnly
                  value={`${transform.rotationY.toFixed(0)}°`}
                  className="w-full font-mono text-xs font-bold outline-none border-none text-black select-none pointer-events-none"
                />
              </div>
              <div className="border border-black p-2 bg-white">
                <span className="text-[9px] block font-mono font-bold opacity-50">Yaw (Z)</span>
                <input
                  type="text"
                  readOnly
                  value={`${transform.rotationZ.toFixed(0)}°`}
                  className="w-full font-mono text-xs font-bold outline-none border-none text-black select-none pointer-events-none"
                />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-neutral-400">Drag Pitch (X)</span>
                <input
                  id="rotation-x"
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={transform.rotationX}
                  onChange={(e) => updateTransform('rotationX', parseFloat(e.target.value))}
                  className="w-full accent-black cursor-ew-resize h-1 bg-neutral-300"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-neutral-400">Drag Roll (Y)</span>
                <input
                  id="rotation-y"
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={transform.rotationY}
                  onChange={(e) => updateTransform('rotationY', parseFloat(e.target.value))}
                  className="w-full accent-black cursor-ew-resize h-1 bg-neutral-300"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-neutral-400">Drag Yaw (Z)</span>
                <input
                  id="rotation-z"
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={transform.rotationZ}
                  onChange={(e) => updateTransform('rotationZ', parseFloat(e.target.value))}
                  className="w-full accent-black cursor-ew-resize h-1 bg-neutral-300"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Box Wall and Moat Settings */}
      <div className="bg-[#f8f8f6] border-2 border-black p-5 rounded-none shadow-none">
        <h2 className="text-xs font-black uppercase mb-4 flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-black rounded-full inline-block"></span>
          <span>Box Configuration</span>
        </h2>

        <div className="space-y-4">
          {/* Wall height */}
          <div>
            <div className="flex justify-between text-[10px] uppercase font-bold mb-1">
              <span>Box Wall Height</span>
              <span className="font-mono bg-white border border-black px-1 text-black font-extrabold">{settings.wallHeight.toFixed(1)}mm</span>
            </div>
            <input
              id="setting-wall-height"
              type="range"
              min="5"
              max="100"
              step="1"
              value={settings.wallHeight}
              onChange={(e) => updateSetting('wallHeight', parseInt(e.target.value))}
              className="w-full accent-black cursor-ew-resize h-1.5 bg-neutral-200"
            />
          </div>

          {/* Wall thickness */}
          <div>
            <div className="flex justify-between text-[10px] uppercase font-bold mb-1">
              <span>Wall Thickness</span>
              <span className="font-mono bg-white border border-black px-1 text-black font-extrabold">{settings.wallThickness.toFixed(1)}mm</span>
            </div>
            <input
              id="setting-wall-thickness"
              type="range"
              min="2"
              max="20"
              step="0.5"
              value={settings.wallThickness}
              onChange={(e) => updateSetting('wallThickness', parseFloat(e.target.value))}
              className="w-full accent-black cursor-ew-resize h-1.5 bg-neutral-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-neutral-500 block">Floor Thk (mm)</label>
              <div className="flex items-center gap-1">
                <input
                  id="setting-floor-thickness"
                  type="number"
                  min="1"
                  max="20"
                  step="0.5"
                  value={settings.floorThickness}
                  onChange={(e) => updateSetting('floorThickness', parseFloat(e.target.value) || 1)}
                  className="w-full border border-black p-1 bg-white text-xs font-mono font-bold text-black"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-neutral-500 block">Moat Width (mm)</label>
              <div className="flex items-center gap-1">
                <input
                  id="setting-moat-width"
                  type="number"
                  min="1"
                  max="40"
                  step="0.5"
                  value={settings.moatWidth}
                  onChange={(e) => updateSetting('moatWidth', parseFloat(e.target.value) || 1)}
                  className="w-full border border-black p-1 bg-white text-xs font-mono font-bold text-black"
                />
              </div>
            </div>
          </div>

          {/* Corner radius with quick switcher tags */}
          <div>
            <div className="flex justify-between text-[10px] uppercase font-bold mb-1">
              <span>Corner Radius</span>
              <span className="font-mono bg-white border border-black px-1 text-black font-extrabold">{settings.cornerRadius.toFixed(1)}mm</span>
            </div>
            <input
              id="setting-corner-radius"
              type="range"
              min="0"
              max="30"
              step="0.5"
              value={settings.cornerRadius}
              onChange={(e) => updateSetting('cornerRadius', parseFloat(e.target.value))}
              className="w-full accent-black cursor-ew-resize h-1.5 bg-neutral-200 mb-2"
            />
            {/* Quick switcher button values */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateSetting('cornerRadius', 0)}
                className={`flex-1 border border-black text-[10px] py-1 font-bold ${
                  settings.cornerRadius === 0 ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-50'
                }`}
              >
                SHARP (0)
              </button>
              <button
                type="button"
                onClick={() => updateSetting('cornerRadius', 8)}
                className={`flex-1 border border-black text-[10px] py-1 font-bold ${
                  settings.cornerRadius === 8 ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-50'
                }`}
              >
                SMOOTH (8)
              </button>
              <button
                type="button"
                onClick={() => updateSetting('cornerRadius', 15)}
                className={`flex-1 border border-black text-[10px] py-1 font-bold ${
                  settings.cornerRadius === 15 ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-50'
                }`}
              >
                ROUNDED (15)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Casting recommendations with original Artistic Flair Banner look */}
      <div className="p-4 border-2 border-black bg-[#f97316] text-white">
        <h3 className="text-xs font-black uppercase flex items-center gap-1.5">
          <Info size={14} className="stroke-[2.5]" />
          <span>Pour Recommendation</span>
        </h3>
        <p className="text-[10px] mt-1.5 opacity-95 leading-relaxed">
          Ensure wall thickness is <strong>≥ 3.5mm</strong> and horizontal moat is <strong>≥ 5.0mm</strong>. This prevents plaster mold fracturing and guarantees a watertight vacuum seal. Keep model contacts flat to the base.
        </p>
      </div>
    </div>
  );
}
