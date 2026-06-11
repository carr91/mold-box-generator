import { useState, useEffect } from 'react';
import { ModelTransform, BoxSettings, STLMesh } from './types';
import { generateDefaultStar, exportToSTL } from './utils/geometry';
import Header from './components/Header';
import MoldBoxPreview from './components/MoldBoxPreview';
import ControlPanel from './components/ControlPanel';
import { Download, ArrowRight, Layers, Ruler, Sparkles } from 'lucide-react';

export default function App() {
  // 1. Core states
  const [model, setModel] = useState<STLMesh | null>(null);
  const [transform, setTransform] = useState<ModelTransform>({
    translationX: 0,
    translationY: 0,
    translationZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
  });

  const [settings, setSettings] = useState<BoxSettings>({
    wallHeight: 30, // mm
    wallThickness: 4, // mm
    floorThickness: 4, // mm
    moatWidth: 8, // mm
    cornerRadius: 8, // mm
  });

  // Compiled geometry coordinates for STL exports
  const [geometries, setGeometries] = useState<{
    modelPos: Float32Array;
    modelNorm: Float32Array;
    boxPos: Float32Array;
    boxNorm: Float32Array;
  } | null>(null);

  // Dynamic calculated physical dimensions
  const [dimensions, setDimensions] = useState({
    modelWidth: 0,
    modelDepth: 0,
    modelHeight: 0,
    boxWidth: 0,
    boxDepth: 0,
    boxHeight: 0,
  });

  // 2. Load procedural star as the default model on mount
  useEffect(() => {
    const star = generateDefaultStar();
    setModel(star);
  }, []);

  // 3. Export to single watertight compound file
  const handleExportSTL = () => {
    if (!geometries) {
      alert('Generating mesh... Please wait a moment.');
      return;
    }

    try {
      const buffer = exportToSTL(
        geometries.modelPos,
        geometries.modelNorm,
        geometries.boxPos,
        geometries.boxNorm
      );

      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const rawName = model ? model.name.replace(/\.[^/.]+$/, '') : 'star';
      link.download = `${rawName}_mold_box.stl`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error exporting unified STL: ' + e);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfdfc] flex flex-col font-sans antialiased text-black select-none">
      {/* Visual Header */}
      <Header />

      {/* Main App Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: 3D Preview (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4 self-stretch">
          {/* Real-time 3D Preview Frame */}
          <div className="flex-1 bg-white p-4 rounded-none border-2 border-black flex flex-col min-h-[440px] relative">
            <div className="flex items-center justify-between mb-3.5 border-b border-black pb-2">
              <span className="text-xs font-black text-black uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Sparkles size={14} className="text-[#f97316]" />
                <span>Interactive 3D Mold View</span>
              </span>
              <span className="text-[10px] text-white font-mono font-bold bg-[#f97316] border border-black py-0.5 px-2 rounded-none">
                Real-Time CAD Engine
              </span>
            </div>

            <div className="flex-grow w-full min-h-[400px] relative flex flex-col">
              {model && (
                <MoldBoxPreview
                   model={model}
                   transform={transform}
                   settings={settings}
                   onDimensionsUpdate={setDimensions}
                   onGeometriesGenerated={setGeometries}
                />
              )}
            </div>
          </div>

          {/* Dynamic Technical Data Box & STL Export */}
          <div className="bg-white rounded-none border-2 border-black p-5 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Model Dimensions */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-black tracking-widest text-[#f97316] flex items-center gap-1 font-mono">
                <Ruler size={12} /> Model Bounds
              </span>
              <div className="font-mono text-xs font-bold text-black mt-2">
                Width X: {dimensions.modelWidth.toFixed(1)} mm
              </div>
              <div className="font-mono text-xs font-bold text-black">
                Depth Y: {dimensions.modelDepth.toFixed(1)} mm
              </div>
              <div className="font-mono text-xs font-bold text-black">
                Height Z: {dimensions.modelHeight.toFixed(1)} mm
              </div>
            </div>

            {/* Box Physical Dimensions */}
            <div className="space-y-1 border-t md:border-t-0 md:border-l-2 border-dashed border-black md:pl-5">
              <span className="text-[10px] uppercase font-black tracking-widest text-[#f97316] flex items-center gap-1 font-mono">
                <Layers size={12} /> Mold Outer Limit
              </span>
              <div className="font-mono text-xs font-bold text-black mt-2">
                Width X: <span className="font-black text-black">{dimensions.boxWidth.toFixed(1)} mm</span>
              </div>
              <div className="font-mono text-xs font-bold text-black">
                Depth Y: <span className="font-black text-black">{dimensions.boxDepth.toFixed(1)} mm</span>
              </div>
              <div className="font-mono text-xs font-bold text-black">
                Height Z: <span className="font-black text-black">{dimensions.boxHeight.toFixed(1)} mm</span>
              </div>
            </div>

            {/* Export Target Trigger */}
            <div className="pt-2 md:pt-0 border-t md:border-t-0 md:border-l-2 border-dashed border-black md:pl-5">
              <button
                id="export-stl-btn"
                onClick={handleExportSTL}
                className="w-full bg-[#f97316] hover:bg-black text-white font-black py-3 px-4 rounded-none border-2 border-black h-12 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs cursor-pointer"
                title="Combine tray and model into single watertight STL"
              >
                <Download size={16} className="stroke-[2.5]" />
                <span>Export STL</span>
              </button>
              <p className="text-[9px] text-[#f97316]/80 font-mono mt-1.5 font-bold uppercase tracking-wider pl-1">
                3D Print Ready file download
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Control Parameters (5 cols) */}
        <div className="lg:col-span-5 self-stretch">
          <ControlPanel
            model={model}
            onModelLoaded={setModel}
            transform={transform}
            onTransformChange={setTransform}
            settings={settings}
            onSettingsChange={setSettings}
          />
        </div>
      </main>

      {/* Humble Aesthetic Footer */}
      <footer className="border-t-2 border-black mt-12 py-5 text-center text-[10px] tracking-widest uppercase font-black bg-white text-black">
        © 2026 Mold Box Generator. Open-top container CAD utility for Plaster Casting.
      </footer>
    </div>
  );
}
