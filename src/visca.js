import { UDPHelper } from '@companion-module/base'
import { SerialPort } from 'serialport'
import { InstanceStatus } from '@companion-module/base'


let self
const COMMAND = Buffer.from([0x01, 0x00])
const CONTROL = Buffer.from([0x02, 0x00])
const INQUIRY = Buffer.from([0x01, 0x10])
const DEVICE_SETTING = Buffer.from([0x01, 0x20])
const REPLY = Buffer.from([0x01, 0x11])
const CONTROL_REPLY = Buffer.from([0x02, 0x01])

const NETWORK_CHANGE = Buffer.from([0x00, 0x38, 0xFF])
const RESET_COUNTER = Buffer.from([0x01])
const IF_CLEAR = Buffer.from([0x01, 0x00, 0x01, 0xFF])
const ADDRESS_SET = Buffer.from [0x88, 0x30, 0x00, 0xFF]


const BROADCAST = Buffer.from([0x88])



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

export class ViscaOIP {
	constructor(_self, id) {
		self = _self
		this.id = id
		this.ip = self.config['ip'+id]
		this.port = self.config['port'+id]
		this.remoteSerial = self.config['protocol'+id]=='serial'
		this.packet_counter = 0
		
		this.init()
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
	get reply() {
	  return REPLY
	}
	get control_reply() {
    return CONTROL_REPLY
  }
  get device_setting() {
    return DEVICE_SETTING
  }
	
	get network_change() {
	  return NETWORK_CHANGE
	}
	get reset_counter() {
	  return RESET_COUNTER
	}
	get if_clear() {
	  return IF_CLEAR
	}
	get address_set() {
	  return ADDRESS_SET
	}
	get broadcast() {
	  return BROADCAST
	}
	
	
	destroy() {
	  if (this.udp) {
      this.udp.destroy()
      delete this.udp
      this.updateStatus(InstanceStatus.Disconnected)
    }
	}
	
	
	init() {
	  // clear before initializing 
    if (this.udp) {
      this.udp.destroy()
      delete this.udp
      this.updateStatus(InstanceStatus.Disconnected)
    }

    self.updateStatus(InstanceStatus.Connecting)

    this.udp = new UDPHelper(this.ip,this.port)

    // send Reset sequence number or Network change command
    if(this.remoteSerial) {
      let buffer = Buffer.from(this.network_change)
      let header = (this.id+8)*16
      buffer.writeUInt8(header, 0)
      self.send(buffer)
    } else {
      this.send(this.reset_counter, this.control)
      this.packet_counter = 0
    }
    

    this.udp.on('error', (err) => {
      self.updateStatus(InstanceStatus.ConnectionFailure, err.message)
      self.log('error', 'Network error: ' + err.message)
    })

    // If the status is 'listening', connection should be established
    this.udp.on('listening', () => {
      self.log('info', 'UDP listening')
      self.updateStatus(InstanceStatus.Ok)
      self.setAddress(1)
    })

    this.udp.on('status_change', (status, message) => {
      self.log('debug', 'UDP status_change: ' + status)
      self.updateStatus(status, message)
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
      
      
      self.send(data, type)
    })
    
    
  }
	
  // send message through the udp interface
	send(payload, type) {
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
    
    if (self && self.config && self.config.verbose){
	  self.log('debug', this.msgToString(buffer))
    }
    
    this.lastCmdSent = buffer
		let lastCmdSent = this.msgToString(buffer.slice(8), false)
		self.setVariableValues({ lastCmdSent: lastCmdSent })
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