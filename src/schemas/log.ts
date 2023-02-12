import mongoose from 'mongoose'
import { ILog } from '../interfaces'

const { Schema } = mongoose

const logSchema = new Schema<ILog>({
	timestamp: {
		type: Date,
		default: Date.now,
	},
	count: {
		type: Number,
		required: true,
	},
})

export default mongoose.model<ILog>('Log', logSchema)
