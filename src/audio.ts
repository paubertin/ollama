import { nodewhisper } from "./whisper/index.js";

async function main () {
	const args = process.argv;
	// const output = await nodewhisper('/home/scal/dev/nodejs-whisper/fr.wav', {
	const output = await nodewhisper('/media/scal/Data1/scal/dev/ollama/output.wav', {
		modelName: args[2] ?? 'tiny',
		autoDownloadModelName: args[2] ?? 'tiny',
		verbose: true,
	});

	console.log('output', output);
}

void main();