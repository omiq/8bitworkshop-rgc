
export function lpad(s:string, n:number):string {
  s += ''; // convert to string
  while (s.length<n) s=" "+s;
  return s;
}

export function rpad(s:string, n:number):string {
  s += ''; // convert to string
  while (s.length<n) s+=" ";
  return s;
}

export function byte2signed(b:number):number {
  b &= 0xff;
  return (b < 0x80) ? b : -(256-b);
}

export function getFilenameForPath(s:string):string {
  var toks = s.split('/');
  return toks[toks.length-1];
}

export function getFolderForPath(s:string):string {
  return s.substring(0, s.lastIndexOf('/'));
}

export function getFilenamePrefix(s:string):string {
  var pos = s.lastIndexOf('.');
  return (pos > 0) ? s.substr(0, pos) : s;
}

export function hex(v:number, nd?:number) {
  if (!nd) nd = 2;
  if (nd == 8) {
    return hex((v>>16)&0xffff,4) + hex(v&0xffff,4);
  } else {
    return toradix(v,nd,16);
  }
}

export function tobin(v:number, nd?:number) {
  if (!nd) nd = 8;
  return toradix(v,nd,2);
}

export function toradix(v:number, nd:number, radix:number) {
  try {
    var s = v.toString(radix).toUpperCase();
    while (s.length < nd)
      s = "0" + s;
    return s;
  } catch (e) {
    return v+"";
  }
}

export function arrayCompare(a:ArrayLike<any>, b:ArrayLike<any>):boolean {
  if (a == null && b == null) return true;
  if (a == null) return false;
  if (b == null) return false;
  if (a.length != b.length) return false;
  for (var i=0; i<a.length; i++)
    if (a[i] != b[i])
      return false;
  return true;
}

export function invertMap(m:{}):{} {
  var r = {};
  if (m) {
    for (var k in m) r[m[k]] = k;
  }
  return r;
}

export function highlightDifferences(s1:string, s2:string):string {
  var split1 = s1.split(/(\S+\s+)/).filter(function(n) {return n});
  var split2 = s2.split(/(\S+\s+)/).filter(function(n) {return n});
  var i = 0;
  var j = 0;
  var result = "";
  while (i < split1.length && j < split2.length) {
    var w1 = split1[i];
    var w2 = split2[j];
    if (w2 && w2.indexOf("\n") >= 0) {
      while (i < s1.length && split1[i].indexOf("\n") < 0)
        i++;
    }
    if (w1 != w2) {
      w2 = '<span class="hilite">' + w2 + '</span>';
    }
    result += w2;
    i++;
    j++;
  }
  while (j < split2.length) {
      result += split2[j++];
  }
  return result;
}

