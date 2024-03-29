// This demonstration is designed to communicate with a micro:bit programmed with "demo-microbit.js"

import BleUart from '@danielgjackson/ble-uart'
import readline from 'readline';
import EventEmitter from 'events';
import hexdump from 'hexdump-nodejs';
import ProtocolFDL from './protocol.mjs';
//import crc from 'crc';



BleUart.verbose = false

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
} 

let protocol = new ProtocolFDL();
let bleUart = null;


//
// Event listener for user input
//
class InputEmitter extends EventEmitter {}
const inputEmitter = new InputEmitter();

inputEmitter.on('line', (input) => {
  
  if(input == "rec:download"){
    console.log(">>> detected : rec:download !")
    protocol.pristine();
    bleDataEvent.addListener('raw', bleOnRaw)
  } else {
    bleDataEvent.removeListener('raw', bleOnRaw);
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
  console.log(hexdump(buffer));

  if(protocol.isPristine()){
    if(protocol.isMasterHeader(buffer))
      console.log("master header detected !")    
    else 
      console.err("incorrect master header ")
  } 

  protocol.ingest(buffer);
  
}
/*
bleDataEvent.on('raw', (buffer) => {  

  //console.log("bleDataEvent,raw:")
  console.log(hexdump(buffer));

});
*/


//
// Run
// 
async function run(address) {

  /*
  const buffer = Buffer.from([0x01, 0x00, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0xB1, 0xA8]);
  let c = crc.crc16kermit(buffer.slice(0,8)).toString(16);
  console.log("crc:",c)
  return;
  */

  console.log(`Scanning... ${address}`)
  bleUart = await BleUart.scanForBleUart(address)
  console.log('...found!')

  bleUart.resultCommandReader((line) => {
    //console.log(`${line}`)
    console.log("resultCommandReader:")
    console.log(hexdump(Buffer.from(line, 'utf8')));
  })

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
