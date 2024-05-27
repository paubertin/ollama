#! /usr/bin/env node

// npx nodejs-whisper download

import path from 'path'
import shell from "shelljs";
import { MODELS_LIST, DEFAULT_MODEL, MODELS } from './constants.js'
import fs, { readlinkSync } from 'fs'
import { createInterface } from 'readline/promises';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const askForModel = async (): Promise<string> => {
	const rl = createInterface({ input: process.stdin, output: process.stdout });

	const answer = await rl.question(
		`\n[Nodejs-whisper] Enter model name (e.g. 'tiny.en') or 'cancel' to exit\n(ENTER for tiny.en): `
	)

	if (answer === 'cancel') {
		console.log('[Nodejs-whisper] Exiting model downloader.\n')
		process.exit(0)
	}
	// User presses enter
	else if (answer === '') {
		console.log('[Nodejs-whisper] Going with', DEFAULT_MODEL)
		return DEFAULT_MODEL
	} else if (!MODELS_LIST.includes(answer)) {
		console.log(
			'\n[Nodejs-whisper] FAIL: Name not found. Check your spelling OR quit wizard and use custom model.\n'
		)

		return await askForModel()
	}

	return answer
}

const askIfUserWantToUseCuda = async () => {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const answer = await rl.question(
		`\n[Nodejs-whisper] Do you want to use CUDA for compilation? (y/n)\n(ENTER for n): `
	)

	if (answer === 'y') {
		console.log('[Nodejs-whisper] Using CUDA for compilation.')
		return true
	} else {
		console.log('[Nodejs-whisper] Not using CUDA for compilation.')
		return false
	}
}

export default async function downloadModel() {
	try {
		shell.cd(path.join(__dirname, '..', './cpp/whisper.cpp/models'))

		let anyModelExist: any[] = []

		MODELS.forEach(model => {
			if (!fs.existsSync(path.join(__dirname, '..', `./cpp/whisper.cpp/models/${model}`))) {
			}
			else {
				anyModelExist.push(model)
			}
		})

		if (anyModelExist.length > 0) {
			return
			// console.log('Models already exist. Skipping download.')
		} else {
			console.log('[Nodejs-whisper] Models do not exist. Please Select a model to download.\n')
		}

		console.log(`
| Model     | Disk   | RAM     |
|-----------|--------|---------|
| tiny      |  75 MB | ~390 MB |
| tiny.en   |  75 MB | ~390 MB |
| base      | 142 MB | ~500 MB |
| base.en   | 142 MB | ~500 MB |
| small     | 466 MB | ~1.0 GB |
| small.en  | 466 MB | ~1.0 GB |
| medium    | 1.5 GB | ~2.6 GB |
| medium.en | 1.5 GB | ~2.6 GB |
| large-v1  | 2.9 GB | ~4.7 GB |
| large     | 2.9 GB | ~4.7 GB |
`)

		if (!shell.which('./download-ggml-model.sh')) {
			throw '[Nodejs-whisper] Error: Downloader not found.\n'
		}

		const modelName = await askForModel()

		let scriptPath = './download-ggml-model.sh'

		if (process.platform === 'win32') scriptPath = 'download-ggml-model.cmd'

		shell.chmod('+x', scriptPath)
		shell.exec(`${scriptPath} ${modelName}`)

		console.log('[Nodejs-whisper] Attempting to compile model...\n')

		shell.cd('../')

		const withCuda = await askIfUserWantToUseCuda()

		if (withCuda) {
			shell.exec('WHISPER_CUDA=1 make -j')
		} else {
			shell.exec('make -j')
		}

		process.exit(0)
	} catch (error) {
		console.log('[Nodejs-whisper] Error Caught in downloadModel\n')
		console.log(error)
		return error
	}
}
// run on npx nodejs-whisper download
downloadModel()