export function lzgmini() {

  // Constants
  var LZG_HEADER_SIZE = 16;
  var LZG_METHOD_COPY = 0;
  var LZG_METHOD_LZG1 = 1;

  // LUT for decoding the copy length parameter
  var LZG_LENGTH_DECODE_LUT = [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,
                               20,21,22,23,24,25,26,27,28,29,35,48,72,128];

  // Decoded data (produced by the decode() method)
  var outdata = null;

  // Calculate the checksum
  var calcChecksum = function(data) {
    var a = 1;
    var b = 0;
    var i = LZG_HEADER_SIZE;
    while (i < data.length)
    {
      a = (a + (data[i] & 0xff)) & 0xffff;
      b = (b + a) & 0xffff;
      i++;
    }
    return (b << 16) | a;
  }

  // Decode LZG coded data. The function returns the size of the decoded data.
  // Use any of the get* methods to retrieve the decoded data.
  this.decode = function(data:number[]):number[] {
    // Start by clearing the decompressed array in this object
    outdata = null;

    // Check magic ID
    if ((data.length < LZG_HEADER_SIZE) || (data[0] != 76) ||
         (data[1] != 90) || (data[2] != 71))
    {
      return null;
    }
    
    // what's the length?
    var uncomplen = data[6] | (data[5]<<8) | (data[4]<<16) | (data[3]<<24);

    // Calculate & check the checksum
    var checksum = ((data[11] & 0xff) << 24) |
                   ((data[12] & 0xff) << 16) |
                   ((data[13] & 0xff) << 8) |
                   (data[14] & 0xff);
    if (calcChecksum(data) != checksum)
    {
      return null;
    }

    var dst = new Array();
    // Check which method to use
    var method = data[15] & 0xff;
    if (method == LZG_METHOD_LZG1)
    {
      // Get marker symbols
      var m1 = data[16] & 0xff;
      var m2 = data[17] & 0xff;
      var m3 = data[18] & 0xff;
      var m4 = data[19] & 0xff;

      // Main decompression loop
      var symbol, b, b2, b3, len, offset;
      var dstlen = 0;
      var k = LZG_HEADER_SIZE + 4;
      var datalen = data.length;
      while (k <= datalen)
      {
        symbol = data[k++] & 0xff;
        if ((symbol != m1) && (symbol != m2) && (symbol != m3) && (symbol != m4))
        {
          // Literal copy
          dst[dstlen++] = symbol;
        }
        else
        {
          b = data[k++] & 0xff;
          if (b != 0)
          {
            // Decode offset / length parameters
            if (symbol == m1)
            {
              // marker1 - "Distant copy"
              len = LZG_LENGTH_DECODE_LUT[b & 0x1f];
              b2 = data[k++] & 0xff;
              b3 = data[k++] & 0xff;
              offset = (((b & 0xe0) << 11) | (b2 << 8) | b3) + 2056;
            }
            else if (symbol == m2)
            {
              // marker2 - "Medium copy"
              len = LZG_LENGTH_DECODE_LUT[b & 0x1f];
              b2 = data[k++] & 0xff;
              offset = (((b & 0xe0) << 3) | b2) + 8;
            }
            else if (symbol == m3)
            {
              // marker3 - "Short copy"
              len = (b >> 6) + 3;
              offset = (b & 63) + 8;
            }
            else
            {
              // marker4 - "Near copy (incl. RLE)"
              len = LZG_LENGTH_DECODE_LUT[b & 0x1f];
              offset = (b >> 5) + 1;
            }

            // Copy the corresponding data from the history window
            for (i = 0; i < len; i++)
            {
              dst[dstlen] = dst[dstlen-offset];
              dstlen++;
            }
          }
          else
          {
            // Literal copy (single occurance of a marker symbol)
            dst[dstlen++] = symbol;
          }
        }
      }

    }
    else if (method == LZG_METHOD_COPY)
    {
      // Plain copy
      var dstlen = 0;
      var datalen = data.length;
      for (var i = LZG_HEADER_SIZE; i < datalen; i++)
      {
        dst[dstlen++] = data[i] & 0xff;
      }
    }
    else
    {
      // Unknown method
      return null;
    }
    // Store the decompressed data in the lzgmini object for later retrieval
    if (dst.length < uncomplen) return null; // data too short
    outdata = dst.slice(0, uncomplen);
    return outdata;
  }

  // Get the decoded byte array
  this.getByteArray = function():number[]
  {
    return outdata;
  }

  // Get the decoded string from a Latin 1 (or ASCII) encoded array
  this.getStringLatin1 = function():string {
    return byteArrayToString(outdata);
  }

  // Get the decoded string from an UTF-8 encoded array
  this.getStringUTF8 = function():string {
    return byteArrayToUTF8(outdata);
  }
}

export function stringToByteArray(s:string) : Uint8Array {
  var a = new Uint8Array(s.length);
  for (var i=0; i<s.length; i++)
    a[i] = s.charCodeAt(i);
  return a;
}

export function byteArrayToString(data : number[] | Uint8Array) : string {
  var str = "";
  if (data != null) {
    var charLUT = new Array();
    for (var i = 0; i < 256; ++i)
      charLUT[i] = String.fromCharCode(i);
    var len = data.length;
    for (var i = 0; i < len; i++)
      str += charLUT[data[i]];
  }
  return str;
}

export function byteArrayToUTF8(data : number[] | Uint8Array) : string {
  var str = "";
  var charLUT = new Array();
  for (var i = 0; i < 128; ++i)
    charLUT[i] = String.fromCharCode(i);
  var c;
  var len = data.length;
  for (var i = 0; i < len;) {
    c = data[i++];
    if (c < 128) {
      str += charLUT[c];
    } else {
      if ((c >= 192) && (c < 224)) {
        c = ((c & 31) << 6) | (data[i++] & 63);
      } else {
        c = ((c & 15) << 12) | ((data[i] & 63) << 6) | (data[i+1] & 63);
        i += 2;
        if (c == 0xfeff) continue; // ignore BOM
      }
      str += String.fromCharCode(c);
    }
  }
  return str;
}

