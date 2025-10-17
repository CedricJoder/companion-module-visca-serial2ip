import net from 'net';
import { EventEmitter } from 'eventemitter3';
//import { InstanceStatus } from '../module-api/enums.js'
import { //TCPHelperOptions, 
InstanceStatus } from '@companion-module/base';
/*
export interface TCPHelperEvents {
    // when an error occurs
    error: [err: Error]
    // a packet of data has been received
    data: [msg: Buffer]

    // the connection has opened
    connect: []
    // the socket has ended
    end: []
    // the write buffer has emptied
    drain: []

    // the connection status changes
    status_change: [status: TCPStatuses, message: string | undefined]
}
*/
//export interface TCPHelperOptions {
/** default 2000 */
//	reconnect_interval?: number
/** default true */
//	reconnect?: boolean
//}
export class TCPServer extends EventEmitter {
    #host;
    #port;
    _server;
    //	readonly #options: Required<TCPHelperOptions>
    #clients = [];
    #connected = false;
    #listening = false;
    #destroyed = false;
    #lastStatus;
    #reconnectTimer;
    #missingErrorHandlerTimer;
    get isConnected() {
        return this.#connected;
    }
    get isListening() {
        return this.#listening;
    }
    get isDestroyed() {
        return this.#destroyed;
    }
    constructor(port, host) {
        super();
        let self = this;
        this.#host = host;
        this.#port = port;
        //		this.#options = {
        //			reconnect_interval: 2000,
        //			reconnect: true,
        //			...options,
        //		}
        this._server = new net.Server();
        this._server.on('error', (err) => {
            self.#new_status(InstanceStatus.UnknownError, err.message);
            self.emit('error', err);
        });
        this._server.on('listening', () => {
            self.#listening = true;
            self.#new_status(InstanceStatus.Ok);
        });
        this._server.on('connection', (socket) => {
            self.#connected = true;
            self.#new_status(InstanceStatus.Ok);
            self.#clients.push(socket);
            socket.setKeepAlive(true, 10000);
            socket.on('error', (err) => {
                self.emit('error', err);
            });
            socket.on('close', () => {
                self.#clients.splice(self.#clients.indexOf(socket), 1);
                self.#connected = self.#clients.length > 0;
                if (!self.#connected) {
                    self.#new_status(InstanceStatus.Disconnected);
                }
            });
            socket.on('data', (msg) => {
                self.emit('data', msg);
            });
        });
        this._server.on('close', () => {
            self.#connected = false;
            self.#listening = false;
            self.#new_status(InstanceStatus.Disconnected);
            this.emit('end');
        });
        this._server.on('data', (data) => this.emit('data', data));
        //		this._server.on('drop', () => this.emit('drop'))
        // Let caller install event handlers first
        //		setImmediate(() => {
        //			if (!this.#destroyed) this.connect()
        //		})
        this.#missingErrorHandlerTimer = setTimeout(() => {
            this.#missingErrorHandlerTimer = undefined;
            if (!this.#destroyed && !this.listenerCount('error')) {
                // The socket is active and has no listeners. Log an error for the module devs!
                console.error(`Danger: TCP client for ${this.#host}:${this.#port} is missing an error handler!`);
            }
        }, 5000);
    }
    async send(message) {
        let self = this;
        if (this.#destroyed)
            throw new Error('Cannot write to destroyed socket');
        if (!message || !message.length)
            throw new Error('No message to send');
        if (!this.#connected) {
            return false;
        }
        try {
            return new Promise((resolve, reject) => {
                for (var sock of self.#clients) {
                    sock.write(message, (error) => {
                        if (error) {
                            reject(error);
                            return;
                        }
                        resolve(true);
                    });
                }
            });
        }
        catch (error) {
            this.#connected = false;
            const error2 = error instanceof Error ? error : new Error(`${error}`);
            // Unhandeled socket error
            this.#new_status(InstanceStatus.UnknownError, error2.message);
            this.emit('error', error2);
            throw error2;
        }
    }
    destroy() {
        this.#destroyed = true;
        if (this.#reconnectTimer !== undefined) {
            clearTimeout(this.#reconnectTimer);
            this.#reconnectTimer = undefined;
        }
        if (this.#missingErrorHandlerTimer !== undefined) {
            clearTimeout(this.#missingErrorHandlerTimer);
            this.#missingErrorHandlerTimer = undefined;
        }
        for (var sock of this.#clients) {
            sock.removeAllListeners();
            this.removeAllListeners();
            sock.destroy();
        }
    }
    // Private function
    #new_status(status, message) {
        if (this.#lastStatus != status) {
            this.#lastStatus = status;
            this.emit('status_change', status, message);
        }
    }
}
//# sourceMappingURL=tcpServer.js.map