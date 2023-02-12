import { Document } from 'mongoose'

export interface Box {
	score: number
	label: string
	box: {
		xmin: number
		ymin: number
		xmax: number
		ymax: number
	}
}

export interface ILog extends Document {
	timestamp: Date
	count: number
}