export function removeBOM(s:string) {
  if (s.charCodeAt(0) === 0xFEFF) {
    s = s.substr(1);
  }
  return s;
}

export function isProbablyBinary(path:string, data?:number[] | Uint8Array) : boolean {
  var score = 0;
  // check extensions
  if (path) {
    path = path.toUpperCase();
    const BINEXTS = ['.CHR','.BIN','.DAT','.PAL','.NAM','.RLE','.LZ4','.NSF'];
    for (var ext of BINEXTS) {
      if (path.endsWith(ext)) score++;
    }
  }
  // decode as UTF-8
  for (var i = 0; i < (data?data.length:0);) {
    let c = data[i++];
    if ((c & 0x80) == 0) {
      // more likely binary if we see a NUL or obscure control character
      if (c < 9 || (c >= 14 && c < 26) || c == 0x7f) {
        score++;
        break;
      }
    } else {
      // look for invalid unicode sequences
      var nextra = 0;
      if ((c & 0xe0) == 0xc0) nextra = 1;
      else if ((c & 0xf0) == 0xe0) nextra = 2;
      else if ((c & 0xf8) == 0xf0) nextra = 3;
      else if (c < 0xa0) score++;
      else if (c == 0xff) score++;
      while (nextra--) {
        if (i >= data.length || (data[i++] & 0xc0) != 0x80) {
          score++;
          break;
        }
      }
    }
  }
  return score > 0;
}

// need to load liblzg.js first
export function compressLZG(em_module, inBuffer:number[], levelArg?:boolean) : Uint8Array {
  var level = levelArg || 9;
  var inLen = inBuffer.length;
  var inPtr = em_module._malloc(inLen + 1);
  for (var i = 0; i < inLen; i++) {
      em_module.setValue(inPtr + i, inBuffer[i], 'i8');
  }
  var maxEncSize = em_module._LZG_MaxEncodedSize(inLen);
  var outPtr = em_module._malloc(maxEncSize + 1);
  var compLen = em_module.ccall('compress_lzg', 'number', ['number', 'number', 'number', 'number', 'number'], [level, inPtr, inLen, maxEncSize, outPtr]);
  em_module._free(inPtr);
  var outBuffer = new Uint8Array(compLen);
  for (var i = 0; i < compLen; i++) {
      outBuffer[i] = em_module.getValue(outPtr + i, 'i8');
  }
  em_module._free(outPtr);
  return outBuffer;
}

// only does primitives, 1D arrays and no recursion
export function safe_extend(deep, dest, src) {
  // TODO: deep ignored
  for (var key in src) {
    var val = src[key];
    var type = typeof(val);
    if (val === null || type == 'undefined') {
      dest[key] = val;
    } else if (type == 'function') {
      // ignore function
    } else if (type == 'object') {
      if (val['slice']) { // array?
        dest[key] = val.slice();
      } else {
        // ignore object
      }
    } else {
      dest[key] = val;
    }
  }
  return dest;
}

export function printFlags(val:number, names:string[], r2l:boolean) {
  var s = '';
  for (var i=0; i<names.length; i++) {
    if (names[i]) {
      var bit = 1 << (r2l ? (names.length-1-i) : i);
      if (i > 0) s += " ";
      s += (val & bit) ? names[i] : "-";
    }
  }
  return s;
}

export function rgb2bgr(x) {
  return ((x&0xff)<<16) | ((x>>16)&0xff) | (x&0x00ff00);
}

export function RGBA(r:number,g:number,b:number) {
  return (r&0xff) | ((g&0xff)<<8) | ((b&0xff)<<16) | 0xff000000;
}

export function clamp(minv:number, maxv:number, v:number) {
  return (v < minv) ? minv : (v > maxv) ? maxv : v;
}

