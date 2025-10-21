/**
 * Class ViscaRouter routes Visca commandsover multiple networks
 */

/* eslint-disable no-useless-escape */
import { combineRgb, Regex, TCPHelper } from '@companion-module/base'
import * as net from 'net'
import { runEntrypoint, InstanceBase, InstanceStatus } from '@companion-module/base'
import { SerialPort } from 'serialport'
import { ViscaNetwork } from './visca.js'
import * as CHOICES from './choices.js'

const UpgradeScripts = []

//const ADDRESS_SET = Buffer.from([0x88, 0x30, 0x00, 0xFF])

/**
 * Returns the passed string expanded to 2-digit hex for each character
 * @param {string} data: string to hexify
 * @param {string} delim: string to insert between characters
 * @since 1.0.0
 */
const toHex = (data, delim = '') => {
	return [...data]
		.map((hex) => {
			return ('0' + Number(hex.charCodeAt(0)).toString(16)).slice(-2)
		})
		.join(delim)
}

/**
 * Companion instance class ViscaRouter
 * routes Visca commands over multiple networks
 *
 * @extends InstanceBase
 * @version 2.1.0
 * @since 1.0.0
 * @author Cédric Joder
 */
class ViscaRouter extends InstanceBase {
	/**
	 * Create a new instance of class ViscaRouter
	 * @param {Object} internal -	Internal Companion reference
	 * @version 2.1.0
	 * @since 1.0.0
	 */
	constructor(internal) {
		super(internal)

		this.log('debug', 'constructor')
		// Wait a few seconds so we don't spam log with 'no ports/unconfigured'
		// as those processes take a few moments to settle
		this.LOG_DELAY = 10000

		// module defaults
		this.linkNumber = 2
		this.foundPorts = []
		this.viscas = []

		this.devMode = process.env.DEVELOPER
	}

	/**
	 * Clear all ports and timers
	 * @since 1.0.1
	 */
	clearAll() {
		if (this.portScan) {
			clearInterval(this.portScan)
			delete this.portScan
		}
//		if (this.sockets) {
//			this.sockets.forEach((sock) => {
//				sock.end()
//				sock.removeAllListeners()
//			})
//			delete this.sockets
//		}
//		if (this.tServer) {
//			if (this.tServer.connections > 0) {
//				this.tServer.close()
//			}
//			this.tServer.removeAllListeners()
//			delete this.tServer
//		}
//		if (this.sPort) {
//			this.sPort.removeAllListeners()
//			if (this.sPort.isOpen) {
//				this.sPort.close()
//			}
//			delete this.sPort
//		}
//		
//		if (this.viscaOIP) {
//		  this.viscaOIP.forEach((visca) => visca.destroy())
//		  this.viscaOIP = []
//		}
//		if (this.viscaSerial) {
//		  this.viscaSerial.destroy()
//		  delete this.viscaSerial
//		}

		this.viscas?.forEach((visca) => {
			visca.removeAllListeners()
			visca.destroy()
		})
		delete this.viscas
	}

	/**
	 * Cleanup module before being disabled or closed
	 * @since 1.0.0
	 */
	async destroy() {
		this.clearAll()
		clearInterval(this.SERIAL_INTERVAL)
		this.updateStatus(InstanceStatus.Disconnected, 'Disabled')
		this.log('debug', 'Destroyed')
	}

	/**
	 * Initialize the module.
	 * Called once when the system is ready for the module to start.
	 *
	 * @param {Object} config - module configuration details
	 * @version
	 * @since 1.0.0
	 */
	async init(config) {
		this.applyConfig(config)
	}

	/**
	 * Apply user configuration parameters and start the server.
	 *
	 * @param {Object} config - saved user configuration items
	 * @since 1.0.0
	 */
	applyConfig(config) {
		this.config = config
		this.clearAll()
		this.viscas = []
		
		this.linkNumber = config.linkNumber || 2
		this.verbose = config.verbose

		for (let i = 1; i <= this.linkNumber; i++) {
			this['id'+i] = config['id'+i]
			this['linkType'+i] = config['linkType'+i]
			
			if (this['linkType'+i] == 'SERIAL') {
				this['sPort'+i] = config['sPort'+i]
				this['baud'+i] = config['baud'+i]
				this['bits'+i] = config['bits'+i]
				this['parity'+i] = config['parity'+i]
				this['stop'+i] = config['stop'+i]
			} else {
				this['IP'+i] = config['IP'+i]
				this['IPPort'+i] = config['IPPort'+i]
				this['localPort'+i] = config['localPort'+i]
			}
			
			this.viscas[i] = new ViscaNetwork(this, i)

		}
				

		this.startedAt = Date.now()
		this.portScan = setInterval(() => this.scanForPorts(), 5000)
		this.scanForPorts()
		this.init_actions()
		this.init_variables()
		this.updateVariables()
	}

