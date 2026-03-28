import { FaustCompiler, FaustMonoDspGenerator, FaustPolyDspGenerator, LibFaust } from "@grame/faustwasm";
import { FAUST_CONFIG } from '../config';

let compiler: FaustCompiler | null = null;
let libFaust: LibFaust | null = null;

// Initialize a local instance for VFS utility functions and mixerModule extraction
export const initFaust = async () => {
  if (compiler) return { compiler, libFaust };

  const baseUrl = FAUST_CONFIG.wasmBaseUrl;
  const jsFile = `${baseUrl}libfaust-wasm.js`;
  const dataFile = `${baseUrl}libfaust-wasm.data`;
  const wasmFile = `${baseUrl}libfaust-wasm.wasm`;

  const [jsCodeRaw, dataBinary, wasmBinary] = await Promise.all([
    fetch(jsFile).then(r => r.text()),
    fetch(dataFile).then(r => r.arrayBuffer()),
    fetch(wasmFile).then(r => r.arrayBuffer())
  ]);

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
    
    return { compiler, libFaust };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
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

// --- Web Worker Orchestration ---

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

let compileIdCounter = 0;
const pendingCompilations = new Map<number, { resolve: Function, reject: Function }>();

worker.onmessage = (e) => {
  const data = e.data;
  const pending = pendingCompilations.get(data.id);
  if (!pending) return;
  
  if (data.status === 'success') {
    pending.resolve(data);
  } else {
    pending.reject(new Error(data.error));
  }
  pendingCompilations.delete(data.id);
};

worker.onerror = (e) => {
  console.error("Faust Web Worker Error:", e);
};

export const compileDSP = async (code: string, audioCtx: AudioContext, type: 'poly' | 'mono' = 'poly') => {
  // We need the local compiler initialized to get the mixerModule for polyphonic node creation
  const { compiler } = await initFaust();
  if (!compiler) throw new Error("Local Faust compiler not initialized");

  const compileId = compileIdCounter++;
  
  // Offload heavy compilation to the Web Worker
  const workerPromise = new Promise<any>((resolve, reject) => {
    pendingCompilations.set(compileId, { resolve, reject });
    worker.postMessage({ id: compileId, code, type });
  });

  const workerResult = await workerPromise;

  const name = "FaustDSP";
  let node: any;

  try {
    if (type === 'poly') {
      const generator = new FaustPolyDspGenerator();
      const { mixerModule } = await compiler.getAsyncInternalMixerModule();
      
      const voiceFactory = {
        code: workerResult.voiceFactory.code,
        json: workerResult.voiceFactory.json,
        module: await WebAssembly.compile(workerResult.voiceFactory.code),
        poly: true
      };
      
      let effectFactory = null;
      if (workerResult.effectFactory) {
        effectFactory = {
          code: workerResult.effectFactory.code,
          json: workerResult.effectFactory.json,
          module: await WebAssembly.compile(workerResult.effectFactory.code),
          poly: false
        };
      }

      node = await generator.createNode(
        audioCtx,
        FAUST_CONFIG.polyVoiceCount,
        name,
        voiceFactory,
        mixerModule,
        effectFactory
      );
    } else {
      const generator = new FaustMonoDspGenerator();
      
      const factory = {
        code: workerResult.factory.code,
        json: workerResult.factory.json,
        module: await WebAssembly.compile(workerResult.factory.code),
        poly: false
      };

      node = await generator.createNode(
        audioCtx,
        name,
        factory
      );
    }

    return { node, svg: workerResult.svg, ui: workerResult.ui };
  } catch (error: any) {
    console.error("Faust Compilation Node Creation Error:", error);
    throw error;
  }
};
