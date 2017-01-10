'use strict';Object.defineProperty(exports,'__esModule',{value:true});exports.Utils=undefined;var _createClass=function(){function defineProperties(target,props){for(var i=0;i<props.length;i++){var descriptor=props[i];descriptor.enumerable=descriptor.enumerable||false;descriptor.configurable=true;if('value'in descriptor)descriptor.writable=true;Object.defineProperty(target,descriptor.key,descriptor)}}return function(Constructor,protoProps,staticProps){if(protoProps)defineProperties(Constructor.prototype,protoProps);if(staticProps)defineProperties(Constructor,staticProps);return Constructor}}();var _net=require('net');var _net2=_interopRequireDefault(_net);var _url=require('url');var _url2=_interopRequireDefault(_url);var _ip=require('ip');var _ip2=_interopRequireDefault(_ip);var _Address=require('../Address');var _common=require('../../protocols/common');function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj}}function _toConsumableArray(arr){if(Array.isArray(arr)){for(var i=0,arr2=Array(arr.length);i<arr.length;i++){arr2[i]=arr[i]}return arr2}else{return Array.from(arr)}}function _classCallCheck(instance,Constructor){if(!(instance instanceof Constructor)){throw new TypeError('Cannot call a class as a function')}}var Utils=exports.Utils=function(){function Utils(){_classCallCheck(this,Utils)}_createClass(Utils,null,[{key:'numberToArray',/**
   * convert a number to byte array
   * @example
   *   numberToArray(257); // [0x01, 0x01]
   * @param num
   * @param minSize
   * @returns {Array.<*>}
   */value:function numberToArray(num){var minSize=arguments.length>1&&arguments[1]!==undefined?arguments[1]:2;var arr=[];do{arr.push(num&255);num>>=8}while(num>0);if(arr.length<minSize){var padding=[];for(var i=0,len=minSize-arr.length;i<len;++i){padding.push(0)}arr=[].concat(_toConsumableArray(arr),padding)}return arr.reverse()}/**
   * convert an uri to Address
   * @param uri
   * @returns {Address}
   */},{key:'hostToAddress',value:function hostToAddress(uri){var _uri=uri;if(_uri.indexOf('http')!==0||_uri.indexOf('https')!==0){if(_uri.indexOf(':443')!==-1){// e.g, bing.com:443
_uri='https://'+_uri}else{// e.g, bing.com
_uri='http://'+_uri}}var _url$parse=_url2.default.parse(_uri),hostname=_url$parse.hostname,port=_url$parse.port;var addrType=_net2.default.isIP(hostname)?_net2.default.isIPv4(hostname)?_common.ATYP_V4:_common.ATYP_V6:_common.ATYP_DOMAIN;var dstAddr=_net2.default.isIP(hostname)?_ip2.default.toBuffer(hostname):Buffer.from(hostname);var dstPort=Buffer.from(Utils.numberToArray(port===null?80:port));return new _Address.Address({ATYP:addrType,DSTADDR:dstAddr,DSTPORT:dstPort})}}]);return Utils}();