	/**
	 * Called when 'Apply changes' is pressed on the module 'config' tab
	 * @param {Object} config - updated user configuration items
	 * @since 2.0.0
	 */
	async configUpdated(config) {
		this.config = config
		this.applyConfig(config)
	}


	condLog(level, log) {
		if (this.verbose) {
			this.log(level, log)
		}
	}


	route(data, viscaProtocol, destId) {
		// find destination id if not set
		if (destId == undefined) {
			let addressByte
			if (viscaProtocol == 'SERIAL') {
				addressByte = data.readUInt8(0)
			} else {
				addressByte = data.readUInt8(8)
			}
			destId = addressByte & 0x0F
		}
		
		this.viscas?.forEach((visca) => {
			if (destId == 8 || visca.viscaIds.includes(destId)) {
				visca.send(data, viscaProtocol)
			}
		})
	}


	/**
	 * Initialize the serial port and attach for read/write
	 * @since 1.0.0
	 */
//	init_serial() {
//		if (this.sPortPath == '' || this.sPortPath === 'none') {
//			// not configured yet
//			return
//		}
//
//		let portOptions = {
//			path: this.sPortPath,
//			autoOpen: false,
//			baudRate: parseInt(this.config.baud),
//			dataBits: parseInt(this.config.bits),
//			stopBits: parseInt(this.config.stop),
//			parity: this.config.parity,
//		}
//
//		this.sPort = new SerialPort(portOptions)
//
//		this.sPort.on('error', this.doUpdateStatus.bind(this))
//
//		this.sPort.on('open', this.init_tcp.bind(this))
//
//		this.sPort.on('close', (err) => {
//			this.doUpdateStatus(err)
//			if (err.disconnected) {
//				// close all connections
//				this.tSockets.forEach((sock) => sock.end())
//				this.tServer.close()
//				this.isListening = false
//			}
//		})
//
//		this.sPort.on('data', (data) => {
//			// make sure client is connected
//			if (this.tSockets.length > 0) {
//				// forward data to the TCP connection (data is a buffer)
//				this.log('debug', 'COM> ' + toHex(data.toString('latin1')) + ' ')
//				this.tSockets.forEach((sock) => sock.write(data))
//			}
//			clearInterval(this.SERIAL_INTERVAL)
//		})
//
//		this.sPort.open()
//
//		this.doUpdateStatus()
//	}

	/**
	 * Update the dynamic variable(s)
	 * since 1.0.0
	 */
	updateVariables() {
		let addr = 'Not connected'

		if (this.viscas?.length > 0) {
			addr = this.viscas.map((s) => s.remoteAddress + ':' + s.remotePort).join('\n')
		}
		this.setVariableValues({ ip_addr: addr })
	}

	/**
	 * Initialize the TCP server (after the serial port is ready)
	 * @since 1.0.0
	 */
//	init_tcp() {
//		let tServer = (this.tServer = new net.Server())
//
//		tServer.maxConnections = 4
//
//		tServer.on('error', (err) => {
//			this.doUpdateStatus(err)
//		})
//
//		tServer.on('connection', (socket) => {
//			let cid = socket.remoteAddress + ':' + socket.remotePort
//			this.tSockets.push(socket)
//			this.updateVariables()
//      socket.setKeepAlive(true,60000)
//
//			socket.on('err', this.doUpdateStatus.bind(this))
//
//			socket.on('close', () => {
//				this.tSockets.splice(this.tSockets.indexOf(socket), 1)
//				this.isListening = this.tSockets.length > 0
//				this.updateVariables()
//			})
//
//			socket.on('data', (data) => {
//				// forward data to the serial port
//				this.log('debug', 'TCP: ' + toHex(data.toString('latin1') + ' '))
//				this.sPort.write(data)
//				if (this.config.response == true) {
//					this.SERIAL_INTERVAL = setTimeout(this.sendError.bind(this), this.config.maxresponse)
//				}
//			})
//		})
//
//		tServer.listen(this.IPPort)
//
//		this.isListening = true
//		this.doUpdateStatus()
//	}

