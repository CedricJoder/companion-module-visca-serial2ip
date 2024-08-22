import { UDPHelper } from '@companion-module/base'
import { SerialPort } from 'serialport'


let self
let packet_counter = 0
const COMMAND = Buffer.from([0x01, 0x00])
const CONTROL = Buffer.from([0x02, 0x00])
const INQUIRY = Buffer.from([0x01, 0x10])

export class ViscaOIP {
	constructor(_self, id, ip, port=53281) {
		self = _self
		this.id = id
		this.ip = ip
		this.port = port
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
	
	init() {
    if (this.udp) {
      this.udp.destroy()
      delete this.udp
      this.updateStatus(InstanceStatus.Disconnected)
    }

    self.updateStatus(InstanceStatus.Connecting)

    this.udp = new UDPHelper(this.ip,this.port)

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
    
    this.udp.on('message', (data) => {
      self.send(data.subarray(8), this.id)
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


export class ViscaSerial {
	constructor(_self) {
		self = _self
	}
		/**
	 * Initialize the serial port and attach for read/write
	 * @since 1.0.0
	 */
	init(portOptions) {
	  this.portOptions = {
      path: portOptions.path,
      autoOpen: portOptions.autoOpen || false,
      baudRate: portOptions.baudRate || 9600,
      dataBits: portOptions.dataBits || 8,
      stopBits: portOptions.stopBits || 1,
      parity: portOptions.parity || 'none'
    }
    
		if (this.portOptions.path == '' || this.portOptions.path === 'none') {
			// not configured yet
			return
		}

		this.sPort = new SerialPort(portOptions)

		this.sPort.on('error', self.doUpdateStatus.bind(self))

	//	this.sPort.on('open', this.init_tcp.bind(this))

		this.sPort.on('close', (err) => {
			self.doUpdateStatus(err)
			if (err.disconnected) {
				// close all connections
				self.tSockets.forEach((sock) => sock.end())
				self.tServer.close()
				self.isListening = false
			}
		})

		this.sPort.on('data', (data) => {
			let receiver = data.readUInt8(0)%16
			let sender = ((data.readUInt8(0)/16)|0) - 8
			let msg = data.subarray(1)
			
			self.send(msg, sender, receiver)
		})

		this.sPort.open()

		self.doUpdateStatus()
	}

	
}