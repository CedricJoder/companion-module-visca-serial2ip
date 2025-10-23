import { UDPHelper, TCPHelper } from '@companion-module/base'
import { TCPServer }  from './tcpServer.js'
import { SerialPort } from 'serialport'
import { EventEmitter } from 'eventemitter3';
import { InstanceStatus } from '@companion-module/base'
import * as COMMANDS from './ViscaCommands.js'




	
export class ViscaNetwork extends EventEmitter {

	get command() {
		return COMMANDS.COMMAND
	}
	get control() {
		return COMMANDS.CONTROL
	}
	get inquiry() {
		return COMMANDS.INQUIRY
	}
	get reply() {
	  return COMMANDS.REPLY
	}
	get control_reply() {
    return COMMANDS.CONTROL_REPLY
	}
	get device_setting() {
    return COMMANDS.DEVICE_SETTING
	}
	
	get network_change() {
	  return COMMANDS.NETWORK_CHANGE
	}
	get reset_counter() {
	  return COMMANDS.RESET_COUNTER
	}
	get reset_counter_command() {
		return Buffer.concat([COMMANDS.CONTROL, Buffer.from([0x00, 0x01, 0x00, 0x00, 0x00, 0x00]), COMMANDS.RESET_COUNTER])
	}
	get if_clear() {
	  return COMMANDS.IF_CLEAR
	}
	get cam_version_inq() {
		return COMMANDS.CAM_VERSION_INQ
	}
	get address_set() {
	  return COMMANDS.ADDRESS_SET
	}
	get broadcast() {
	  return COMMANDS.BROADCAST
	}
	

/**
 * Destroys the instance
 * @since 1.0.0
 */
 	
	destroy() {
		if (this.socket) {
		this.socket.destroy()
		delete this.socket
		this.status = InstanceStatus.Disconnected
		this.module.updateStatus(InstanceStatus.Disconnected)
		}
	}
	
	
	
/**
 * Formats the message to human readable sequence
 * @param {buffer || string} msg: message to send
 * @param {boolean} separateBlocks: separate blocks by function
 * @since 1.0.0
 */
 

	msgToString(msg, separateBlocks) {
		if (!separateBlocks) {
			separateBlocks = (this.viscaProtocol != 'SERIAL')
		}
		let s = ''
		for (let i = 0; i < msg.length; i++) {
			s += msg[i].toString(16).padStart(2, '0') + ' '
			if (separateBlocks && (i == 1 || i == 3 || i == 7 || i == 15 || i == 23)) {
				s += '| '
			}
		}
		return s.trim()
	}
	
	
/**
 * Prints message in the log window
 * @param {string} level: log level of the message
 * @param {string || object} msg: message to print
 * @param {boolean} alwaysDisplay: if false, only prints if the link is in verbose mode (default: true)
 * @since 1.0.0
 */
	log(level, msg, alwaysDisplay = true) {
		if (alwaysDisplay || this.verbose) {
			this.module.log(level, `Link ${this.linkId} : ${msg}`)
		}
	}
	
	
/**
 * Separate commands arriving in the same packet
 * @param {buffer} data: buffer to parse
 * @since 1.0.0
 */
	parseCommands(data) {
		let commands = []
		if (this.viscaProtocol == 'SERIAL') {
			let startIndex = 0, endIndex = 0
			while (endIndex != -1 && startIndex < data.length) {
				endIndex = data.indexOf(0xFF, startIndex)
				commands.push(data.subarray(startIndex, endIndex + 1))
				startIndex = endIndex + 1
			}
		} else {
			while (data.length > 0) {
				let messageLength = data.readUint16BE(2) + 8
				commands.push(data.subarray(0, messageLength))
				data = data.subarray(messageLength)
			}
		}				
		return commands
	}
	
	
	
