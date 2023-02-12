import mongoose from 'mongoose'
import { DateTime } from 'luxon'
import { ILog } from './interfaces'

type time = 'minute' | 'quarter_hour' | 'half_hour' | 'hour' | 'day'

export const getAll = async (
	interval: time,
	unit: 'minute' | 'hour' | 'day' = 'minute',
) => {
	// Get all documents in the collection
	const timestamp = new Date()
	switch (interval) {
		case 'minute':
			timestamp.setMinutes(timestamp.getMinutes() - 1)
			break
		case 'quarter_hour':
			timestamp.setMinutes(timestamp.getMinutes() - 15)
			break
		case 'half_hour':
			timestamp.setMinutes(timestamp.getMinutes() - 30)
			break
		case 'hour':
			timestamp.setHours(timestamp.getHours() - 1)
			break
		case 'day':
			timestamp.setDate(timestamp.getDate() - 1)
			break
		default:
			timestamp.setMinutes(timestamp.getMinutes() - 1)
			break
	}

	const docs = await mongoose.model('Log').find({
		timestamp: {
			$gte: timestamp,
		},
	})

	// Group all collected documents by time unit
	const groups: {
		[key: number | string]: ILog[]
	} = {}

	for (const doc of docs) {
		const date = DateTime.fromJSDate(doc.timestamp)
		const key = date[unit]
		if (groups[key]) {
			groups[key].push(doc)
		} else {
			groups[key] = [doc]
		}
	}

	const counts: {
		[key: number | string]: number
	} = {}

	Object.entries(groups).forEach(([key, value]) => {
		counts[key] = Math.floor(
			value.reduce((acc, cur) => acc + cur.count, 0) / value.length,
		)
	})

	return counts
}
