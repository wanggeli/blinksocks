import crypto from 'crypto';
import {IPreset} from './defs';
import {Utils, AdvancedBuffer} from '../utils';

const stb = Utils.hexStringToBuffer;

const TLS_STAGE_HELLO = 1;
const TLS_STAGE_CHANGE_CIPHER_SPEC = 2;
const TLS_STAGE_APPLICATION_DATA = 3;

const MIN_AD_PAYLOAD_LEN = 0x0800;
const MAX_AD_PAYLOAD_LEN = 0x3FFF;

/**
 * wrap buffer to Application Data
 * @param buffer
 * @returns {Buffer}
 * @constructor
 */
function ApplicationData(buffer) {
  const len = Utils.numberToUInt(buffer.length);
  return Buffer.concat([stb('170303'), len, buffer]);
}

/**
 * @description
 *   Do TLS handshake using SessionTicket TLS mechanism, transfer data inside of Application Data.
 *
 * @params
 *   sni: Server Name Indication.
 *
 * @examples
 *   {
 *     "name": "obfs-tls1.2-ticket",
 *     "params": {
 *       "sni": "www.bing.com"
 *     }
 *   }
 *
 * @protocol
 *   C ---- Client Hello ---> S
 *   C <--- Server Hello, Change Cipher Spec, Finished --- S
 *   C ---- Change Cipher Spec, Finished, Application Data, Application Data, ... ---> S
 *   C <--- Application Data, Application Data, ... ---> S
 *
 * @reference
 *   [1] SNI
 *       https://en.wikipedia.org/wiki/Server_Name_Indication
 */
export default class ObfsTLS12TicketPreset extends IPreset {

  _sni = null;

  _stage = TLS_STAGE_HELLO;

  _pending = null;

  _adBuf = null;

  constructor({sni}) {
    super();
    this.onReceiving = this.onReceiving.bind(this);
    this.onChunkReceived = this.onChunkReceived.bind(this);
    this._sni = Buffer.from(sni || '');
    this._adBuf = new AdvancedBuffer({getPacketLength: this.onReceiving});
    this._adBuf.on('data', this.onChunkReceived);
  }

  clientOut({buffer, direct}) {
    if (this._stage === TLS_STAGE_HELLO) {
      this._stage = TLS_STAGE_CHANGE_CIPHER_SPEC;
      this._pending = buffer;
      // Send Client Hello

      // Random
      const random = [
        ...Utils.getUTC(),                  // GMT Unix Time
        ...crypto.randomBytes(28),          // Random Bytes
      ];
      // Session
      const session = [
        ...stb('20'),                // Session ID Length
        ...crypto.randomBytes(0x20), // Session ID
      ];
      // Cipher Suites
      const cipher_suites = [
        ...stb('001a'), // Cipher Suites Length
        ...stb('c02b'), // Cipher Suite: TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256 (0xc02b)
        ...stb('c02f'), // Cipher Suite: TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 (0xc02f)
        ...stb('c02c'), // Cipher Suite: TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384 (0xc02c)
        ...stb('c030'), // Cipher Suite: TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 (0xc030)
        ...stb('cc14'), // Cipher Suite: TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256 (0xcc14)
        ...stb('cc13'), // Cipher Suite: TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256 (0xcc13)
        ...stb('c013'), // Cipher Suite: TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA (0xc013)
        ...stb('c014'), // Cipher Suite: TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA (0xc014)
        ...stb('009c'), // Cipher Suite: TLS_RSA_WITH_AES_128_GCM_SHA256 (0x009c)
        ...stb('009d'), // Cipher Suite: TLS_RSA_WITH_AES_256_GCM_SHA384 (0x009d)
        ...stb('002f'), // Cipher Suite: TLS_RSA_WITH_AES_128_CBC_SHA (0x002f)
        ...stb('0035'), // Cipher Suite: TLS_RSA_WITH_AES_256_CBC_SHA (0x0035)
        ...stb('000a'), // Cipher Suite: TLS_RSA_WITH_3DES_EDE_CBC_SHA (0x000a)
      ];
      // Extension: server_name
      const ext_server_name = [
        ...stb('0000'),                                      // Type: server_name
        ...Utils.numberToUInt(2 + 1 + 2 + this._sni.length), // Length
        ...Utils.numberToUInt(1 + 2 + this._sni.length),     // Server Name List length
        ...stb('00'),                                        // Server Name Type: host_name(0)
        ...Utils.numberToUInt(this._sni.length),             // Server Name length
        ...this._sni,                                        // Server Name
      ];
      // Extension: SessionTicket TLS
      const ticketLen = Utils.getRandomInt(200, 400);
      const session_ticket = [
        ...stb('0023'),                   // Type: SessionTicket TLS
        ...Utils.numberToUInt(ticketLen), // Length
        ...crypto.randomBytes(ticketLen), // Data
      ];
      // Extensions
      const exts = [
        ...stb('ff01000100'),                                       // Extension: renegotiation_info
        ...ext_server_name,                                         // Extension: server_name
        ...stb('00170000'),                                         // Extension: Extended Master Secret
        ...session_ticket,                                          // Extension: SessionTicket TLS
        ...stb('000d00140012040308040401050308050501080606010201'), // Extension: signature_algorithms
        ...stb('000500050100000000'),                               // Extension: status_request
        ...stb('00120000'),                                         // Extension: signed_certificate_timestamp
        ...stb('75500000'),                                         // Extension: channel_id
        ...stb('000b00020100'),                                     // Extension: ec_point_formats
        ...stb('000a0006000400170018')                              // Extension: elliptic_curves
      ];

      const body = [
        ...stb('0303'),                     // Version: TLS 1.2
        ...random,                          // Random
        ...session,                         // Session
        ...cipher_suites,                   // Cipher Suites
        ...stb('01'),                       // Compression Methods Length
        ...stb('00'),                       // Compression Methods = [null]
        ...Utils.numberToUInt(exts.length), // Extension Length
        ...exts                             // Extensions
      ];
      const header = [
        ...stb('16'),                               // Content Type: Handshake
        ...stb('0301'),                             // Version: TLS 1.0
        ...Utils.numberToUInt(1 + 3 + body.length), // Length
        ...stb('01'),                               // Handshake Type: ClientHello
        ...Utils.numberToUInt(body.length, 3)       // Length
      ];
      return direct(Buffer.from([...header, ...body]));
    }

    if (this._stage === TLS_STAGE_APPLICATION_DATA) {
      // Send Application Data
      const chunks = Utils.getRandomChunks(buffer, MIN_AD_PAYLOAD_LEN, MAX_AD_PAYLOAD_LEN)
        .map((chunk) => ApplicationData(chunk));
      return Buffer.concat(chunks);
    }
  }

