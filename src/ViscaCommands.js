
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

