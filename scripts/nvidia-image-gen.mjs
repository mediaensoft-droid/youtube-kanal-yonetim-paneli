#!/usr/bin/env node
// Generates an image via NVIDIA's build.nvidia.com NIM API Catalog (FLUX.1-dev by default) and
// saves it to disk. A design-tooling helper — not part of the app's runtime.
//
// Usage:
//   node scripts/nvidia-image-gen.mjs "a prompt describing the image" [output-path] [--model=<nim-model-id>]
//
// Requires NVIDIA_API_KEY in the environment (see .env.local). Reads it directly from
// process.env, so run via `node --env-file=.env.local scripts/nvidia-image-gen.mjs ...` or
// export it in the shell first.

const DEFAULT_MODEL = "black-forest-labs/flux.1-dev";

function parseArgs(argv) {
  const positional = [];
  let model = DEFAULT_MODEL;
  for (const arg of argv) {
    if (arg.startsWith("--model=")) model = arg.slice("--model=".length);
    else positional.push(arg);
  }
  const [prompt, outputPath = `generated-${Date.now()}.jpg`] = positional;
  return { prompt, outputPath, model };
}

async function main() {
  const { prompt, outputPath, model } = parseArgs(process.argv.slice(2));
  if (!prompt) {
    console.error('Usage: node scripts/nvidia-image-gen.mjs "prompt" [output-path] [--model=org/model]');
    process.exit(1);
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    console.error("NVIDIA_API_KEY is not set. Add it to .env.local and pass --env-file=.env.local to node.");
    process.exit(1);
  }

  const res = await fetch(`https://ai.api.nvidia.com/v1/genai/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      mode: "base",
      width: 1024,
      height: 1024,
      cfg_scale: 5,
      steps: 50,
      seed: 0,
      samples: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`NVIDIA API error ${res.status}: ${text}`);
    process.exit(1);
  }

  const data = await res.json();
  const artifact = data.artifacts?.[0];
  if (!artifact || artifact.finishReason !== "SUCCESS" || !artifact.base64) {
    console.error(`Generation did not succeed: ${JSON.stringify(data)}`);
    process.exit(1);
  }

  const fs = await import("node:fs/promises");
  await fs.writeFile(outputPath, Buffer.from(artifact.base64, "base64"));
  console.log(`Saved: ${outputPath}`);
}

main();
