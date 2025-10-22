
export const COMMAND = Buffer.from([0x01, 0x00])
export const CONTROL = Buffer.from([0x02, 0x00])
export const INQUIRY = Buffer.from([0x01, 0x10])
export const DEVICE_SETTING = Buffer.from([0x01, 0x20])
export const REPLY = Buffer.from([0x01, 0x11])
export const CONTROL_REPLY = Buffer.from([0x02, 0x01])

export const NETWORK_CHANGE = Buffer.from([0x00, 0x38, 0xFF])
export const RESET_COUNTER = Buffer.from([0x01])
export const IF_CLEAR = Buffer.from([0x01, 0x00, 0x01, 0xFF])
export const CAM_VERSION_INQ = Buffer.from ([0x09, 0x00, 0x02, 0xFF])
export const ADDRESS_SET = Buffer.from ([0x88, 0x30, 0x00, 0xFF])


export const BROADCAST = Buffer.from([0x88])

