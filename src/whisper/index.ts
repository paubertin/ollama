import { WhisperOptions } from './types.js'
import { executeCppCommand } from './whisper.js'
import { constructCommand } from './WhisperHelper.js'
import { checkIfFileExists, convertToWavType } from './utils.js'
import autoDownloadModel from './autoDownloadModel.js'
import { existsSync, unlinkSync } from 'fs'

export interface IOptions {
	modelName: string
	autoDownloadModelName?: string
	whisperOptions?: WhisperOptions
	withCuda?: boolean
	verbose?: boolean
	removeWavFileAfterTranscription?: boolean
}

export async function nodewhisper(filePath: string, options: IOptions) {
	try {
		const { verbose = false, removeWavFileAfterTranscription = false } = options

		if (options.autoDownloadModelName) {
			if (verbose)
				console.log(
					`[Nodejs-whisper] Checking and downloading model if needed: ${options.autoDownloadModelName}`
				)
			console.log('autoDownloadModelName', options.autoDownloadModelName)
			console.log('options', options)

			await autoDownloadModel(options.autoDownloadModelName, verbose, options.withCuda)
		}

		console.log('cwd', process.cwd());
		if (verbose) console.log(`[Nodejs-whisper] Checking file existence: ${filePath}`)
		checkIfFileExists(filePath)

		if (verbose) console.log(`[Nodejs-whisper] Converting file to WAV format: ${filePath}`)
		const outputFilePath = await convertToWavType(filePath, verbose)

		if (verbose) console.log(`[Nodejs-whisper] Constructing command for file: ${outputFilePath}`)
		const command = constructCommand(outputFilePath, options)

		if (verbose) console.log(`[Nodejs-whisper] Executing command: ${command}`)
		const transcript = await executeCppCommand(command, verbose, options.withCuda)

		if (!transcript) {
			throw new Error('Transcription failed or produced no output.')
		}

		if (removeWavFileAfterTranscription && existsSync(outputFilePath)) {
			if (verbose) console.log(`[Nodejs-whisper] Removing temporary WAV file: ${outputFilePath}`)
				unlinkSync(outputFilePath);
		}

		return transcript
	} catch (error) {
		console.error(`[Nodejs-whisper] Error during processing: ${error.message}`)
		throw new Error(`Operation failed: ${error.message}`)
	}
}