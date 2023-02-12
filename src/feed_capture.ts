import { spawn } from 'child_process'
import {
	createWriteStream,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from 'fs'
import got from 'got'
import sharp from 'sharp'

const base_url =
	'https://63034befe01e5.streamlock.net:444/whitetailkmc/whitetailkmc.stream'

export const get_screenshot = async () => {
	// Delete old files
	rmSync('frames/frame.jpg', { force: true })

	const chunklist_url = `${base_url}/playlist.m3u8`

	// Save chunklist to file
	const chunk = (await got(chunklist_url)).body
		.split('\n')
		.find((l) => l.includes('chunklist'))

	if (!chunk) {
		throw new Error('Could not find chunklist')
	}

	const vnd_url = `${base_url}/${chunk}`

	const vnd = (await got(vnd_url)).body
		.split('\n')
		.find((l) => l.includes('media_w'))

	const stream_url = `${base_url}/${vnd}`

	// Download stream as blob
	const stream = got.get(stream_url, {
		responseType: 'buffer',
	})
	console.log('Downloading stream...')
	const stream_buffer = await stream.buffer()
	console.log('Downloaded stream')

	// Save stream to file
	const stream_file = createWriteStream('streams/stream.ts')
	stream_file.write(stream_buffer)
	stream_file.end()
	console.log('Saved stream to file')

	console.time('ffmpeg')
	// What the fuck do these options do
	const ffmpeg = spawn('ffmpeg', [
		'-i',
		'streams/stream.ts',
		'-ss',
		'00:00:00.000',
		'-vframes',
		'1',
		'frames/frame.jpg',
	])

	// Wait for ffmpeg to finish
	await new Promise((resolve) => {
		ffmpeg.on('close', () => {
			console.timeEnd('ffmpeg')
			resolve(null)
		})
	})

	return readFileSync('frames/frame.jpg')
}

export const get_line_data = async (buffer: Buffer) => {
	const img = await sharp(buffer)
		.extract({ left: 0, top: 620, width: 1600, height: 460 })
		.toBuffer()
	return img
}

export const get_lift_data = async () => {
	const { body } = await got.get('https://www.whitetailresort.com/api/v1/lifts')

	return JSON.parse(body)
}
