import hexdump from 'hexdump-nodejs';
import crc from 'crc';
import crypto from 'crypto'
import fs from 'fs'

const downloadsPath = "./downloads/"


// Protocol implementation for Files Download.
export default class ProtocolFDL {

  static FrameDesc = {
    FILES_DOWNLOAD: 0x01,
    FILE_CONTENT: 0x1C,    
  };

  static SomeConst = {
    MAX_FILE_SIZE: 30000
  };

  static State = {
    PRISTINE: 1,
    MASTER_HEADER: 2,
    INGESTING: 3,
    //END: 9
  };  

  constructor() {
    this.vstate = ProtocolFDL.State.PRISTINE;
  }
  
  reset(){
    this.vstate = ProtocolFDL.State.PRISTINE;
  }

  state(s){
    if(s){
      return (this.vstate = s);
    }
    return this.vstate;
  }


  // ingest all raw data from BLE
  ingest(buffer) {

    // auto detect master header
    if(ProtocolFDL.MasterHeader.isValid(buffer)){
      console.log("master header detected !")
      this.state(ProtocolFDL.State.MASTER_HEADER)
    }

    if(this.state() == ProtocolFDL.State.MASTER_HEADER){      
      const mh = ProtocolFDL.MasterHeader.decode(buffer)
      
      if(mh.optHeaderCount > 0){
        console.error(`${mh.optHeaderCount} file(s) to download !`)
        this.b = buffer
        this.fullLength = mh.fullLength;
        this.state(ProtocolFDL.State.INGESTING)    
      } else {
        console.error("no file to download")
        this.reset()
      }    
    }

    else
    if(this.state() == ProtocolFDL.State.INGESTING){
     
      this.b = Buffer.concat([this.b, buffer]) // concat all partials buffers into big one

      if(this.b.length >= this.fullLength){
        this.b = this.b.slice(0, this.fullLength) // cut the buffer size to fullLength
        console.log("all files has been received")
        this.saveDownloadToFile(buffer)
        this.reset()
        return true;
      }
    }

    //TODO : add error on timeout ! 
    return false;
  }


  // save 
  saveDownloadToFile(buffer){
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().replace(/[-T:.]/g, '_').slice(0, -5); // YYYY_MM_DDTHH_mm_ss      
    const fileName = `${downloadsPath}data_${formattedDate}.bin`;
    console.log("save download to file: ", fileName)
    this.toFile(this.b, fileName)
  }


  // copy buffer to file
  toFile(buffer, filePath){
    fs.writeFileSync(filePath, buffer);
  }


  // get buffer from file
  fromFile(filePath){ 
    return fs.readFileSync(filePath);      
  }


  // decode raw data
  decode(buffer){
   
    if(!buffer){ //use object current buffer if no argument
      buffer = this.b;
    }

    if(ProtocolFDL.MasterHeader.isValid(buffer)){
      throw new Error("Master Header invalid")
    }

    const mh    = ProtocolFDL.MasterHeader.decode(buffer);
    let p       = ProtocolFDL.MasterHeader.MASTER_HEADER_SIZE // data position
    let grab    = [] // build an objects array with all data grabbed from the transfer 
    
    // find and list the optional headers
    for(let i=0; i<mh.optHeaderCount; i++){      
      console.log(`opt header (i:${i} ; p:${p})`) 

      // extract the data chunk containing the optional header
      const chunk   = buffer.slice(p, p+ProtocolFDL.OptHeader.OPT_HEADER_SIZE)
      const decoded = ProtocolFDL.OptHeader.decode(chunk)
      //console.log(hexdump(chunk))
      console.log(decoded)

      // check CRC
      if(!ProtocolFDL.OptHeader.checkCRC(chunk))
        throw new Error("Optional Headers invalid (CRC)")

      // check Limits
      if(!ProtocolFDL.OptHeader.checkLimit(decoded))
        throw new Error("Optional Headers invalid (Limits)")
        
      // save the header and his position            
      grab.push({ header: {position:p, data:decoded }})
      
      // make p point to next optional header
      p = p + decoded.fileSize + ProtocolFDL.OptHeader.OPT_HEADER_SIZE;
    }

    // find the files contents
    console.log("content decoded:")
    for(let i=0; i<grab.length; i++){
      let e = grab[i]
      const fcBeg = e.header.position + ProtocolFDL.OptHeader.OPT_HEADER_SIZE  // file content begin postion
      const fcEnd = fcBeg + e.header.data.fileSize                             // file content end postion
      e.fileContent = buffer.slice(fcBeg, fcEnd)
      e.fileContentSize = e.fileContent.length // mostly for debug
      e.fileHeaderHash = e.header.data.hash.toString('hex')
      //console.log(e);      
    }

    // check SHA-256
    console.log("compute SHA-256:")
    for(let i=0; i<grab.length; i++){
      let e = grab[i]
      e.fileComputedHash = crypto.createHash('sha256').update(e.fileContent).digest('hex')
      e.fileHashMatch = (e.fileHeaderHash === e.fileComputedHash)
      console.log(e);
    }

    // decode the file content
    console.log("decode the file content:")
    for(let i=0; i<grab.length; i++){
      let e = grab[i]
      if(e.fileHashMatch){
        const rec = new Records();
        rec.decode(e.fileContent);
      }
    }
    
    //TODO : >>>>>>>>>>  decode TO parse !!!!!

  }


