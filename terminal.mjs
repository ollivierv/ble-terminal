// This demonstration is designed to communicate with a micro:bit programmed with "demo-microbit.js"

import BleUart from '@danielgjackson/ble-uart'
import readline from 'readline';
import EventEmitter from 'events';
import hexdump from 'hexdump-nodejs'; // line 25 =>>> string += (value >= 32 && value < 127) ? String.fromCharCode(value) : ".";
import ProtocolFDL from './protocol.mjs';
//import crc from 'crc';



BleUart.verbose = false

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
} 

let protocol = new ProtocolFDL();
let bleUart = null;
protocol.reset()


//
// Event listener for user input
//
class InputEmitter extends EventEmitter {}
const inputEmitter = new InputEmitter();

inputEmitter.on('line', (input) => {
  
  if(input == "rec:download" || input == "qq"){
    input = "rec:download";
    console.log(">>> detected : rec:download !")
    //protocol.reset();
    bleDataEvent.addListener('raw', bleOnRaw)
  } else {
    bleDataEvent.removeListener('raw', bleOnRaw)
  }

  bleUart.write(input+'\r');
});


//
// Show a prompt and read user input
// 
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt() {
  rl.question('', (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
    } else {
      //console.log(`You entered: ${input}`);
      if(input.length > 0)
        inputEmitter.emit('line', input);

      prompt();
    }
  });
}


//
// Event listener for BLE
//
class BLEDataEvent extends EventEmitter {}
const bleDataEvent = new BLEDataEvent();

const bleOnRaw = (buffer) => {

  //console.log(hexdump(buffer));
  
  if(protocol.ingest(buffer)){
    protocol.decode();
    protocol.reset();
  }
}

//
// Run
// 
async function run(address) {

  console.log(`Scanning... ${address}`)
  bleUart = await BleUart.scanForBleUart(address)
  console.log('...found!')
/*
  bleUart.resultCommandReader((line) => {
    //console.log(`${line}`)
    console.log("resultCommandReader:")
    console.log(hexdump(Buffer.from(line, 'utf8')));
  })*/

  bleUart.resultCommandBuffer((buffer) => {
    bleDataEvent.emit('raw', buffer);
  }) 

  console.log('Connecting...')
  await bleUart.connect()
  await delay(300);
  console.log('...connected!')
  
  prompt();
 
}


//
// Device address as program parameter
//
let address = null
if (process.argv.length == 3) address = process.argv[2]
if (address) {
    run(address)
} else {
    console.log('ERROR: Address not specified on command line.  Type:  node demo.mjs A1:B2:C3:D4:E5:F6')
}
