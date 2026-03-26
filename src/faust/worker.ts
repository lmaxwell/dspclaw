import {
  FaustCompiler,
  FaustMonoDspGenerator,
  FaustPolyDspGenerator,
  LibFaust,
  FaustSvgDiagrams
} from "@grame/faustwasm";

let compiler: FaustCompiler | null = null;
let libFaust: LibFaust | null = null;
let svgDiagrams: FaustSvgDiagrams | null = null;

const initFaust = async () => {
  if (compiler) return { compiler, libFaust, svgDiagrams };

  const baseUrl = `${location.origin}/faustwasm/`;
  const jsFile = `${baseUrl}libfaust-wasm.js`;
  const dataFile = `${baseUrl}libfaust-wasm.data`;
  const wasmFile = `${baseUrl}libfaust-wasm.wasm`;

  // Fetch all assets
  const [jsCodeRaw, dataBinary, wasmBinary] = await Promise.all([
    fetch(jsFile).then(r => r.text()),
    fetch(dataFile).then(r => r.arrayBuffer()),
    fetch(wasmFile).then(r => r.arrayBuffer())
  ]);

  // The Emscripten wrapper needs to be modified to export the factory function.
  // We mirror the logic found in the faustwasm library but ensure it works in Worker.
  const jsCodeHead = /var (.+) = \(/;
  const match = jsCodeRaw.match(jsCodeHead);
  if (!match) throw new Error("Could not find Emscripten module name in libfaust-wasm.js");
  
  const moduleName = match[1];
  const jsCodeMod = `${jsCodeRaw}\nexport default ${moduleName};`;
  
  const blob = new Blob([jsCodeMod], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  
  try {
    const { default: createModule } = await import(/* @vite-ignore */ blobUrl);
    
    const module = await createModule({
      wasmBinary,
      getPreloadedPackage: (name: string, _size: number) => {
        if (name === "libfaust-wasm.data") return dataBinary;
        return new ArrayBuffer(0);
      }
    });
    
    libFaust = new LibFaust(module);
    compiler = new FaustCompiler(libFaust);
    svgDiagrams = new FaustSvgDiagrams(compiler);
    
    return { compiler, libFaust, svgDiagrams };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

// Listen for messages from the main thread
self.onmessage = async (e: MessageEvent) => {
  const { id, code, type } = e.data;

  try {
    const { compiler, svgDiagrams } = await initFaust();
    if (!compiler || !svgDiagrams) throw new Error("Faust compiler not initialized in worker");

    const name = "FaustDSP";
    const args = ["-I", "libraries/"];

    let workerResult: any = { id, type, svg: null, ui: null };

    // Generate SVG
    const svgMap = svgDiagrams.from(name, code, args.join(" "));
    const svgKeys = Object.keys(svgMap);
    const svgKey = svgKeys.find(k => k === "process.svg") || 
                   svgKeys.find(k => k === `${name}.svg`) || 
                   svgKeys.find(k => k.endsWith(".svg"));
    
    const svgRaw = svgKey ? svgMap[svgKey] : null;
    workerResult.svg = svgRaw 
      ? svgRaw.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/g, "").trim()
      : null;

    if (type === 'poly') {
      const generator = new FaustPolyDspGenerator();
      await generator.compile(compiler, name, code, args.join(" "));
      
      // Extract the raw WebAssembly code (Uint8Array) and JSON strings to send back
      workerResult.ui = JSON.parse(generator.voiceFactory!.json).ui;
      workerResult.voiceFactory = {
        code: generator.voiceFactory!.code,
        json: generator.voiceFactory!.json,
      };
      
      if (generator.effectFactory) {
        workerResult.effectFactory = {
          code: generator.effectFactory.code,
          json: generator.effectFactory.json,
        };
      }
    } else {
      const generator = new FaustMonoDspGenerator();
      await generator.compile(compiler, name, code, args.join(" "));
      
      workerResult.ui = JSON.parse(generator.factory!.json).ui;
      workerResult.factory = {
        code: generator.factory!.code,
        json: generator.factory!.json,
      };
    }

    self.postMessage({ status: 'success', ...workerResult });
  } catch (error: any) {
    self.postMessage({ id, status: 'error', error: error.message || error.toString() });
  }
};