	/**
	 * Send an error to all TCP sockets if no response was receieved on the Serial Port
	 * @since 1.0.7
	 */

	sendError() {
		this.updateStatus(InstanceStatus.Error)
		this.log(
			'error',
			'Error: No response received via Serial connection in the max allotted time of ' + this.config.maxresponse + 'ms'
		)
		let msg = this.config.errormessage
		try {
			this.tSockets.forEach((sock) => sock.write(msg))
		} catch (error) {
			this.log('debug', 'Unable to send error message to sockets: ' + error.toString())
		}

		clearInterval(this.SERIAL_INTERVAL)
	}

	/**
	 * Update companion status and log
	 * @param {Object} err - optional error message from sPort or tPort
	 */
	doUpdateStatus(err) {
		let s
		let l
		let m

		if (this.isListening) {
			l = 'info'
			s = InstanceStatus.Ok
			m = `Listening on TCP port ${this.IPPort}`
		} else if (err) {
			l = 'error'
			s = InstanceStatus.Error
			m = `Error: ${err.message}`
		} else if (!this.foundPorts || this.startedAt + this.LOG_DELAY > Date.now()) {
			// haven't scanned yet so the rest of the statuses don't apply
			s = null
		} else if (this.foundPorts.length == 0) {
			l = 'error'
			s = InstanceStatus.ConnectionFailure
			m = 'No serial ports detected'
		} else if (this.sPort && this.sPortPath !== 'none') {
			l = 'info'
			s = InstanceStatus.Connecting
			m = `Connecting to ${this.sPortPath}`
		} else {
			l = 'error'
			s = InstanceStatus.BadConfig
			m = 'No serial port configured'
		}

		if (s != null && l + m + s != this.lastStatus) {
			this.updateStatus(s, m)
			this.log(l, m)
			this.lastStatus = l + m + s
		}
	}

	/**
	 * Periodically scan the system for attached serial ports
	 * This is the callback attached to portScan interval timer
	 * @since 1.0.0
	 */
	scanForPorts() {
		let setSerial = false

		setSerial = this.foundPorts.length > 0 && !this.sPort
		setSerial = setSerial || (this.sPort && !this.sPort.isOpen)
		if (!this.sPort || !this.sPort.isOpen) {
			this.doUpdateStatus()
			this.findPorts()
		}
//		if (setSerial) {
//			this.init_serial()
//			
//		}
	}

	/**
	 * The actual port scanner function
	 * @since 1.0.0
	 */
	findPorts() {
		if (this.scanning) {
			return
		}

		this.scanning = true
		this.foundPorts = []

		SerialPort.list().then(
			(ports) => {
				ports.forEach((p) => {
					if (this.devMode) {
						let nb = ''
						for (const [k, v] of Object.entries(p)) {
							nb += (nb == '' ? '' : ', ') + `${k}: ${v}`
						}
						this.log('debug', nb)
					}
					if (p.locationId || p.vendorId || p.pnpId) {
						this.foundPorts.push({
							path: p.path ? p.path : p.comName,
							manufacturer: p.manufacturer ? p.manufacturer : 'Internal',
						})
					}
				})
				if (this.foundPorts.length > 0) {
					this.foundPorts.unshift({ path: 'none', manufacturer: 'Not configured' })
				}
				this.doUpdateStatus()
				this.scanning = false
			},
			(err) => {
				this.log('debug', 'SerialPort.list: ' + err)
				this.scanning = false
			}
		)
	}

	/**
	 * Initialize Actions
	 * @since 1.0.7
	 */