	constructor (routerModule, linkId) {
		super()
		this.module = routerModule
		this.linkId = linkId
		this.linkType = routerModule.config['linkType' + linkId]
		this.viscaProtocol = routerModule.config['viscaProtocol'+linkId]
		this.viscaIds = routerModule.config['ids'+linkId]?.split(",").map((v) => Number(v))
		this.forceDest = routerModule.config['forceDest'+linkId]
		this.verbose = routerModule.config['verbose'+linkId]
		this.portName = ''
		this.status = InstanceStatus.Connecting
		
		switch (this.linkType) {
			case 'SERIAL':
				this.sPort = routerModule.config['sPort' + linkId]
				this.baud = routerModule.config['baud'+linkId]
				this.bits = routerModule.config['bits'+linkId]
				this.parity = routerModule.config['parity'+linkId]
				this.stop = routerModule.config['stop'+linkId]
				break
				
			case 'UDP': 
				this.IP = routerModule.config['IP' + linkId]
				this.IPPort = routerModule.config['IPPort' + linkId]
				this.localPort = routerModule.config['localPort' + linkId]
				break
				
			case 'TCP_CLIENT':
				this.IP = routerModule.config['IP' + linkId]
				this.IPPort = routerModule.config['IPPort' + linkId]
				break
				
			case 'TCP_Server':
				this.IPPort = routerModule.config['IPPort' + linkId]
		}
		
		if (this.viscaProtocol != 'SERIAL') {
			this.packet_counter = 0
		}
		
		this.init()
	}
	
	// Initialize socket
	init() {
		let self = this
		if (this.socket) {
			this.socket.destroy()
		}
		
		this.status = InstanceStatus.Connecting
		
		switch (this.linkType) {
			case 'SERIAL' :
				if (this.sPort == '' || this.sPort === 'none') {
					// not configured yet
					return
				}
		
				let portOptions = {
					path: this.sPort,
					autoOpen: false,
					baudRate: parseInt(this.baud),
					dataBits: parseInt(this.bits),
					stopBits: parseInt(this.stop),
					parity: this.parity,
				}
		
				this.portName = this.sPort
				this.socket = new SerialPort(portOptions)
				this.log('debug', 'Opening serial port : ' + this.sPort)
				this.socket.send = this.socket.write
				this.socket.open()
				
				break
				
			case 'TCP_CLIENT' : 
				if (this.IP && this.IPPort) {
					this.socket = new TCPHelper(this.IP, this.IPPort)
					this.portName = 'TCP_CLIENT ' + this.IP + ':' + this.IPPort
				} else {
					this.log('error', 'Invalid config')
					this.status = InstanceStatus.BadConfig
					this.module.doUpdateStatus()
					return
				}
				break
				
			case 'TCP_SERVER' : 
				if (this.localPort) {
					this.socket = new TCPServer(this.localPort)
					this.portName = 'TCP_SERVER :' + this.localPort
				} else  {
					this.log('error', 'Invalid config')
					this.status = InstanceStatus.BadConfig
					this.module.doUpdateStatus()
					return
				}
				break
				
			case 'UDP' : 
				if (this.IP && this.IPPort) {
					this.socket = new UDPHelper (this.IP, this.IPPort, {bind_port: this.localPort})
					this.portName = 'UDP ' + this.IP + ':' + this.IPPort
				} else  {
					this.log('error', 'Invalid config')
					this.status = InstanceStatus.BadConfig
					this.module.doUpdateStatus()
					return
				}
				
				break
				
			default :
				this.log('error', 'Invalid config')
				this.status = InstanceStatus.BadConfig
				this.module.doUpdateStatus()
				return
		}
		
		this.socket.on('error', (err) => {
			self.log('error', 'Error on port ' + self.portName + ' : ' + err.message)
			this.status = InstanceStatus.ConnectionFailure
			self.module?.doUpdateStatus.bind(self.module)
		})
		
		this.socket.on('open', (event) => {
			this.log('debug', 'Port open : ' + self.portName)
			this.status = InstanceStatus.Ok
			self.module?.doUpdateStatus.bind(self.module)
		})
		
		this.socket.on('close', () => {
			self.log('debug', 'Closing port ' + self.portName)
			this.status = InstanceStatus.Disconnected
			self.module?.doUpdateStatus()
		})
		
		this.socket.on('listening', () => {
			self.log('debug', `Socket listening : ${self.linkType.slice(0,3)} port ${self.localPort}`)
			this.status = InstanceStatus.Ok
			self.module?.doUpdateStatus()
		})
		
		this.socket.on('data', (data) => {
			let commands = self.parseCommands(data)
			for (const command of commands) { 
				let sourceId, destId, addressByte
				self.log('debug', 'Incoming message : ' + this.msgToString(command), false)
				if (this.viscaProtocol == 'SERIAL') {
					addressByte = command.readUint8(0)
					// find destination id for routing
					destId = addressByte % 0x10
				} else { 
					addressByte = command.readUint8(8)
					// set destination id
					destId = this.forceDest ?? addressByte % 0x10
				
					// set source address
					sourceId = 0x08 + this.viscaIds[0]
					addressByte = (0x10 * sourceId) + destId
					command.writeUInt8(addressByte, 8)
					// set packet counter
					if (this.viscaProtocol == 'IP_Controler') {
						this.packet_counter = command.readUint32BE(4)
						
						if (command.subarray(8) == this.reset_counter) {
							this.packet_counter = 0
						}
					}
				}
				self.module.route(command, self.viscaProtocol, self.linkId, destId)
			}
		})
		
		this.resetCounter()
		
		this.module.doUpdateStatus()
		
	}
	
	
	// finding the type of visca serial payload 
	findPayloadType(msg) {
		if ((msg.subarray(1) == this.if_clear) || (msg.subarray(1) == this.cam_version_inq)){
			return this.device_setting
		}
		let secondByte = msg.readUint8(1)
		if (secondByte == 0x01) {
			return this.command
		} else if (secondByte == 0x09) {
			return this.inquiry
		} else if ([0x40, 0x50, 0x60].includes(secondByte - (secondByte % 0x10))) {
			return this.reply
		}
	}

	
	
/**
 * Send message through the interface
 * @param {buffer || string} msg: message to send
 * @param {string} type: Visca protocol of the message to send, either 'SERIAL' or 'IP'
 * @since 1.0.0
 */
 
