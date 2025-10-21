import { UDPHelper, TCPHelper } from '@companion-module/base'
import { TCPServer }  from './tcpServer.js'
import { SerialPort } from 'serialport'
import { InstanceStatus } from '@companion-module/base'
import * as COMMANDS from './ViscaCommands.js'




function msgToString(msg, separateBlocks = true) {
		let s = ''
		for (let i = 0; i < msg.length; i++) {
			s += msg[i].toString(16).padStart(2, '0') + ' '
			if (separateBlocks && (i == 1 || i == 3 || i == 7 || i == 15 || i == 23)) {
				s += '| '
			}
		}
		return s.trim()
	}
	
	
export class ViscaNetwork {

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
	
	destroy() {
		if (this.socket) {
		this.socket.destroy()
		delete this.socket
		this.module.updateStatus(InstanceStatus.Disconnected)
		}
	}
	
	
	constructor (routerModule, linkId) {
		this.module = routerModule
		this.linkId = linkId
		this.linkType = routerModule.config['linkType' + linkId]
		this.viscaProtocol = routerModule.config['viscaProtocol'+linkId]
		this.viscaIds = routerModule.config['ids'+linkId]?.split(",");
		
		this.IP = routerModule.config['ip'+linkId]
		
		switch (this.linkType) {
			case 'SERIAL':
				this.sPort = routerModule.config['sPort' + linkId]
				this.bauds = routerModule.config['baud'+linkId]
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
		
		if (this.viscaProtocol == 'IP') {
			this.packet_counter = 0
		}
		
//		this.init()
		
		
	}
	
	// finding the type of visca serial payload 
	findPayloadType(msg) {
		if ((msg.subarray(1) == this.if_clear) || (msg.subarray(1) == this.cam_version_inq)){
			return this.device_setting
		}
		let secondBite = msg.subarray(1,2)
		
		if (secondBite == 0x01) {
			return this.command
		} else if (secondBite == 0x09) {
			return this.inquiry
		} else if ([0x40, 0x50, 0x60].includes(secondBite | 0x80)) {
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
			if (this.forceId) {
				// force destination Id
				let bufId = (data.readUint8(0) & ~0x08) | this.viscaIds[0]
				data.writeUInt8(bufId, 0)
			}
		}
	  } else {
		if (type == 'IP') {
			data = Buffer.from(msg)
		} else {
		// check sequence number
			if (this.packet_counter == 0xffffffff) {
				this.socket.send(Buffer.concat([this.control, this.reset_counter]))
				this.packet_counter = 0
			}
		// copy message 
			data = Buffer.alloc(msg.length + 8)
			if (typeof msg == 'string') {
				data.write(msg, 8, 'binary')
			} else if (typeof msg == 'object' && msg instanceof Buffer) {
				msg.copy(data, 8)
			}
			// set destination id
			let firstByte = data.readUint8(8)
			let destId = firstbyte & 0x0F
			if (destId != 8) {
				firstbyte -= destId
				if (this.viscaProtocol == 'IP Device') {
					firstbyte ++
				}
				data.writeUInt8(firstbyte, 8)
			}
			// add header
			let payloadType = this.findPayloadType(msg)
			if (payloadType) {
			  payloadType.copy(data, 0)
			  data.writeUInt16BE(msg.length,2)
			  data.writeUInt32BE(this.packet_counter, 4)
			  this.packet_counter++
			  
			  if (this.module && this.module.config && this.module.config.verbose){
			    this.module.log('debug', this.msgToString(buffer))
			  }
			}
		}
	  }
	  
	  if (this.module && this.module.config && this.module.config.verbose) {
			this.module.log('debug', this.msgToString(buffer))
		}
		
		this.lastCmdSent = buffer
		let lastCmdSent = this.msgToString(buffer.slice(8), false)
		this.module.setVariableValues({ lastCmdSent: lastCmdSent })
		  
		this.socket.send(data)
		
		
		
		  
	  let headerSize = (this.remoteSerial) ? 0 : 8
	  const buffer = Buffer.alloc(msg.length + headerSize)
	    
	  if (typeof msg == 'string') {
      buffer.write(msg, headerSize, 'binary')
    } else if (typeof msg == 'object' && msg instanceof Buffer) {
      msg.copy(buffer, headerSize)
    }
    
	  if (!this.remoteSerial) {
	    type = type || this.findType(msg)
	    type.copy(buffer)

  		if (this.packet_counter == 0xffffffff) {
  		  this.send('\x01', this.control)
	  		this.packet_counter = 0
		  	// Reset sequence number
//  			const resetBuffer = Buffer.alloc(9)
	 // 		resetBuffer.write('020000010000000001', 'hex')
//		  	this.udp.send(resetBuffer)
  		}

		  buffer.writeUInt16BE(msg.length, 2)
  		buffer.writeUInt32BE(this.packet_counter, 4)
  		
  		this.packet_counter = this.packet_counter + 1
    }
    
    if (this.module && this.module.config && this.module.config.verbose){
	  this.module.log('debug', this.msgToString(buffer))
    }
    
    this.lastCmdSent = buffer
		let lastCmdSent = this.msgToString(buffer.slice(8), false)
		this.module.setVariableValues({ lastCmdSent: lastCmdSent })
		this.udp.send(buffer)
	}
	

  // message to human readable form for log
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
	
	
	// finding the type of udp message 
	findType(msg) {
	  if (msg.subarray(1) == this.if_clear){
	    return this.device_setting
	  }
	  return this.command
	}
}

	
	
	

