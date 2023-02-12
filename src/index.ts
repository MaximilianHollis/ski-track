import got from 'got'
import { Server } from 'socket.io'
import mongoose from 'mongoose'
import cron from 'node-cron'
import { Box } from './interfaces'
import { get_line_data, get_screenshot } from './feed_capture'
import log from './schemas/log'
import { getAll } from './data'

let cache: Box[] = []

const labels = ['person', 'skis', 'snowboard', 'snowmobile', 'snow gun']

const io = new Server(3000, {
	cors: {
		origin: 'http://localhost:5173',
	},
})

cron.schedule('*/10 * * * * *', async () => {
	console.time('query')
	const image = await get_screenshot()

	const line = await get_line_data(image)

	const data = await query(line.toString('base64'))
	const dimensions: { height: number; width: number; type?: string } = {
		height: 1080,
		width: 1920,
		type: 'jpg',
	}

	console.log(data.length, 'objects found')

	const boxes: Box[] = data
		.map(({ box, ...rest }) => ({
			...rest,
			box: {
				xmax: (box.xmax / dimensions.width) * 100,
				xmin: (box.xmin / dimensions.width) * 100,
				ymax: ((box.ymax + 620) / dimensions.height) * 100,
				ymin: ((box.ymin + 620) / dimensions.height) * 100,
			},
			label: bodge(rest.label),
		}))
		.filter((t) => labels.includes(t.label))

	// Remove boxes overlapping nearly completely with other boxes
	const filtered_boxes: Box[] = []
	for (const box of boxes) {
		const overlaps = filtered_boxes.filter((t) => {
			const x_overlap =
				Math.max(
					0,
					Math.min(box.box.xmax, t.box.xmax) -
						Math.max(box.box.xmin, t.box.xmin),
				) / Math.min(box.box.xmax - box.box.xmin, t.box.xmax - t.box.xmin)
			const y_overlap =
				Math.max(
					0,
					Math.min(box.box.ymax, t.box.ymax) -
						Math.max(box.box.ymin, t.box.ymin),
				) / Math.min(box.box.ymax - box.box.ymin, t.box.ymax - t.box.ymin)

			return (
				(x_overlap > 0.5 && y_overlap > 0.5 && box.score < 0.8) ||
				(x_overlap > 0.9 && y_overlap > 0.9 && box.score < 0.9) ||
				box.score > 0.92
			)
		})

		if (overlaps.length === 0) {
			filtered_boxes.push(box)
		}
	}

	console.log(data.length - filtered_boxes.length, 'objects filtered')

	// Log to database
	const log_entry = new log({
		count: filtered_boxes.filter((t) => t.label === 'person').length,
	})

	log_entry.save()

	cache = filtered_boxes
	io.emit('data', filtered_boxes)
	const logs = await getAll('day', 'hour')
	io.emit('logs', logs)
	console.timeEnd('query')
})

async function query(image: string): Promise<Box[]> {
	const { body } = await got.post('http://127.0.0.1:5000/inference/object', {
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			threshold: 0.7,
			image,
		}),
	})

	return JSON.parse(body)
}

const bodge = (label: string) => {
	if (label === 'traffic light') {
		return 'snow gun'
	}

	return label
}

io.on('connection', async (socket) => {
	socket.emit('test', { hello: 'world' })
	socket.emit('data', cache)
	const logs = await getAll('quarter_hour')
	socket.emit('logs', logs)
})
mongoose.connect(
	`mongodb+srv://admin:${process.env.PASS}@cluster0.kquzvrd.mongodb.net/whitetail-express?retryWrites=true&w=majority`,
	(e) => {
		if (e) {
			console.error(e)
		} else {
			console.log('Connected to database')
		}
	},
)
