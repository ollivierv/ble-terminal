
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


  constructor() {
    this.b = new Buffer();
    this.packet = 0;  
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


  // reset protocol ingest variables
  pristine() {
    this.packet = 0;
  }

  isPristine(){
    return (this.packet == 0);
  }

  // ingest all raw data from BLE
  ingest(buffer) {
    if(this.packet == 0){
      this.decodeMasterHeader(buffer);
      this.b = buffer;
      this.packet++;

      if(this.optHeaderCount == 0){
        console.error("no file to download")
        this.pristine();
      }
    }
    if(this.packet > 0){

      this.b = Buffer.concat([this.b, buffer]);

      if(this.b.length  > this.fullLength){
        this.b = this.b.slice(0, this.fullLength);
        console.log("all files has been received")
        this.pristine();
      }
    }
  }

  // decode raw data
  decode(){
    
    // find and list the optional headers
    let p = ProtocolFDL.SomeConst.MASTER_HEADER_SIZE;
    let opthArray = [];
    for(i=0; i<this.optHeaderCount; i++){
      const h = { p:p, header:this.b.slice(p, ProtocolFDL.SomeConst.FDL_OPT_HEADER_SIZE)};

      if(!OptHeaderFDL.isOptHeader(h.header))
        throw new Error("big problem with optional headers");
              
      // save the header and his position
      opthArray.push(h);        
      
      // make p point to next optional header
      p = p + OptHeaderFDL.getFileSize(h.header) + ProtocolFDL.SomeConst.FDL_OPT_HEADER_SIZE;
    }
  


  }



  static OptHeaderFDL = class {

    static isOptHeader(buffer) {
      if(h[0] == ProtocolFDL.FrameDesc.FILE_CONTENT){
        const header_crc = buffer.readUIntLE(38,2);
        const comput_crc = crc.crc16kermit(buffer.slice(0,38))
        return (header_crc == comput_crc)
      }
    }    

    static getFileSize(buffer) {
      return buffer.readUIntLE(2,4)
    }
  }



}


