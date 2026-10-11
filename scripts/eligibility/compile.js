const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const circuitDir = path.join(root, "circuits");
const buildDir = path.join(root, "build");
fs.mkdirSync(buildDir, { recursive: true });

const base = "eligibility";
for (const file of [`${base}.r1cs`, `${base}.sym`]) {
  fs.rmSync(path.join(circuitDir, file), { force: true });
}
fs.rmSync(path.join(circuitDir, `${base}_js`), {
  recursive: true,
  force: true,
});

// The npm Circom WASM package exposes the current directory as its WASI
// preopen. Compile at the project root, then move the generated artifacts into
// build/ so the same command works on Windows, macOS, and Linux.
const result = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules", "circom2", "cli.js"),
    `${base}.circom`,
    "--r1cs",
    "--wasm",
    "--sym",
    "-l",
    path.join(root, "node_modules"),
    "-o",
    ".",
  ],
  { cwd: circuitDir, stdio: "inherit" },
);

if (result.status !== 0) {
  if (result.error) console.error(result.error);
  process.exit(result.status ?? 1);
}

for (const file of [`${base}.r1cs`, `${base}.sym`]) {
  const source = path.join(circuitDir, file);
  const destination = path.join(buildDir, file);
  fs.rmSync(destination, { force: true });
  fs.renameSync(source, destination);
}

const wasmSource = path.join(circuitDir, `${base}_js`);
const wasmDestination = path.join(buildDir, `${base}_js`);
fs.rmSync(wasmDestination, { recursive: true, force: true });
fs.renameSync(wasmSource, wasmDestination);

console.log(`Eligibility circuit artifacts written to ${buildDir}`);
