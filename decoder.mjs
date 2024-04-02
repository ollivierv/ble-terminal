import ProtocolFDL from './protocol.mjs';


let protocol = new ProtocolFDL();


//
// Run
// 
async function run(filePath) {

  console.log(`opening ${filePath}`)

  const buffer = protocol.fromFile(filePath)
  //console.log(buffer)
  protocol.decode(buffer)
 
}


//
// filePath as argument
//
let filePath = null
if (process.argv.length == 3) filePath = process.argv[2]
if (filePath) {
    run(filePath)
} else {
    console.log('ERROR: filePath not specified on command line.')
}
