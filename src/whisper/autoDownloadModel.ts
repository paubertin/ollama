import path from 'path'
import shell from 'shelljs'
import fs from 'fs'
import { MODELS_LIST, MODELS, MODEL_OBJECT } from './constants.js'
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

export default async function autoDownloadModel(
	autoDownloadModelName?: string,
	verbose?: boolean,
	withCuda: boolean = false
) {
	const projectDir = process.cwd()

	if (!autoDownloadModelName) {
		throw new Error('[Nodejs-whisper] Error: Model name must be provided.')
	}

	if (!MODELS_LIST.includes(autoDownloadModelName)) {
		throw new Error('[Nodejs-whisper] Error: Provide a valid model name')
	}

	try {
		const modelDirectory = path.join(__dirname, '..', 'cpp', 'whisper.cpp', 'models')
		shell.cd(modelDirectory)

		const existingModel = MODELS.filter(model => fs.existsSync(path.join(modelDirectory, model))).filter((model) => model === MODEL_OBJECT[autoDownloadModelName]);

		console.log('existing', existingModel);

		if (existingModel.length > 0) {
			if (verbose) {
				console.log('[Nodejs-whisper] Models already exist. Skipping download.')
			}
			return 'Models already exist. Skipping download.'
		}

		console.log(`[Nodejs-whisper] Auto-download Model: ${autoDownloadModelName}`)
		let scriptPath = './download-ggml-model.sh'
		if (process.platform === 'win32') {
			scriptPath = 'download-ggml-model.cmd'
		}

		shell.chmod('+x', scriptPath)
		const result = shell.exec(`${scriptPath} ${autoDownloadModelName}`, { silent: !verbose })

		if (result.code !== 0) {
			throw new Error(`[Nodejs-whisper] Failed to download model: ${result.stderr}`)
		}

		console.log('[Nodejs-whisper] Attempting to compile model...')
		shell.cd('../')

		const compileCommand = withCuda ? 'WHISPER_CUDA=1 make -j' : 'make -j'
		const compileResult = shell.exec(compileCommand, { silent: !verbose })

		if (compileResult.code !== 0) {
			throw new Error(`[Nodejs-whisper] Failed to compile model: ${compileResult.stderr}`)
		}

		return 'Model downloaded and compiled successfully'
	} catch (error) {
		console.error('[Nodejs-whisper] Error caught in autoDownloadModel:', error)
		shell.cd(projectDir)
		throw error
	}
	finally {
		shell.cd(projectDir)

	}
}
