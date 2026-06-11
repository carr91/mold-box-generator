import { Box } from 'lucide-react';

export default function Header() {
  return (
    <header className="border-b-2 border-black flex flex-col md:flex-row items-center justify-between px-8 py-4 md:py-0 md:h-20 bg-white sticky top-0 z-50">
      <div className="flex items-baseline gap-4">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none text-black">
          Mold Box
        </h1>
        <span className="text-xs font-mono bg-black text-white px-2 py-0.5 font-bold">v1.1.0-beta</span>
      </div>

      <div className="flex flex-wrap justify-center md:justify-end gap-x-10 gap-y-2 text-[10px] uppercase tracking-widest font-bold mt-3 md:mt-0 text-center md:text-left">
        <div className="flex flex-col">
          <span className="text-neutral-400">Mesh Status</span>
          <span className="text-black">Ready for Union</span>
        </div>
        <div className="flex flex-col">
          <span className="text-neutral-400">Print Volume</span>
          <span className="text-black">256 x 256 x 180mm</span>
        </div>
        <div className="flex flex-col text-[#f97316]">
          <span className="text-[#f97316]/70">Target Material</span>
          <span className="text-[#f97316]">Plaster / Gypsum</span>
        </div>
      </div>
    </header>
  );
}

