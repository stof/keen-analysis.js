var each = require('keen-tracking/lib/utils/each'),
    json = require('keen-tracking/lib/utils/json');

module.exports = {
  'GET'    : get,
  'POST'   : post,
  'PUT'    : put,
  'DELETE' : del
};


// HTTP Handlers
// ------------------------------

function get(config, callback){
  if (xhrObject()) {
    return sendXhr('GET', config, callback);
  }
  else if (xdrObject()){
    return sendXdr('GET', config, callback);
  }
  else {
    return sendJsonp(config, callback);
  }
}

function post(config, callback){
  if (xhrObject()) {
    return sendXhr('POST', config, callback);
  }
  else if (xdrObject()){
    return sendXdr('POST', config, callback);
  }
  else {
    callback('XHR POST not supported', null);
  }
}

function put(config, callback) {
  if (xhrObject()) {
    return sendXhr('PUT', config, callback);
  }
  else {
    callback('XHR PUT not supported', null);
  }
}

function del(config, callback) {
  if (xhrObject()) {
    return sendXhr('DELETE', config, callback);
  }
  else {
    callback('XHR DELETE not supported', null);
  }
}


// XMLHttpRequest Support
// ------------------------------

function xhrObject() {
  var root = 'undefined' == typeof window ? this : window;
  if (root.XMLHttpRequest && ('file:' != root.location.protocol || !root.ActiveXObject)) {
    return new XMLHttpRequest;
  } else {
    try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch(e) {}
  }
  return false;
}

function sendXhr(method, config, callback){
  var xhr = xhrObject(),
      cb = callback,
      url = config.url;

  callback = null;

  xhr.onreadystatechange = function() {
    var response;
    if (xhr.readyState == 4) {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          response = json.parse( xhr.responseText );
        } catch (e) {
          if (cb) {
            cb(xhr, null);
          }
        }
        if (cb && response) {
          cb(null, response);
        }
      }
      else {
        if (cb) {
          cb(xhr, null);
        }
      }
    }
  };

  if (method !== 'GET') {
    xhr.open(method, url, true);
    xhr.setRequestHeader('Authorization', config.api_key);
    xhr.setRequestHeader('Content-type', 'application/json');
    if (config.params) {
      xhr.send( json.stringify(config.params) );
    }
    else {
      xhr.send();
    }
  }
  else {
    url += '?api_key=' + config.api_key;
    if (config.params) {
      url += '&' + serialize(config.params);
    }
    xhr.open(method, url, true);
    xhr.send();
  }

}


// XDomainRequest Support
// ------------------------------

function xdrObject() {
  var root = 'undefined' == typeof window ? this : window;
  if (root.XDomainRequest) {
    return new root.XDomainRequest();
  }
  return false;
}

function sendXdr(method, config, callback) {
  var xdr = xdrObject(),
      cb = callback;

  if (xdr) {
    xdr.timeout = config.timeout || 300 * 1000;

    xdr.ontimeout = function () {
      handleResponse(xdr, null);
    };

    xdr.onerror = function () {
      handleResponse(xdr, null);
    };

    xdr.onload = function() {
      var response = json.parse(xdr.responseText);
      handleResponse(null, response);
    };

    xdr.open(method.toLowerCase(), config.url);

    setTimeout(function () {
      if (config['params']) {
        xdr.send( serialize(config['params']) );
      }
      else {
        xdr.send();
      }
    }, 0);
  }

  function handleResponse(a, b){
    if (cb && typeof cb === 'function') {
      cb(a, b);
      callback = cb = void 0;
    }
  }

}


// JSON-P Support
// ------------------------------

function sendJsonp(config, callback){
  var url = config.url,
      cb = callback,
      timestamp = new Date().getTime(),
      script = document.createElement('script'),
      parent = document.getElementsByTagName('head')[0],
      callbackName = 'keenJSONPCallback',
      loaded = false;

  callbackName += timestamp;
  while (callbackName in window) {
    callbackName += 'a';
  }

  window[callbackName] = function(response) {
    if (loaded === true) {
      return;
    }
    handleResponse(null, response);
  };

  if (config.params) {
    url += serialize(config.params);
  }

  // Early IE (no onerror event)
  script.onreadystatechange = function() {
    if (loaded === false && this.readyState === 'loaded') {
      handleResponse('An error occurred', null);
    }
  };

  // Not IE
  script.onerror = function() {
    // on IE9 both onerror and onreadystatechange are called
    if (loaded === false) {
      handleResponse('An error occurred', null);
    }
  };

  script.src = url + '&jsonp=' + callbackName;
  parent.appendChild(script);

  function handleResponse(a, b){
    loaded = true;
    if (cb && typeof cb === 'function') {
      cb(a, b);
      callback = cb = void 0;
    }
    window[callbackName] = undefined;
    try {
      delete window[callbackName];
    } catch(e){};
    parent.removeChild(script);
  }

}


function serialize(data){
  var query = [];
  each(data, function(value, key){
    if (typeof value !== 'string') {
      value = json.stringify(value);
    }
    query.push(key + '=' + encodeURIComponent(value));
  });
  return query.join('&');
}