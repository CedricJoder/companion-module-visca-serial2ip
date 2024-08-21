import { UDPHelper } from '@companion-module/base'

let self
let packet_counter = 0
const COMMAND = Buffer.from([0x01, 0x00])
const CONTROL = Buffer.from([0x02, 0x00])
const INQUIRY = Buffer.from([0x01, 0x10])

export class ViscaOIP {
	constructor(_self, id, ip, port=53281) {
		self = _self
		this.id = id
	}

	get command() {
		return COMMAND
	}
	get control() {
		return CONTROL
	}
	get inquiry() {
		return INQUIRY
	}
	
	destroy() {
	  if (this.udp) {
      this.udp.destroy()
      delete this.udp
      this.updateStatus(InstanceStatus.Disconnected)
    }
	}
	init_udp() {
    if (this.udp) {
      this.udp.destroy()
      delete this.udp
      this.updateStatus(InstanceStatus.Disconnected)
    }

    self.updateStatus(InstanceStatus.Connecting)

    this.udp = new UDPHelper(ip,port)

    // Reset sequence number
    this.send('\x01', this.control)
    this.packet_counter = 0

    this.udp.on('error', (err) => {
      self.updateStatus(InstanceStatus.ConnectionFailure, err.message)
      self.log('error', 'Network error: ' + err.message)
    })

    // If the status is 'listening', connection should be established
    this.udp.on('listening', () => {
      self.log('info', 'UDP listening')
      self.updateStatus(InstanceStatus.Ok)
    })

    this.udp.on('status_change', (status, message) => {
      self.log('debug', 'UDP status_change: ' + status)
      self.updateStatus(status, message)
    })
  }
	

	send(payload, type = this.command) {
		const buffer = Buffer.alloc(payload.length + 8)
		type.copy(buffer)

		if (packet_counter == 0xffffffff) {
			packet_counter = 0
			// Reset sequence number
			const resetBuffer = Buffer.alloc(9)
			resetBuffer.write('020000010000000001', 'hex')
			self.udp.send(resetBuffer)
		}
		packet_counter = packet_counter + 1

		buffer.writeUInt16BE(payload.length, 2)
		buffer.writeUInt32BE(packet_counter, 4)

		if (typeof payload == 'string') {
			buffer.write(payload, 8, 'binary')
		} else if (typeof payload == 'object' && payload instanceof Buffer) {
			payload.copy(buffer, 8)
		}

    if (self && self.config && self.config.verbose){
		  self.log('debug', this.msgToString(buffer))
    }
		let lastCmdSent = this.msgToString(buffer.slice(8), false)
		self.setVariableValues({ lastCmdSent: lastCmdSent })
		self.udp.send(buffer)
	}

	msgToString(msg, separateBlocks = true) {
		let s = ''
		for (let i = 0; i < msg.length; i++) {
			s += msg[i].toString(16).padStart(2, '0') + ' '
			if (separateBlocks && (i == 1 || i == 3 || i == 7 || i == 15 || i == 23)) {
				s += '| '
			}
		}
		return s.trim()
	}
}
