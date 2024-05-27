import { nodewhisper } from "./whisper/index.js";

async function main () {
	const args = process.argv;
	// const output = await nodewhisper('/home/scal/dev/nodejs-whisper/fr.wav', {
	const output = await nodewhisper('/home/scal/dev/ollama/output.mp3', {
		modelName: args[2] ?? 'tiny',
		autoDownloadModelName: args[2] ?? 'tiny',
		verbose: false,
	});

	console.log('output', output);
}

void main();