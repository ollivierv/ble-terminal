import hexdump from 'hexdump-nodejs';
import crc from 'crc';
import crypto from 'crypto'


export default class ProtocolFDL {

  static FrameDesc = {
    FILES_DOWNLOAD: 0x01,
    FILE_CONTENT: 0x1C,    
  };

  static SomeConst = {
    MASTER_HEADER_SIZE: 10,
    FDL_OPT_HEADER_SIZE: 40,
    MAX_FILE_SIZE: 10000
  };

  static State = {
    PRISTINE: 1,
    INGESTING: 2,
    END: 9
  };  

  constructor() {
    this.vstate = ProtocolFDL.State.PRISTINE;
  }
  
  isMasterHeader(buffer){
    if(buffer[0] == ProtocolFDL.FrameDesc.FILES_DOWNLOAD && buffer.length == 10){
      const header_crc = buffer.readUIntLE(8,2);
      const comput_crc = crc.crc16kermit(buffer.slice(0,8))
      return (header_crc == comput_crc)
    }
    return false;
  }

  decodeMasterHeader(buffer){
    this.optHeaderCount = buffer.readUIntLE(1,1);
    this.fullLength = buffer.readUIntLE(2,4);
    this.crc16 = buffer.readUIntLE(8,2);
    const c = crc.crc16kermit(buffer.slice(0,8))

    console.log("Master Header Decoding:")
    console.log(`optHeaderCount:${this.optHeaderCount} ; fullLength:${this.fullLength} ; crc16:${this.crc16} / 0x${this.crc16.toString(16)} / computed:${c}`)    
    //return (c == this.crc16)
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

  /*
  // reset protocol ingest variables
  pristine() {
    //this.packet = 0;
    this.vstate = ProtocolFDL.State.PRISTINE;
  }

  isPristine(){
    return (this.vstate == ProtocolFDL.State.PRISTINE);
  }

  end(){
    this.vstate = ProtocolFDL.State.END;
  }

  isEnd(){
    return (this.vstate == ProtocolFDL.State.END);
  }

  ingesting(){
    this.vstate = ProtocolFDL.State.INGESTING;
  }

  isIngesting(){
    return (this.vstate == ProtocolFDL.State.INGESTING);
  }  
  */


  // ingest all raw data from BLE
  ingest(buffer) {
    //console.error("ingest 0")

    if(this.state() == ProtocolFDL.State.PRISTINE){
      //console.error("ingest 1")
      this.decodeMasterHeader(buffer);
      this.b = buffer
      this.state(ProtocolFDL.State.INGESTING)
      //console.error("ingest 1.1 :", this.state())

      if(this.optHeaderCount == 0){
        console.error("no file to download")
        this.reset()
      }            
    }

    else
    if(this.state() == ProtocolFDL.State.INGESTING){
      //console.error("ingest 2")
      this.b = Buffer.concat([this.b, buffer])

      if(this.b.length >= this.fullLength){
        this.b = this.b.slice(0, this.fullLength)
        console.log("all files has been received")
        this.state(ProtocolFDL.State.END)
      }
    }
    //TODO : add error on timeout ! 
  }

  // decode raw data
  decode(){
    
    if(this.state() != ProtocolFDL.State.END)
      return;

   
    let grab    = [] // build an objects array with all data grabbed from the transfer 
    let p       = ProtocolFDL.SomeConst.MASTER_HEADER_SIZE // data position
    const count = this.optHeaderCount // value come from Master Header
    
    // find and list the optional headers
    for(let i=0; i<count; i++){      
      console.log(`opt header (i:${i} ; p:${p})`) 

      // extract the data chunk containing the optional header
      const chunk   = this.b.slice(p, p+ProtocolFDL.SomeConst.FDL_OPT_HEADER_SIZE)
      const decoded = ProtocolFDL.OptHeader.decode(chunk)
      //console.log(hexdump(chunk))

      // check validity
      if(!ProtocolFDL.OptHeader.checkCRC(chunk) || !ProtocolFDL.OptHeader.checkLimit(decoded))
        throw new Error("not a valid optional headers")
        
      // save the header and his position            
      grab.push({ header: {position:p, data:decoded }})
      
      // make p point to next optional header
      p = p + decoded.fileSize + ProtocolFDL.SomeConst.FDL_OPT_HEADER_SIZE;
    }

    // find the files contents
    console.log("content decoded:")
    for(let i=0; i<grab.length; i++){
      let e = grab[i]
      const fcBeg = e.header.position + ProtocolFDL.SomeConst.FDL_OPT_HEADER_SIZE  // file content begin postion
      const fcEnd = fcBeg + e.header.data.fileSize                                 // file content end postion
      e.fileContent = this.b.slice(fcBeg, fcEnd)
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
    
  }



  static OptHeader = class {

    
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


