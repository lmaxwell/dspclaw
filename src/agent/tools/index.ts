import { readFaustCode } from "./read_faust_code";
import { updateFaustCode } from "./update_faust_code";
import { compileAndRun } from "./compile_and_run";
import { listStdlibFiles } from "./list_stdlib_files";
import { readStdlibFile } from "./read_stdlib_file";

export const tools = [
  readFaustCode,
  updateFaustCode,
  compileAndRun,
  listStdlibFiles,
  readStdlibFile,
];