export function safeident(s : string) : string {
  // if starts with non-alpha character, prefix with '_'
  if (s.length == 0) return '';
  if (!s.match(/^[a-zA-Z_]/)) s = '_' + s;
  return s.replace(/\W+/g, "_");
}

export function rle_unpack(src : Uint8Array) : Uint8Array {
  var i = 0;
  var tag = src[i++];
  var dest = [];
  var data = tag;
  while (i < src.length) {
    var ch = src[i++];
    if (ch == tag) {
      var count = src[i++];
      for (var j=0; j<count; j++)
        dest.push(data);
      if (count == 0)
        break;
    } else {
      data = ch;
      dest.push(data);
    }
  }
  return new Uint8Array(dest);
}

// firefox doesn't do GET with binary files
// TODO: replace with fetch()?
export function getWithBinary(url:string, success:(text:string|Uint8Array)=>void, datatype:'text'|'arraybuffer') {
  var oReq = new XMLHttpRequest();
  oReq.open("GET", url, true);
  oReq.responseType = datatype;
  oReq.onload = function (oEvent) {
    if (oReq.status == 200) {
      var data = oReq.response;
      if (data instanceof ArrayBuffer) {
        data = new Uint8Array(data);
      }
      success(data);
    } else if (oReq.status == 404) {
      console.warn("File not found: " + url);
      success(null);
    } else {
      throw Error("Error " + oReq.status + " loading " + url);
    }
  }
  oReq.onerror = function (oEvent) {
    success(null);
  }
  oReq.ontimeout = function (oEvent) {
    throw Error("Timeout loading " + url);
  }
  oReq.send(null);
}

// get platform ID without . emulator
export function getBasePlatform(platform : string) : string {
  return platform.split('.')[0];
}

// get platform ID without - specialization
function getRootPlatform(platform : string) : string {
  return platform.split('-')[0];
}

// get platform ID without emulator or specialization
export function getRootBasePlatform(platform : string) : string {
  return getRootPlatform(getBasePlatform(platform));
}

export function isArray(obj: any) : obj is ArrayLike<any> {
  return obj != null && (Array.isArray(obj) || isTypedArray(obj));
}

export function isTypedArray(obj: any) : obj is ArrayLike<number> {
  return obj != null && obj['BYTES_PER_ELEMENT'];
}

export function convertDataToUint8Array(data: string|Uint8Array) : Uint8Array {
  return (typeof data === 'string') ? stringToByteArray(data) : data;
}

export function convertDataToString(data: string|Uint8Array) : string {
  return (data instanceof Uint8Array) ? byteArrayToUTF8(data) : data;
}

export function byteToASCII(b: number) : string {
  if (b < 32)
    return String.fromCharCode(b + 0x2400);
  else
    return String.fromCharCode(b);
}

export function loadScript(scriptfn:string) : Promise<Event> {
  return new Promise( (resolve, reject) => {
    var script = document.createElement('script');
    script.onload = resolve;
    script.onerror = reject;
    script.src = scriptfn;
    document.getElementsByTagName('head')[0].appendChild(script);
  });
}

export function decodeQueryString(qs : string) : {} {
  if (qs.startsWith('?')) qs = qs.substr(1);
  var a = qs.split('&');
  if (!a || a.length == 0)
      return {};
  var b = {};
  for (var i = 0; i < a.length; ++i) {
      var p = a[i].split('=', 2);
      if (p.length == 1)
          b[p[0]] = "";
      else
          b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
  }
  return b;
}

export function parseBool(s : string) : boolean {
  if (!s) return false;
  if (s == 'false' || s == '0') return false;
  if (s == 'true' || s == '1') return true;
  return s ? true : false;
}

///

export class XMLParseError extends Error {
}

export interface XMLNode {
  type: string;
  text: string | null;
  children: XMLNode[];
  attrs: { [id: string]: string };
  obj: any;
}

export type XMLVisitFunction = (node: XMLNode) => any;

function escapeXML(s: string): string {
  if (s.indexOf('&') >= 0) {
      return s.replace(/&apos;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&gt;/g, '>')
          .replace(/&lt;/g, '<')
          .replace(/&amp;/g, '&');
  } else {
      return s;
  }
}