  serverIn({buffer, next, direct, fail}) {
    if (this._stage === TLS_STAGE_HELLO) {
      this._stage = TLS_STAGE_CHANGE_CIPHER_SPEC;

      // 1. Check Client Hello

      if (buffer.length < 200) {
        fail(`TLS handshake header(${buffer.length} bytes) is too short`);
        return;
      }

      if (!buffer.slice(0, 3).equals(stb('160301'))) {
        fail('invalid TLS handshake header');
        return;
      }

      const tlsLen = buffer.slice(3, 5).readUInt16BE(0);

      if (tlsLen !== buffer.length - 5) {
        fail('unexpected TLS handshake header length');
        return;
      }

      // 2. Send Server Hello, Change Cipher Spec, Finished

      // Random
      const random = [
        ...Utils.getUTC(),         // GMT Unix Time
        ...crypto.randomBytes(28), // Random Bytes
      ];
      // Session
      const session = [
        ...stb('20'),                // Session ID Length
        ...crypto.randomBytes(0x20), // Session ID
      ];
      // Extensions
      const exts = [
        ...stb('ff01000100'), // Extension: renegotiation_info
        ...stb('00050000'),   // Extension: status_request
        ...stb('00170000')    // Extension: Extended Master Secret
      ];

      // Change Cipher Spec
      const change_cipher_spec = [
        ...stb('140303000101')
      ];

      // Finished
      const finishedLen = Utils.getRandomInt(32, 40);
      const finished = [
        ...stb('16'),                       // Content Type: Handshake
        ...stb('0303'),                     // Version: TLS 1.2
        ...Utils.numberToUInt(finishedLen), // Length
        ...crypto.randomBytes(finishedLen)
      ];

      const body = [
        ...stb('0303'),                     // Version: TLS 1.2
        ...random,                          // Random
        ...session,                         // Session
        ...stb('c02f'),                     // Cipher Suite
        ...stb('00'),                       // Compression Method
        ...Utils.numberToUInt(exts.length), // Extension Length
        ...exts                             // Extensions
      ];
      const header = [
        ...stb('16'),                               // Content Type: Handshake
        ...stb('0303'),                             // Version: TLS 1.2
        ...Utils.numberToUInt(1 + 3 + body.length), // Length
        ...stb('02'),                               // Handshake Type: Server Hello
        ...Utils.numberToUInt(body.length, 3)       // Length
      ];

      return direct(Buffer.from([...header, ...body, ...change_cipher_spec, ...finished]), true);
    }

    let _buffer = buffer;

    if (this._stage === TLS_STAGE_CHANGE_CIPHER_SPEC) {
      this._stage = TLS_STAGE_APPLICATION_DATA;
      // TODO: 1. Check Client Change Cipher Spec

      // 2. Drop Client Change Cipher Spec
      _buffer = buffer.slice(43);
    }

    this._adBuf.put(_buffer, {next, fail});
  }

  serverOut({buffer}) {
    // Send Application Data
    const chunks = Utils.getRandomChunks(buffer, MIN_AD_PAYLOAD_LEN, MAX_AD_PAYLOAD_LEN)
      .map((chunk) => ApplicationData(chunk));
    return Buffer.concat(chunks);
  }

  clientIn({buffer, next, direct, fail}) {
    if (this._stage === TLS_STAGE_CHANGE_CIPHER_SPEC) {
      this._stage = TLS_STAGE_APPLICATION_DATA;
      // TODO: 1. Check Server Hello

      // 2. Send Change Cipher Spec(43 bytes fixed) and Pending Data

      // Change Cipher Spec
      const change_cipher_spec = [
        ...stb('140303000101')
      ];
      // Finished
      const finished = [
        ...stb('16'),   // Content Type: Handshake
        ...stb('0303'), // Version: TLS 1.2
        ...stb('0020'), // Length: 32
        ...crypto.randomBytes(0x20),
      ];
      // Application Data
      const chunks = Utils.getRandomChunks(this._pending, MIN_AD_PAYLOAD_LEN, MAX_AD_PAYLOAD_LEN)
        .map((chunk) => ApplicationData(chunk));
      this._pending = null;
      return direct(Buffer.from([...change_cipher_spec, ...finished, ...Buffer.concat(chunks)]), true);
    }
    this._adBuf.put(buffer, {next, fail});
  }

  onReceiving(buffer, {fail}) {
    if (buffer.length < 5) {
      fail(`Application Data is too short: ${buffer.length} bytes`);
      return;
    }
    return 5 + buffer.readUInt16BE(3);
  }

  onChunkReceived(chunk, {next}) {
    // Drop TLS Application Data header
    next(chunk.slice(5));
  }

}
