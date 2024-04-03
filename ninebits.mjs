/*
* author : vincent 
* date : april 2024
*/


class CNineBits {

  constructor(arraySize) {
    this.b = 7;
    this.ep = 0;
    this.encoded = new Array(arraySize);
    this.reset();
  }

  reset() {
    this.b = 7;
    this.ep = 0;
    this.encoded.fill(0);
  }

  encode(ninebit) {
    for (let n = 8; n >= 0; n--) {
        const s = (ninebit.v >> n) & 0x01;
        if (this.b < 0) {
            this.b = 7;
            if (this.ep < (this.encoded.length - 1)) {
                this.ep++;
            } else {
                break;
            }
        }
        this.encoded[this.ep] |= (s << this.b);
        this.b--;
    }
  }

  decode() {
    const decoded = new Array();
    let _ep = 0, _dp = 0;
    let _b = 7;

    do {
        let v = 0;
        for (let n = 8; n >= 0; n--) {
            const ob = (this.encoded[_ep] >> _b) & 0x01;
            v |= (ob << n);
            if (--_b < 0) {
                _b = 7;
                _ep++;
            }
        }
        decoded[_dp++] = v;
    } while (_ep < (this.encoded.length - 1));

    return decoded;
  }

  get() {
    return this.encoded;
  }
}



/*
* Example
*/


  // Test the class
  const CNB = new CNineBits(16);
  const inArray = [200, 210, 220, 230, 240, 250, 260, 270, 280, 290];

  // push uint16 as 9bits numbers 
  for (let a = 0; a < inArray.length; a++) {
    const nb = { v: inArray[a] };
    CNB.encode(nb);
  }



  // Show encoded array
  console.log('Encoded array:', CNB.get());
  const encoded = CNB.get()

  encoded.forEach(e => {
    const hex = e.toString(16).padStart(2, '0').toUpperCase();
    process.stdout.write(`0x${hex},`)
  });
  console.log()

  

  // Show decoded array
  console.log('Decoded array:', CNB.decode());
