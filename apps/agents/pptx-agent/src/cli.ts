import 'dotenv/config';
import { runAgentLoop } from './agent/loop.js';
import { initDocs } from './services/docs.js';
import { resetState } from './services/presentation.js';

const args = process.argv.slice(2);

function parseArgs() {
    let prompt = '';
    let model: string | undefined;
    let outputDir: string | undefined;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--model' && args[i + 1]) {
            model = args[++i];
        } else if (args[i] === '--output' && args[i + 1]) {
            outputDir = args[++i];
        } else if (!args[i].startsWith('--')) {
            prompt = args[i];
        }
    }

    return { prompt, model, outputDir };
}

async function main() {
    const { prompt, model, outputDir } = parseArgs();

    if (!prompt) {
        console.error('Usage: pnpm cli "Your presentation prompt" [--model your-model-id] [--output ./output]');
        process.exit(1);
    }

    if (outputDir) {
        process.env.PPTX_AGENT_OUTPUT_DIR = outputDir;
    }

    initDocs();
    resetState();

    console.log(`\nGenerating presentation...\n`);
    console.log(`Prompt: ${prompt}`);
    console.log(`Model: ${model || process.env.PPTX_AGENT_MODEL || process.env.DEFAULT_LLM_MODEL || '(from env)'}\n`);

    try {
        const result = await runAgentLoop(prompt, model, (msg) => {
            console.log(`  ${msg}`);
        });

        console.log(`\nDone!`);
        console.log(`  File: ${result.filePath}`);
        console.log(`  Slides: ${result.slideCount}`);
    } catch (e) {
        console.error(`\nError: ${(e as Error).message}`);
        process.exit(1);
    }
}

main();
