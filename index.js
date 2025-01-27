"use strict";
//index.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const { ReadlineParser } = require('@serialport/parser-readline');
const serialport_1 = require("serialport");
const Datatypes = [
    'int8',
    'uint8',
    'int16',
    'uint16',
    'int32',
    'int64',
    'float16',
    'float32',
    'float64',
    'bool',
    'ascii',
];
function openPort(port, baud) {
    return new Promise((resolve, reject) => {
        const serialPort = new serialport_1.SerialPort({ path: port, baudRate: baud }, (err) => {
            if (err) {
                console.error(`Error opening port: ${port}`, err);
                reject(err);
            }
        });
        serialPort.once('open', () => {
            console.log(`Port opened successfully: ${port}`);
            resolve(serialPort);
        });
    });
}
async function main() {
    const translator = new BabelTranslator();
    await translator.startSerial();
}
class BabelTranslator {
    constructor() {
        this.socket = this.startSocket();
    }
    async startSerial() {
        try {
            // some condition to find the right port
            const portName = '/dev/ttyAMA0'; // Replace with logic to find the correct port
            this.serialPort = await openPort(portName, 115200);
            //send UNC to start
            this.serialPort.write('UNC:0x00:0x00:0x00:0x00:0x00:0x00:0x00:0x00\n');
            this.parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
            this.parser.on('data', this.handleSerialMessage.bind(this));
            //Test
            setInterval(() => {
                var _a;
                (_a = this.serialPort) === null || _a === void 0 ? void 0 : _a.write('RQT:0x00:0x01:0x00:0x00:0x00:0x00:0x00:0x00\n');
            }, 2000);
        }
        catch (error) {
            console.error('Failed to start serial port:', error);
        }
    }
    startSocket() {
        const socket = new ws_1.default.Server({ port: 9000 });
        console.log('WebSocket server is listening on port 9000');
        socket.on('connection', (ws) => {
            //ws.on('message', this.handleSocketMessage.bind(this));
        });
        return socket;
    }
    handleSocketMessage(message) {
        console.log('Received message from socket:', message);
        // Handle incoming WebSocket message and make it into serial message
        //Message structure "CMD:Data1:Data2:Data3:Data4:Data5:Data6:Data7:Data8"
        //some need to be cracked down into bytes eg 500 to 2 bytes 0x01 0xF4 but as strings
        let messageString = GenSerialCommand(message);
        //send to serial
        if (this.serialPort) {
            this.serialPort.write(messageString);
        }
    }
    handleSerialMessage(message) {
        console.log('Received message from serial port:', message);
        // Handle incoming serial message and translate to JSON
        if (!/^[A-Za-z]{3}:/.test(message)) {
            // The first four characters are letters followed by a colon
            console.error('Invalid message format:', message);
            return;
        }
        console.log('Message is valid');
        let JSONMessage = GenCommand(message);
        //send to socket
        console.log('Sending message to socket:', JSONMessage);
        if (JSONMessage.CMD !== '') {
            this.socket.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    console.log('Sending message to socket:', JSONMessage);
                    client.send(JSON.stringify(JSONMessage));
                }
            });
        }
    }
}
main().catch(console.error);
/*
let JSONCommand = {
        CMD: 'MOV',
        Data: {
            MID: arr[1],
            PNo: arr[2],
            TNo: arr[3],
            }
    }
*/
function GenCommand(input) {
    let JSONCommand = {
        CMD: '',
        Data: {}
    };
    const arr = input.split(":");
    if (arr.length < 10) {
        JSONCommand.CMD = arr[0];
        switch (arr[0]) {
            case 'WHO':
                JSONCommand.Data = {
                    MID: arr[1],
                    PNo: arr[2],
                    TNo: arr[3],
                };
                return JSONCommand;
            case 'TLM':
                JSONCommand.Data = {
                    MID: arr[1],
                    PID: parseInt(arr[2], 16).toString(),
                    //Add data together
                    Value: combineValue([arr[3], arr[4], arr[5], arr[6], arr[7]], Datatypes[parseInt(arr[8])]),
                    datatype: Datatypes[parseInt(arr[8])]
                };
                return JSONCommand;
            case 'TLT':
                JSONCommand.Data = {
                    MID: arr[1],
                    TID: arr[2],
                    Value: combineValue([arr[3], arr[4], arr[5]], Datatypes[parseInt(arr[8])]),
                    Target: combineValue([arr[6], arr[7]], Datatypes[parseInt(arr[8])]),
                    datatype: Datatypes[parseInt(arr[8])]
                };
                return JSONCommand;
            case 'FCK':
                JSONCommand.Data = {
                    MID: arr[1],
                    ERR: arr[2] + arr[3] + arr[4] + arr[5] + arr[6] + arr[7] + arr[8],
                };
                return JSONCommand;
        }
    }
    else {
        console.error('Invalid message format:', input);
    }
    return JSONCommand;
}
function GenSerialCommand(JSONCommand) {
    let SerialCommand = '';
    switch (JSONCommand.CMD) {
        case 'RQT':
            //MID , PID/TID, TID? If TID? then TID is in json
            return;
        case 'SET':
            //MID, TID, Value, datatype
            return;
        case 'RST':
            //MID
            return;
        case 'SOF':
            //No data 
            return;
        case 'DBG':
            //MID
            return;
        case 'SFT':
            //MID
            return;
        case 'MOV':
            //FLAngle, FLThrottle, FRThrottle, FRAngle, RLThrottle, RLAngle, RRThrottle, RRAngle
            return;
        case 'MOW':
            //MID, Angle, Throttle, duration (s)
            return;
        case 'GET':
            //MID, CID, part (else 0)
            return;
        case 'MOA':
            //MID, JointNo, Angle, Absolute/Relative, datatype
            return;
    }
}
function crackValue(value, datatype, byteNo) {
    //returns a byte array of byteNo length with checking for enough space
    let tmp;
    let byte_array = [];
    switch (datatype) {
        case 'raw':
        case 'bool':
        case 'u8':
            //just return the char of the value
            //return value.split('').map(char => '0x' + char.charCodeAt(0).toString(16).padStart(2, '0'));
            break;
        case 'int32':
            tmp = parseInt(value).toString(16);
            while (tmp.length < byteNo * 2) {
                tmp = '0' + tmp;
            }
            for (let i = 0; i < value.length; i += 2) {
                let byte = value.substring(i, i + 2);
                byte_array.push(parseInt(byte, 16));
            }
            return byte_array.map(byte => '0x' + byte.toString(16).padStart(2, '0'));
        case 'fl16':
        //minimum 2 bytes
        case 'float32':
            //minimum 4 bytes
            let fl32buffer = new ArrayBuffer(byteNo);
            let fl32view = new DataView(fl32buffer);
            fl32view.setFloat32(0, parseFloat(value));
            let bytes = new Uint8Array(fl32buffer);
            //convert each to string hex
            return Array.from(bytes).map(byte => '0x' + byte.toString(16).padStart(2, '0'));
        case 'fl64':
            //Unsuppported
            break;
    }
    return [];
}
function combineValue(valueArr, datatype) {
    //returns a string of the combined value from a string byte array
    let tmp;
    console.log(datatype);
    console.log(valueArr);
    switch (datatype) {
        case 'raw':
        case 'bool':
            tmp = valueArr.map(byte => parseInt(byte, 16));
            //if all bytes are 0 then return false else true
            return tmp.every(byte => byte === 0) ? false : true;
        case 'u8':
            //just return the char of the value
            //return value.split('').map(char => '0x' + char.charCodeAt(0).toString(16).padStart(2, '0'));
            break;
        case 'i32':
            //minimum 4 bytes
            //convert each string to a byte
            let i32 = '';
            tmp = valueArr.map(byte => parseInt(byte, 16));
            tmp.forEach(byte => {
                i32 += byte.toString(16).padStart(2, '0');
            });
            return parseInt(i32, 16);
        case 'fl16':
        //minimum 2 bytes
        //unsupported
        case 'float32':
            // 4 bytes, forget the first occurrence of 0x
            tmp = valueArr.slice(1); // Create a new array without the first element
            console.log(tmp);
            let fl32buffer = new ArrayBuffer(4);
            let fl32view = new DataView(fl32buffer);
            let fl32 = tmp.map(byte => parseInt(byte, 16));
            fl32.forEach((byte, index) => {
                fl32view.setInt8(index, byte);
            });
            return parseFloat(fl32view.getFloat32(0).toPrecision(6));
        case 'fl64':
            //Unsuppported
            break;
    }
}