	init_actions() {

		let actionsArr = {
			previousSPort: {
				name: 'Select Previous Serial Port in List',
				options: [],
				callback: async (action, context) => {
					try {
						let index = this.foundPorts.findIndex((port) => port.path == this.config.sport)
						index--

						if (index > 0) {
							this.log('info', 'Selecting previous Serial port in list: ' + this.foundPorts[index].path)
							if (this.sPort) {
								//close the serial port if it is already opened
								this.log('info', 'First closing already open port: ' + this.config.sport)
								this.sPort.removeAllListeners()
								if (this.sPort.isOpen) {
									this.sPort.close()
								}
								delete this.sPort
							}

							this.config.sport = this.foundPorts[index].path

							this.applyConfig(this.config)
						} else {
							this.log('info', 'Cannot select previous Serial port in list: Already on the first port in the list.')
						}
					} catch (error) {
						this.log('debug', 'Error Selecting previous Serial Port in List: ' + error.toString())
					}
				},
			},

			nextSPort: {
				name: 'Select Next Serial Port in List',
				options: [],
				callback: async (action, context) => {
					try {
						let index = this.foundPorts.findIndex((port) => port.path == this.config.sport)
						index++

						if (index < this.foundPorts.length) {
							this.log('info', 'Selecting next Serial port in list: ' + this.foundPorts[index].path)
							if (this.sPort) {
								//close the serial port if it is already opened
								this.log('info', 'First closing already open port: ' + this.config.sport)
								this.sPort.removeAllListeners()
								if (this.sPort.isOpen) {
									this.sPort.close()
								}
								delete this.sPort
							}

							this.config.sport = this.foundPorts[index].path

							this.applyConfig(this.config)
						} else {
							this.log('info', 'Cannot select next Serial port in list: Already on the last port in the list.')
						}
					} catch (error) {
						this.log('debug', 'Error Selecting next Serial Port in List: ' + error.toString())
					}
				},
			},
		}

		this.setActionDefinitions(actionsArr)
	}

	/**
	 * Define the dynamic variables for Companion
	 * @since 1.0.0
	 */
	init_variables() {
		this.setVariableDefinitions([
			{
				name: 'Remote IP address',
				variableId: 'ip_addr',
			},
		])
	}

	/**
	 * Define the items that are user configurable.
	 * Return them to companion.
	 * @since 2.0.0
	 */
	getConfigFields() {
		let ports = []
		
		if (this.foundPorts && this.foundPorts.length) {
			this.foundPorts.forEach((port) => {
				ports.push({ id: port.path, label: `${port.manufacturer} (${port.path})` })
			})

			let portObj = ports.find((port) => port.id === this.config.sport)

			if (!portObj) {
				if (this.config.selectfirstfound) {
					this.log('info', 'Previously selected port (' + this.config.sport + ') not found.')
					if (this.ports?.length > 1) {
						this.log('info', 'Selecting first found port: ' + ports[1].id)
						this.config.sport = ports[1].id
					}
				}
			}
		} else {
			ports = [{ id: 'none', label: 'No serial ports detected' }]
		}

		const fields = [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'This module is meant to route visca commands over multiple links, either IP or serial',
			},
			{
				type: 'number',
				id: 'linkNumber',
				width: 6,
				label: 'Number of visca links',
				default: 2,
			},
			
		]

