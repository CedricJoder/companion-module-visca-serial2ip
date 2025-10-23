# Sony Visca Router

A module to route visca commands over multiple networks, either IP or serial.

--------

## Traffic Flow

* Data coming from a link is routed according to the destination id set in the command.



## Configuration

Setting | Description
-----------------------------|-------------------------------------------
**Number of visca links** | Number of links to route commands to and from
**Machines Ids** | Id of the devices attached to the link 
**Visca Protocol** | Choose which visca protocol to use : serial, IP_device, or IP_controller
**Verbose log** | Choose if the log is verbose for this link
**Link type** | Choose the communication protocol : serial, udp, tcp client or tcp server
**Serial port used** | Choose which serial port to use (serial link only)
**Baud Rate** | Choose the baud rate for the serial port (serial link only)
**Data Bits** | Choose the data bits for the serial port (serial link only)
**Parity** | Choose the parity for the serial port (serial link only)
**Stop Bits** | Choose the stop bits for the serial port (serial link only)
**IP Address** | Sets the IP address of the remote link (IP link only)
**Port** | Sets the port of the remote link (IP link only)
**Local Port** | Sets the port for incoming communications (IP link only)
**Force destination Id** | Force message to be routed to specified id device  (IP link only)



## Actions

Actions | Description
-------------|---------------
**Send address_set command** | Send 'address_set' command to configure serial visca devices
**Send reset_counter command** | Send 'reset_counter' command to synchronise sequence number on visca over IP