export function parseXMLPoorly(s: string, openfn?: XMLVisitFunction, closefn?: XMLVisitFunction): XMLNode {
  const tag_re = /[<]([/]?)([?a-z_-]+)([^>]*)[>]+|(\s*[^<]+)/gi;
  const attr_re = /\s*(\w+)="(.*?)"\s*/gi;
  var fm: RegExpMatchArray;
  var stack: XMLNode[] = [];
  var top: XMLNode;

  function closetop() {
      top = stack.pop();
      if (top == null || top.type != ident) throw new XMLParseError("mismatch close tag: " + ident);
      if (closefn) {
          top.obj = closefn(top);
      }
      if (stack.length == 0) throw new XMLParseError("close tag without open: " + ident);
      stack[stack.length - 1].children.push(top);
  }
  function parseattrs(as: string): { [id: string]: string } {
      var am;
      var attrs = {};
      if (as != null) {
          while (am = attr_re.exec(as)) {
              attrs[am[1]] = escapeXML(am[2]);
          }
      }
      return attrs;
  }
  while (fm = tag_re.exec(s)) {
      var [_m0, close, ident, attrs, content] = fm;
      //console.log(stack.length, close, ident, attrs, content);
      if (close) {
          closetop();
      } else if (ident) {
          var node = { type: ident, text: null, children: [], attrs: parseattrs(attrs), obj: null };
          stack.push(node);
          if (attrs) {
              parseattrs(attrs);
          }
          if (openfn) {
              node.obj = openfn(node);
          }
          if (attrs && attrs.endsWith('/')) closetop();
      } else if (content != null) {
          if (stack.length == 0) throw new XMLParseError("content without element");
          var txt = escapeXML(content as string).trim();
          if (txt.length) stack[stack.length - 1].text = txt;
      }
  }
  if (stack.length != 1) throw new XMLParseError("tag not closed");
  if (stack[0].type != '?xml') throw new XMLParseError("?xml needs to be first element");
  return top;
}

export function escapeHTML(s: string): string {
  return s.replace(/[&]/g, '&amp;').replace(/[<]/g, '&lt;').replace(/[>]/g, '&gt;');
}

// lame factorization for displaying bitmaps
// returns a > b such that a * b == x (or higher), a >= mina, b >= minb
export function findIntegerFactors(x: number, mina: number, minb: number, aspect: number) : {a: number, b: number} {
  let a = x;
  let b = 1;
  if (minb > 1 && minb < a) {
    a = Math.ceil(x / minb);
    b = minb;
  }
  while (a > b) {
    let a2 = a;
    let b2 = b;
    if ((a & 1) == 0) {
      b2 = b * 2;
      a2 = a / 2;
    }
    if ((a % 3) == 0) {
      b2 = b * 3;
      a2 = a / 3;
    }
    if ((a % 5) == 0) {
      b2 = b * 5;
      a2 = a / 5;
    }
    if (a2 < mina) break;
    if (a2 < b2 * aspect) break;
    a = a2;
    b = b2;
  }
  return {a, b};
}

export class FileDataCache {
  maxSize : number = 8000000;
  size : number;
  cache : Map<string, string|Uint8Array>;
  constructor() {
    this.reset();
  }
  get(key : string) : string|Uint8Array {
    return this.cache.get(key);
  }
  put(key : string, value : string|Uint8Array) {
    this.cache.set(key, value);
    this.size += value.length;
    if (this.size > this.maxSize) {
      console.log('cache reset', this);
      this.reset();
    }
  }
  reset() {
    this.cache = new Map();
    this.size = 0;
  }
}

export function coerceToArray<T>(arrobj: any) : T[] {
    if (Array.isArray(arrobj)) return arrobj;
    else if (arrobj != null && typeof arrobj[Symbol.iterator] === 'function') return Array.from(arrobj);
    else if (typeof arrobj === 'object') return Array.from(Object.values(arrobj))
    else throw new Error(`Expected array or object, got "${arrobj}"`);
}

export function replaceAll(s:string, search:string, replace:string) : string {
  if (s == '') return '';
  if (search == '') return s;
  return s.split(search).join(replace);
}

export function getCookie(name: string) : string {
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for(var i=0;i < ca.length;i++) {
      var c = ca[i];
      while (c.charAt(0)==' ') c = c.substring(1,c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  }
  return null;
}