  // Master Header
  static MasterHeader = class {

    static MASTER_HEADER_SIZE = 10;

    static isValid(buffer) { 
      if(buffer[0] == ProtocolFDL.FrameDesc.FILES_DOWNLOAD && buffer.length == 10){
        const header_crc = buffer.readUIntLE(8,2);
        const comput_crc = crc.crc16kermit(buffer.slice(0,8))
        return (header_crc == comput_crc)
      }
      return false;
    }    

    static decode(buffer){
      return {
        optHeaderCount: buffer.readUIntLE(1,1),
        fullLength: buffer.readUIntLE(2,4),
        reserved: 0,
        crc16: crc.crc16kermit(buffer.slice(0,8))
      }  
    }

  }


  // Optional Header
  static OptHeader = class {

    static OPT_HEADER_SIZE = 40;
    
    static checkCRC(buffer) {     
      if(buffer[0] == ProtocolFDL.FrameDesc.FILE_CONTENT){        
        const header_crc = buffer.readUIntLE(38,2);
        const comput_crc = crc.crc16kermit(buffer.slice(0,38))
        //console.log(`isOptHeader: 0x${header_crc.toString(16)} ; 0x${comput_crc.toString(16)}`)
        return (header_crc == comput_crc)
      }
      return false
    }    
   
    static decode(buffer){
      return {
        frameDesc: buffer.readUIntLE(0,1),
        reserved: 0,
        fileSize: buffer.readUIntLE(2,4),
        hash: buffer.slice(6,6+32),
        crc16: buffer.readUIntLE(38,2)
      }
    }

    static checkLimit(decoded) {  
      if(decoded.fileSize > 0 && decoded.fileSize < ProtocolFDL.SomeConst.MAX_FILE_SIZE){
        return true;
      }
      return false;
    }

  }



}





class Records {


  
  decode(buffer){ // buffer =  binary file content
   
    const fileSize = buffer.length;
    let error = 0;
    let p = 0;

    do {

      let b    = buffer.slice(p, fileSize-p)
      let head = Records.Header.parse(b)

      if(head.desc == Records.Header.DESC.TEMP_SHORT){
        
        const rec = Records.RecTempShort.parse(head.payload)
          
        console.log("parsing record:")   
        console.log(rec)

      } else {
        throw new Error("header descriptor unknown")
      }

      p += head.size;
      break;

    } while(true);

  }


  static Header = class {

    static HEADER_SIZE = 6;
    static DESC = {
      TEMP_SHORT: 0x10,
      TEMP_LONG: 0x11,
    };   

    static computeCRC(buffer, frameSize){
      const sz = (frameSize - 2) // footer CRC is positioned in the 2 last bytes     
      return crc.crc16kermit(buffer.slice(0,sz))
    }

    static parse(buffer){

      const sz  = buffer.readUIntLE(1,1)
      const crc = buffer.readUIntLE(sz-2,2)
      const computedCrc = Records.Header.computeCRC(buffer, sz)
      const payload = buffer.slice(Records.Header.HEADER_SIZE,sz-2)

      return {
        desc: buffer.readUIntLE(0,1),
        size: sz,
        timestamp: buffer.readUIntLE(2,4),
        footerCRC: crc,
        footerCRCMatch: (crc === computedCrc),
        payload: payload
      }
    }
    
  }


  static RecTempShort = class {

    static REC_SIZE = 28

    static parse(buffer){

      const nineBitsTemperaturesArray = buffer.slice(0,18)

      return {
        nineBitsTemperatures: nineBitsTemperaturesArray,
        pedometer: buffer.readUIntLE(18,2),        
      }
    }

  }



}