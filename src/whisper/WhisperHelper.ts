import path from 'path'

import fs from 'fs'
import { MODELS_LIST, MODEL_OBJECT } from './constants.js'
import { IOptions } from '.'
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

export const constructCommand = (filePath: string, args: IOptions): string => {
	let errors: string[] = []

	if (!args.modelName) {
		errors.push('[Nodejs-whisper] Error: Provide model name')
	}

	if (!MODELS_LIST.includes(args.modelName)) {
		errors.push(`[Nodejs-whisper] Error: Enter a valid model name. Available models are: ${MODELS_LIST.join(', ')}`)
	}

	const modelPath = path.join(__dirname, '..', 'cpp', 'whisper.cpp', 'models', MODEL_OBJECT[args.modelName])
	if (!fs.existsSync(modelPath)) {
		errors.push(
			'[Nodejs-whisper] Error: Model file does not exist. Please ensure the model is downloaded and correctly placed.'
		)
	}

	if (errors.length > 0) {
		throw new Error(errors.join('\n'))
	}

	const modelName = MODEL_OBJECT[args.modelName as keyof typeof MODEL_OBJECT]
	let command = `./main  ${constructOptionsFlags(args)} -l auto -m ./models/${modelName}  -f ${filePath}`

	return command
}

const constructOptionsFlags = (args: IOptions): string => {
	let flags = [
		args.whisperOptions?.outputInText ? '-otxt ' : '',
		args.whisperOptions?.outputInVtt ? '-ovtt ' : '',
		args.whisperOptions?.outputInSrt ? '-osrt ' : '',
		args.whisperOptions?.outputInCsv ? '-ocsv ' : '',
		args.whisperOptions?.translateToEnglish ? '-tr ' : '',
		args.whisperOptions?.wordTimestamps ? '-ml 1 ' : '',
		args.whisperOptions?.timestamps_length ? `-ml ${args.whisperOptions.timestamps_length} ` : '',
		args.whisperOptions?.splitOnWord ? '-sow true ' : '',
		'-l fr ',
		// '-nt'
	].join('')

	return flags.trim()
}
