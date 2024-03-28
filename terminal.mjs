// This demonstration is designed to communicate with a micro:bit programmed with "demo-microbit.js"

import BleUart from '@danielgjackson/ble-uart'
import readline from 'readline';
import EventEmitter from 'events';

BleUart.verbose = false

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
} 



//
// Event listener for user input
//
class InputEmitter extends EventEmitter {}

const inputEmitter = new InputEmitter();

inputEmitter.on('userInput', (input) => {
  console.log(`User typed: ${input}`);
});


//
// Show a prompt and read user input
// 
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt() {
  rl.question('> ', (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
    } else {
      //console.log(`You entered: ${input}`);
      inputEmitter.emit('userInput', input);
      prompt();
    }
  });
}





// Example functionality
let counter = 0
async function run(address) {

  /*
    console.log(`Scanning... ${address}`)
    const bleUart = await BleUart.scanForBleUart(address)
    console.log('...found!')

    bleUart.addLineReader((line) => {
        console.log(`Received: ${line}`)
    })

    console.log('Connecting...')
    await bleUart.connect()
    await delay(300);
    console.log('...connected!')

    
    bleUart.write('AT\r\n')  // Add line-feed character so that we're sending a line of text
*/
  prompt();
 
}

// Device address as program parameter
let address = null
if (process.argv.length == 3) address = process.argv[2]
if (address) {
    run(address)
} else {
    console.log('ERROR: Address not specified on command line.  Type:  node demo.mjs A1:B2:C3:D4:E5:F6')
}
