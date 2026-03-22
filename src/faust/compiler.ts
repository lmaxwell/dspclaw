import { FaustCompiler, FaustMonoDspGenerator, FaustPolyDspGenerator, LibFaust, instantiateFaustModuleFromFile, FaustSvgDiagrams } from "@grame/faustwasm";

let compiler: FaustCompiler | null = null;
let libFaust: LibFaust | null = null;
let svgDiagrams: FaustSvgDiagrams | null = null;

export const initFaust = async () => {
  if (compiler) return { compiler, libFaust };

  // Use relative path for Electron compatibility
  const baseUrl = "./faustwasm/";
  
  const module = await instantiateFaustModuleFromFile(
    `${baseUrl}libfaust-wasm.js`,
    `${baseUrl}libfaust-wasm.data`,
    `${baseUrl}libfaust-wasm.wasm`
  );
  
  libFaust = new LibFaust(module);
  compiler = new FaustCompiler(libFaust);
  svgDiagrams = new FaustSvgDiagrams(compiler);
  
  return { compiler, libFaust };
};

export const readVFSFile = (path: string) => {
  if (!libFaust) return null;
  try {
    return libFaust.fs().readFile(path, { encoding: "utf8" });
  } catch (e) {
    console.error(`Error reading VFS file ${path}:`, e);
    return null;
  }
};

export const listVFSFiles = (path: string) => {
  if (!libFaust) return [];
  try {
    return libFaust.fs().readdir(path).filter((f: string) => f !== "." && f !== "..");
  } catch (e) {
    console.error(`Error listing VFS directory ${path}:`, e);
    return [];
  }
};

export const compileDSP = async (code: string, audioCtx: AudioContext, type: 'poly' | 'mono' = 'poly') => {
  const { compiler } = await initFaust();
  if (!compiler || !svgDiagrams) throw new Error("Faust compiler not initialized");

  const name = "FaustDSP";
  const args = ["-I", "libraries/"];
  
  try {
    const generator = type === 'poly' ? new FaustPolyDspGenerator() : new FaustMonoDspGenerator();
    const dsp = await generator.compile(compiler, name, code, args.join(" "));
    
    if (!dsp) throw new Error("Compilation failed");

    const svgMap = svgDiagrams.from(name, code, args.join(" "));
    const svgKeys = Object.keys(svgMap);
    const svgKey = svgKeys.find(k => k === "process.svg") || 
                   svgKeys.find(k => k === `${name}.svg`) || 
                   svgKeys.find(k => k.endsWith(".svg"));
    
    const svgRaw = svgKey ? svgMap[svgKey] : null;
    const svg = svgRaw 
      ? svgRaw.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/g, "").trim()
      : null;
    
    const ui = JSON.parse(dsp.getJSON()).ui;

    // Poly mode gets 4 voices, Mono mode gets 1 (default)
    let node: any;
    if (type === 'poly') {
      node = await (dsp as FaustPolyDspGenerator).createNode(audioCtx, 4);
    } else {
      node = await (dsp as FaustMonoDspGenerator).createNode(audioCtx);
    }

    return { node, svg, ui };
  } catch (error: any) {
    console.error("Faust Compilation Error:", error);
    throw error;
  }
};