	send(msg, type) {
	  if (msg == undefined || type == undefined || this.socket == undefined) {
		return
	  }

	  let data
	  
	  // format message
	  if (this.viscaProtocol == 'SERIAL') {
		if (type == 'SERIAL') {
			data = Buffer.from(msg)
		} else {
			data = Buffer.from(msg.slice(8))
		}
	  } else {
		
		if (type == 'IP_Device' || type == 'IP_Controler') {
			data = Buffer.from(msg)
		} else {

		// copy message 
			data = Buffer.alloc(msg.length + 8)
			if (typeof msg == 'string') {
				data.write(msg, 8, 'binary')
			} else if (typeof msg == 'object' && msg instanceof Buffer) {
				msg.copy(data, 8)
			}
			
		// add header
			let payloadType = this.findPayloadType(msg)
			if (payloadType) {
			  payloadType.copy(data, 0)
			  data.writeUInt16BE(msg.length,2)
			} else {
			  this.log('error', "Can't find message type : " + this.msgToString(msg))
			  return
			}
		}
		
		// set source and destination ids
		let addressByte
		if (this.viscaProtocol == 'IP_Device') {
			addressByte = 0x81
		} else if (this.viscaProtocol == 'IP_Controler') {
			addressByte = 0x90
		}
		data.writeUInt8(addressByte, 8)
		
		// check sequence number
		if (this.packet_counter == 0xffffffff) {
			this.resetCounter()
		}
		// write sequence number
		data.writeUInt32BE(this.packet_counter, 4)
		this.packet_counter++
	  }
	  
	  if (this.module && this.module.config && this.module.config.verbose) {
		this.log('debug', 'Sending : ' + this.msgToString(data), false)
	  }
	  	  
	  this.socket.send(data)
	}
	
/**
 * Send reset sequence number command to device and resets internal counter
 * @since 1.0.0
 */
	resetCounter() {
		if (this.viscaProtocol == 'SERIAL') {
			return
		}
		this.socket.send(this.reset_counter_command)
		this.packet_counter = 0
		this.log('debug', `Sending : ${this.msgToString(this.reset_counter_command)}`,false)
	}
	
	
/**
 * Send address_set command to set device address on serial link
 * @param {number} id: id to set
 * @since 1.0.0
 */
	setAddress(id) {
		let msg = Buffer.from(this.address_set)
		msg.writeUInt8(id, 2)
		this.send(msg, 'SERIAL')
	}
	
}
		
		