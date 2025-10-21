// serial port configuration choices
export const LINK_TYPE = ['SERIAL', 'UDP', 'TCP_SERVER', 'TCP_CLIENT'].map((v) => {
	return {id: v, label:v}
})

export const BAUD_RATES = [9600, 14400, 19200, 38400, 57600, 115200, 110, 300, 1200, 2400, 4800].map((v) => {
	return { id: v, label: v + ' Baud' }
})

export const BITS = [8, 7, 6, 5].map((v) => {
	return { id: v, label: v + ' Bits' }
})

export const PARITY = ['None', 'Even', 'Odd', 'Mark', 'Space'].map((v) => {
	return { id: v.toLowerCase(), label: v }
})

export const STOP = [1, 2].map((v) => {
	return { id: v, label: v + ' Bits' }
})


export const VISCA_PROTOCOL = ['SERIAL', 'IP_Device', 'IP_Controler'].map((v) => {
	return {id: v, label: 'VISCA OVER ' + v}
})