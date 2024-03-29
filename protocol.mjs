import hexdump from 'hexdump-nodejs';
import crc from 'crc';


export default class ProtocolFDL {

  static FrameDesc = {
    FILES_DOWNLOAD: 0x01,
    FILE_CONTENT: 0x1C,    
  };

  static SomeConst = {
    MASTER_HEADER_SIZE: 10,
    FDL_OPT_HEADER_SIZE: 40
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

    // find and list the optional headers
    let p = ProtocolFDL.SomeConst.MASTER_HEADER_SIZE;
    let opthArray = [];
    for(let i=0; i<this.optHeaderCount; i++){
      console.log(`opt header (i:${i} ; p:${p})`)
      const h = { p:p, data:this.b.slice(p, p+ProtocolFDL.SomeConst.FDL_OPT_HEADER_SIZE)}

      console.log(hexdump(h.data))

      if(!ProtocolFDL.OptHeader.isOptHeader(h.data))
        throw new Error("big problem with optional headers")
              
      // save the header and his position            
      opthArray.push(h)
      
      // make p point to next optional header
      p = p + ProtocolFDL.OptHeader.getFileSize(h.data) + ProtocolFDL.SomeConst.FDL_OPT_HEADER_SIZE;
    }
  
  }



  static OptHeader = class {

    static isOptHeader(buffer) {     
      if(buffer[0] == ProtocolFDL.FrameDesc.FILE_CONTENT){        
        const header_crc = buffer.readUIntLE(38,2);
        const comput_crc = crc.crc16kermit(buffer.slice(0,38))
        //console.log(`isOptHeader: 0x${header_crc.toString(16)} ; 0x${comput_crc.toString(16)}`)
        return (header_crc == comput_crc)
      }
      return false
    }    

    static getFileSize(buffer) {
      return buffer.readUIntLE(2,4)
    }
  }



}