export class ViscaOIP {
	constructor(routerModule, linkId) {
		this.module = routerModule
		this.linkId = linkId
		this.IPProtocol = routerModule.config['IPProtocol' + linkId];
		this.ip = routerModule.config['ip'+linkId]
		this.port = routerModule.config['port'+linkId] || '0.0.0.0'

		this.bauds = routerModule.config['baud'+linkId];
		this.bits = routerModule.config['bits'+linkId];
		this.parity = routerModule.config['parity'+linkId];
		this.stop = routerModule.config['stop'+linkId];

		this.viscaProtocol = routerModule.config['viscaProtocol'+linkId]
		this.viscaIds = routerModule.config['ids'+linkId]?.split(",");
		this.packet_counter = 0;
		
		this.route = (msg) => {
			routerModule.route(msg);
		};
		
		this.init();
	}

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
	get if_clear() {
	  return COMMANDS.IF_CLEAR
	}
	get address_set() {
	  return COMMANDS.ADDRESS_SET
	}
	get broadcast() {
	  return COMMANDS.BROADCAST
	}
	
	
	destroy() {
	  if (this.socket) {
      this.socket.destroy()
      delete this.socket
    //  this.module.updateStatus(InstanceStatus.Disconnected)
    }
	}
	
	
	init() {
	  // clear before initializing 
	  this.destroy()

    //this.module.updateStatus(InstanceStatus.Connecting)
    
    switch (this.IPprotocol) {
      case 'udpServer':
        // create udp socket
        
        break;
      
      default:
        // Tab to edit
    }

    this.udp = new UDPHelper(this.ip,this.port)

    // send Reset sequence number or Network change command
    if(this.remoteSerial) {
      let buffer = Buffer.from(this.network_change)
      let header = (this.id+8)*16
      buffer.writeUInt8(header, 0)
      this.route(buffer)
    } else {
      this.send(this.reset_counter, this.control)
      this.packet_counter = 0
    }
    

    this.udp.on('error', (err) => {
      this.module.updateStatus(InstanceStatus.ConnectionFailure, err.message)
      this.module.log('error', 'Network error: ' + err.message)
    })

    // If the status is 'listening', connection should be established
    this.udp.on('listening', () => {
      this.module.log('info', 'UDP listening')
      this.module.updateStatus(InstanceStatus.Ok)
 //     this.module.setAddress(1)
    })

    this.udp.on('status_change', (status, message) => {
      this.module.log('debug', 'UDP status_change: ' + status)
      this.module.updateStatus(status, message)
    })
    
    // on data receive, parsing and forwarding to the main module for routing
    this.udp.on('message', (data) => {
      let type
      if (!this.remoteSerial) {
        // remove ip header and set sender id
        type = data.subarray(0,2)
        data = data.subarray(8)
        let header = data.readUInt8(0)
        header = (this.id+8)*16+ (header%16)
        data.writeUInt8(header, 0)
      }
      // filter broadcast if_clear to prevent loops
      if ((data.subarray(1) == this.if_clear) && (data.subarray(0,1) == this.broadcast)) {
        return
      }
      
      
      this.module.send(data, type)
    })
    
    
  }
	
  // send message through the udp interface
	send(payload, type) {
//	  if (payload == undefined) {
//		return
//	  }
	  
	  let headerSize = (this.remoteSerial) ? 0 : 8
	  const buffer = Buffer.alloc(payload.length + headerSize)
	    
	  if (typeof payload == 'string') {
      buffer.write(payload, headerSize, 'binary')
    } else if (typeof payload == 'object' && payload instanceof Buffer) {
      payload.copy(buffer, headerSize)
    }
    
	  if (!this.remoteSerial) {
	    type = type || this.findType(payload)
	    type.copy(buffer)

  		if (this.packet_counter == 0xffffffff) {
  		  this.send('\x01', this.control)
	  		this.packet_counter = 0
		  	// Reset sequence number
//  			const resetBuffer = Buffer.alloc(9)
	 // 		resetBuffer.write('020000010000000001', 'hex')
//		  	this.udp.send(resetBuffer)
  		}

		  buffer.writeUInt16BE(payload.length, 2)
  		buffer.writeUInt32BE(this.packet_counter, 4)
  		
  		this.packet_counter = this.packet_counter + 1
    }
    
    if (this.module && this.module.config && this.module.config.verbose){
	  this.module.log('debug', this.msgToString(buffer))
    }
    
    this.lastCmdSent = buffer
		let lastCmdSent = this.msgToString(buffer.slice(8), false)
		this.module.setVariableValues({ lastCmdSent: lastCmdSent })
		this.udp.send(buffer)
	}

  // message to human readable form for log
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
	
	
	// finding the type of udp message 
	findType(msg) {
	  if (msg.subarray(1) == this.if_clear){
	    return this.device_setting
	  }
	  return this.command
	}
}


export class ViscaSerial {
  
  get network_change() {
    return NETWORK_CHANGE
  }
  get if_clear() {
    return IF_CLEAR
  }
  get broadcast() {
    return BROADCAST
  }


	constructor(_self) {
		let self = _self
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
    
		if (!this.portOptions || this.portOptions.path == '' || this.portOptions.path === 'none') {
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
		  
		  // address_set message
      if (data.subarray(0,1) == this.address_set.subarray(0,1)) {
        self.setAddress(data.readUInt8(2))
        return 
      }
			self.send(data)
		})

		this.sPort.open()

		self.doUpdateStatus()
	}

  send(payload, type) {
	  const buffer = Buffer.alloc(payload.length)
	    
	  if (typeof payload == 'string') {
      buffer.write(payload, 0, 'binary')
    } else if (typeof payload == 'object' && payload instanceof Buffer) {
      payload.copy(buffer, 0)
    }
    let lastCmdSent = msgToString(buffer, false)
		self.setVariableValues({ 
		  lastCmdSent: lastCmdSent,
		})
    this.sPort.write(buffer)
  }
	
}