		for (let i = 1; i <= this.config.linkNumber; i++){
			fields.push({
				type: 'static-text',
				id: 'spacer',
				width: 12,
				label: '   '
			},
			{
				type: 'static-text',
				id: 'info'+i,
				width: 12,
				label: 'Config for link ' + i
			},
			{
				type: 'textinput',
				id: 'ids' + i,
				label: 'Machines Ids',
				tooltip: 'List of machines id on the link, coma-separated (x,y,...)',
				width: 6,
				regex: '/^[0-7](,[0-7]){0,7}$/'
			},
			{
				type: 'dropdown',
				id: 'viscaProtocol' + i,
				width: 6,
				label: 'Visca Protocol',
				label: 'Visca Protocol',
				choices : CHOICES.VISCA_PROTOCOL,
				default : 'SERIAL'
			},{
				type: 'dropdown',
				id: 'linkType' + i,
				label: 'Link Type',
				width: 4,
				choices: CHOICES.LINK_TYPE,
				default: CHOICES.LINK_TYPE[0].id
			},
			{
				type: 'dropdown',
				id: 'sPort' + i,
				label: 'Serial port used',
				width: 8,
				choices: ports,
				default: ports[ports.length==1 ? 0 : 1].id,
				isVisible: (options, data) => {
		    	  return (options['linkType' + data.i] == 'SERIAL')},
		   		isVisibleData: {"i" : i}
			},
			{
				type: 'dropdown',
				id: 'baud' + i,
				label: 'Baud Rate',
				width: 6,
				default: CHOICES.BAUD_RATES[0].id,
				choices: CHOICES.BAUD_RATES,
				isVisible: (options, data) => {
		    	  return ((options['linkType' + data.i] == 'SERIAL') && (options['sPort' + data.i] != 'none'))},
		   		isVisibleData: {"i" : i}
			},
			{
				type: 'dropdown',
				id: 'bits' + i,
				label: 'Data Bits',
				width: 6,
				default: CHOICES.BITS[0].id,
				choices: CHOICES.BITS,
				isVisible: (options, data) => {
		    	  return ((options['linkType' + data.i] == 'SERIAL') && (options['sPort' + data.i] != 'none'))},
		   		isVisibleData: {"i" : i}
			},
			{
				type: 'dropdown',
				id: 'parity' + i,
				label: 'Parity',
				width: 6,
				default: CHOICES.PARITY[0].id,
				choices: CHOICES.PARITY,
				isVisible: (options, data) => {
		    	  return ((options['linkType' + data.i] == 'SERIAL') && (options['sPort' + data.i] != 'none'))},
		   		isVisibleData: {"i" : i}
			},
			{
				type: 'dropdown',
				id: 'stop' + i,
				label: 'Stop Bits',
				width: 6,
				default: CHOICES.STOP[0].id,
				choices: CHOICES.STOP,
				isVisible: (options, data) => {
		    	  return ((options['linkType' + data.i] == 'SERIAL') && (options['sPort' + data.i] != 'none'))},
		   		isVisibleData: {"i" : i}
			},
			
			{
				type: 'textinput',
				id: 'IP' + i,
				label: 'IP address',
				width: 4, 
				tooltip: 'IP address of the remote link',
				regex: Regex.IP,
				isVisible: (options, data) => {
		    	  return (['UDP', 'TCP_CLIENT'].includes(options['linkType' + data.i]))},
		   		isVisibleData: {"i" : i}	
			},
			{
				type: 'textinput',
				id: 'IPPort' + i,
				label: 'Port',
				width: 2,
				tooltip: 'Port of the remote link',
				regex: Regex.PORT,
				isVisible: (options, data) => {
		    	  return (['UDP', 'TCP_CLIENT'].includes(options['linkType' + data.i]))},
		   		isVisibleData: {"i" : i}
			},
			{
				type: 'textinput',
				id: 'localPort' + i,
				label: 'Local Port',
				width: 2,
				regex: Regex.PORT,
				isVisible: (options, data) => {
		    	  return (['UDP', 'TCP_SERVER'].includes(options['linkType' + data.i]))},
		   		isVisibleData: {"i" : i}
			},
			{
				type: 'number',
				id: 'forceDest' + i,
				label: 'Force destination Id',
				width: 4,
				min: 0, 
				max: 8,
				isVisible: (options, data) => {
		    	  return (options['viscaProtocol' + data.i] != 'SERIAL')},
		   		isVisibleData: {"i" : i}
			},
		)}
			
	 fields.push(
		{
			type: 'static-text',
			id: 'spacer',
			width: 12,
			label: ''
		},
	    {
		    type: 'checkbox',
			  id: 'verbose',
	  		label: 'Verbose log',
		 		default: false,
	 			width: 3,
	    }
    )

		return fields
	}
	
	send (msg, type){
	  let header
	  if (typeof msg == 'string') {
      header = parseInt(msg[0],16)
    } else if (typeof msg == 'object' && msg instanceof Buffer) {
      header = msg.readUInt8(0)
    } else {
      this.log('error', "Wrong message type")
      return
    }
	  let receiver = header%16
//	  this.log('debug', 'receiver : '+ receiver)
	  if (receiver == 8) {
	    this.viscaOIP.forEach((visca) => {
	      visca.send(msg, type)
	    })
      this.viscaSerial.send(msg)
	  }
	  else if (this.viscaOIP[receiver]) {
	    this.viscaOIP[receiver].send(msg, type)
	  }
	  else {
	    if (this.viscaSerial) {
	      this.viscaSerial.send(msg)
	    }
	  }
	}
	
//	setAddress (id) {
//	  for (; id < (this.config.firstID + this.config.devicesNumber); id++) {
//	    let visca=this.viscaOIP[id]
//	    if (visca) {
//	      let msg = Buffer.from(ADDRESS_SET)
//        msg.writeUInt8(id, 2)
//	      visca.send(msg, visca.device_setting)
//	    }
//	  }
//	  if (this.viscaSerial) {
//	    let msg = Buffer.from(ADDRESS_SET)
//	    msg.writeUInt8(id, 2)
//	    this.viscaSerial.send(msg)
//	  }
//	}
	
}

runEntrypoint(ViscaRouter, UpgradeScripts)
