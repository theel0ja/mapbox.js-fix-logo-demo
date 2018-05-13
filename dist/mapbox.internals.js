(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
function corslite(url, callback, cors) {
    var sent = false;

    if (typeof window.XMLHttpRequest === 'undefined') {
        return callback(Error('Browser not supported'));
    }

    if (typeof cors === 'undefined') {
        var m = url.match(/^\s*https?:\/\/[^\/]*/);
        cors = m && (m[0] !== location.protocol + '//' + location.domain +
                (location.port ? ':' + location.port : ''));
    }

    var x = new window.XMLHttpRequest();

    function isSuccessful(status) {
        return status >= 200 && status < 300 || status === 304;
    }

    if (cors && !('withCredentials' in x)) {
        // IE8-9
        x = new window.XDomainRequest();

        // Ensure callback is never called synchronously, i.e., before
        // x.send() returns (this has been observed in the wild).
        // See https://github.com/mapbox/mapbox.js/issues/472
        var original = callback;
        callback = function() {
            if (sent) {
                original.apply(this, arguments);
            } else {
                var that = this, args = arguments;
                setTimeout(function() {
                    original.apply(that, args);
                }, 0);
            }
        }
    }

    function loaded() {
        if (
            // XDomainRequest
            x.status === undefined ||
            // modern browsers
            isSuccessful(x.status)) callback.call(x, null, x);
        else callback.call(x, x, null);
    }

    // Both `onreadystatechange` and `onload` can fire. `onreadystatechange`
    // has [been supported for longer](http://stackoverflow.com/a/9181508/229001).
    if ('onload' in x) {
        x.onload = loaded;
    } else {
        x.onreadystatechange = function readystate() {
            if (x.readyState === 4) {
                loaded();
            }
        };
    }

    // Call the callback with the XMLHttpRequest object as an error and prevent
    // it from ever being called again by reassigning it to `noop`
    x.onerror = function error(evt) {
        // XDomainRequest provides no evt parameter
        callback.call(this, evt || true, null);
        callback = function() { };
    };

    // IE9 must have onprogress be set to a unique function.
    x.onprogress = function() { };

    x.ontimeout = function(evt) {
        callback.call(this, evt, null);
        callback = function() { };
    };

    x.onabort = function(evt) {
        callback.call(this, evt, null);
        callback = function() { };
    };

    // GET is the only supported HTTP Verb by XDomainRequest and is the
    // only one supported here.
    x.open('GET', url, true);

    // Send the request. Sending data is not supported.
    x.send(null);
    sent = true;

    return x;
}

if (typeof module !== 'undefined') module.exports = corslite;

},{}],2:[function(require,module,exports){
module.exports={
  "author": "Mapbox",
  "name": "mapbox.js",
  "description": "mapbox javascript api",
  "version": "3.1.1",
  "homepage": "http://mapbox.com/",
  "repository": {
    "type": "git",
    "url": "git://github.com/mapbox/mapbox.js.git"
  },
  "main": "src/index.js",
  "dependencies": {
    "corslite": "0.0.6",
    "isarray": "0.0.1",
    "leaflet": "1.0.2",
    "mustache": "2.2.1",
    "sanitize-caja": "0.1.4"
  },
  "scripts": {
    "test": "eslint --no-eslintrc -c .eslintrc src && phantomjs node_modules/mocha-phantomjs-core/mocha-phantomjs-core.js test/index.html"
  },
  "license": "BSD-3-Clause",
  "devDependencies": {
    "browserify": "^13.0.0",
    "clean-css": "~2.0.7",
    "cz-conventional-changelog": "1.2.0",
    "eslint": "^0.23.0",
    "expect.js": "0.3.1",
    "happen": "0.1.3",
    "leaflet-fullscreen": "0.0.4",
    "leaflet-hash": "0.2.1",
    "marked": "~0.3.0",
    "minifyify": "^6.1.0",
    "minimist": "0.0.5",
    "mocha": "2.4.5",
    "mocha-phantomjs-core": "2.0.1",
    "phantomjs-prebuilt": "2.1.12",
    "sinon": "1.10.2"
  },
  "optionalDependencies": {},
  "engines": {
    "node": "*"
  },
  "config": {
    "commitizen": {
      "path": "./node_modules/cz-conventional-changelog"
    }
  }
}

},{}],3:[function(require,module,exports){
'use strict';

module.exports = {
    HTTP_URL: 'http://a.tiles.mapbox.com/v4',
    HTTPS_URL: 'https://a.tiles.mapbox.com/v4',
    FORCE_HTTPS: false,
    REQUIRE_ACCESS_TOKEN: true
};

},{}],4:[function(require,module,exports){
'use strict';

var config = require('./config'),
    version = require('../package.json').version;

module.exports = function(path, accessToken) {
    accessToken = accessToken || L.mapbox.accessToken;

    if (!accessToken && config.REQUIRE_ACCESS_TOKEN) {
        throw new Error('An API access token is required to use Mapbox.js. ' +
            'See https://www.mapbox.com/mapbox.js/api/v' + version + '/api-access-tokens/');
    }

    var url = (document.location.protocol === 'https:' || config.FORCE_HTTPS) ? config.HTTPS_URL : config.HTTP_URL;
    url = url.replace(/\/v4$/, '');
    url += path;

    if (config.REQUIRE_ACCESS_TOKEN) {
        if (accessToken[0] === 's') {
            throw new Error('Use a public access token (pk.*) with Mapbox.js, not a secret access token (sk.*). ' +
                'See https://www.mapbox.com/mapbox.js/api/v' + version + '/api-access-tokens/');
        }

        url += url.indexOf('?') !== -1 ? '&access_token=' : '?access_token=';
        url += accessToken;
    }

    return url;
};

module.exports.tileJSON = function(urlOrMapID, accessToken) {

    if (urlOrMapID.indexOf('mapbox://styles') === 0) {
        throw new Error('Styles created with Mapbox Studio need to be used with ' +
            'L.mapbox.styleLayer, not L.mapbox.tileLayer');
    }

    if (urlOrMapID.indexOf('/') !== -1)
        return urlOrMapID;

    var url = module.exports('/v4/' + urlOrMapID + '.json', accessToken);

    // TileJSON requests need a secure flag appended to their URLs so
    // that the server knows to send SSL-ified resource references.
    if (url.indexOf('https') === 0)
        url += '&secure';

    return url;
};


module.exports.style = function(styleURL, accessToken) {
    if (styleURL.indexOf('mapbox://styles/') === -1) throw new Error('Incorrectly formatted Mapbox style at ' + styleURL);

    var ownerIDStyle = styleURL.split('mapbox://styles/')[1];
    var url = module.exports('/styles/v1/' + ownerIDStyle, accessToken)
        .replace('http://', 'https://');

    return url;
};

},{"../package.json":2,"./config":3}],5:[function(require,module,exports){
'use strict';

function utfDecode(c) {
    if (c >= 93) c--;
    if (c >= 35) c--;
    return c - 32;
}

module.exports = function(data) {
    return function(x, y) {
        if (!data) return;
        var idx = utfDecode(data.grid[y].charCodeAt(x)),
            key = data.keys[idx];
        return data.data[key];
    };
};

},{}],6:[function(require,module,exports){
window.internals = {
    url: require('./format_url'),
    config: require('./config'),
    util: require('./util'),
    grid: require('./grid'),
    request: require('./request')
};

},{"./config":3,"./format_url":4,"./grid":5,"./request":7,"./util":8}],7:[function(require,module,exports){
'use strict';

var corslite = require('corslite'),
    strict = require('./util').strict,
    config = require('./config');

var protocol = /^(https?:)?(?=\/\/(.|api)\.tiles\.mapbox\.com\/)/;

module.exports = function(url, callback) {
    strict(url, 'string');
    strict(callback, 'function');

    url = url.replace(protocol, function(match, protocol) {
        if (!('withCredentials' in new window.XMLHttpRequest())) {
            // XDomainRequest in use; doesn't support cross-protocol requests
            return document.location.protocol;
        } else if (protocol === 'https:' || document.location.protocol === 'https:' || config.FORCE_HTTPS) {
            return 'https:';
        } else {
            return 'http:';
        }
    });

    function onload(err, resp) {
        if (!err && resp) {
            resp = JSON.parse(resp.responseText);
        }
        callback(err, resp);
    }

    return corslite(url, onload);
};

},{"./config":3,"./util":8,"corslite":1}],8:[function(require,module,exports){
'use strict';

function contains(item, list) {
    if (!list || !list.length) return false;
    for (var i = 0; i < list.length; i++) {
        if (list[i] === item) return true;
    }
    return false;
}

module.exports = {
    idUrl: function(_, t) {
        if (_.indexOf('/') === -1) t.loadID(_);
        else t.loadURL(_);
    },
    log: function(_) {
        if (typeof console === 'object' &&
            typeof console.error === 'function') {
            console.error(_);
        }
    },
    strict: function(_, type) {
        if (typeof _ !== type) {
            throw new Error('Invalid argument: ' + type + ' expected');
        }
    },
    strict_instance: function(_, klass, name) {
        if (!(_ instanceof klass)) {
            throw new Error('Invalid argument: ' + name + ' expected');
        }
    },
    strict_oneof: function(_, values) {
        if (!contains(_, values)) {
            throw new Error('Invalid argument: ' + _ + ' given, valid values are ' +
                values.join(', '));
        }
    },
    strip_tags: function(_) {
        return _.replace(/<[^<]+>/g, '');
    },
    lbounds: function(_) {
        // leaflet-compatible bounds, since leaflet does not do geojson
        return new L.LatLngBounds([[_[1], _[0]], [_[3], _[2]]]);
    }
};

},{}]},{},[6])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvY29yc2xpdGUvY29yc2xpdGUuanMiLCJwYWNrYWdlLmpzb24iLCJzcmMvY29uZmlnLmpzIiwic3JjL2Zvcm1hdF91cmwuanMiLCJzcmMvZ3JpZC5qcyIsInNyYy9pbnRlcm5hbHMuanMiLCJzcmMvcmVxdWVzdC5qcyIsInNyYy91dGlsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiZnVuY3Rpb24gY29yc2xpdGUodXJsLCBjYWxsYmFjaywgY29ycykge1xuICAgIHZhciBzZW50ID0gZmFsc2U7XG5cbiAgICBpZiAodHlwZW9mIHdpbmRvdy5YTUxIdHRwUmVxdWVzdCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKEVycm9yKCdCcm93c2VyIG5vdCBzdXBwb3J0ZWQnKSk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBjb3JzID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICB2YXIgbSA9IHVybC5tYXRjaCgvXlxccypodHRwcz86XFwvXFwvW15cXC9dKi8pO1xuICAgICAgICBjb3JzID0gbSAmJiAobVswXSAhPT0gbG9jYXRpb24ucHJvdG9jb2wgKyAnLy8nICsgbG9jYXRpb24uZG9tYWluICtcbiAgICAgICAgICAgICAgICAobG9jYXRpb24ucG9ydCA/ICc6JyArIGxvY2F0aW9uLnBvcnQgOiAnJykpO1xuICAgIH1cblxuICAgIHZhciB4ID0gbmV3IHdpbmRvdy5YTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgZnVuY3Rpb24gaXNTdWNjZXNzZnVsKHN0YXR1cykge1xuICAgICAgICByZXR1cm4gc3RhdHVzID49IDIwMCAmJiBzdGF0dXMgPCAzMDAgfHwgc3RhdHVzID09PSAzMDQ7XG4gICAgfVxuXG4gICAgaWYgKGNvcnMgJiYgISgnd2l0aENyZWRlbnRpYWxzJyBpbiB4KSkge1xuICAgICAgICAvLyBJRTgtOVxuICAgICAgICB4ID0gbmV3IHdpbmRvdy5YRG9tYWluUmVxdWVzdCgpO1xuXG4gICAgICAgIC8vIEVuc3VyZSBjYWxsYmFjayBpcyBuZXZlciBjYWxsZWQgc3luY2hyb25vdXNseSwgaS5lLiwgYmVmb3JlXG4gICAgICAgIC8vIHguc2VuZCgpIHJldHVybnMgKHRoaXMgaGFzIGJlZW4gb2JzZXJ2ZWQgaW4gdGhlIHdpbGQpLlxuICAgICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21hcGJveC9tYXBib3guanMvaXNzdWVzLzQ3MlxuICAgICAgICB2YXIgb3JpZ2luYWwgPSBjYWxsYmFjaztcbiAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmIChzZW50KSB7XG4gICAgICAgICAgICAgICAgb3JpZ2luYWwuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzLCBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIG9yaWdpbmFsLmFwcGx5KHRoYXQsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9hZGVkKCkge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICAvLyBYRG9tYWluUmVxdWVzdFxuICAgICAgICAgICAgeC5zdGF0dXMgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgLy8gbW9kZXJuIGJyb3dzZXJzXG4gICAgICAgICAgICBpc1N1Y2Nlc3NmdWwoeC5zdGF0dXMpKSBjYWxsYmFjay5jYWxsKHgsIG51bGwsIHgpO1xuICAgICAgICBlbHNlIGNhbGxiYWNrLmNhbGwoeCwgeCwgbnVsbCk7XG4gICAgfVxuXG4gICAgLy8gQm90aCBgb25yZWFkeXN0YXRlY2hhbmdlYCBhbmQgYG9ubG9hZGAgY2FuIGZpcmUuIGBvbnJlYWR5c3RhdGVjaGFuZ2VgXG4gICAgLy8gaGFzIFtiZWVuIHN1cHBvcnRlZCBmb3IgbG9uZ2VyXShodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS85MTgxNTA4LzIyOTAwMSkuXG4gICAgaWYgKCdvbmxvYWQnIGluIHgpIHtcbiAgICAgICAgeC5vbmxvYWQgPSBsb2FkZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgeC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiByZWFkeXN0YXRlKCkge1xuICAgICAgICAgICAgaWYgKHgucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgICAgIGxvYWRlZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIENhbGwgdGhlIGNhbGxiYWNrIHdpdGggdGhlIFhNTEh0dHBSZXF1ZXN0IG9iamVjdCBhcyBhbiBlcnJvciBhbmQgcHJldmVudFxuICAgIC8vIGl0IGZyb20gZXZlciBiZWluZyBjYWxsZWQgYWdhaW4gYnkgcmVhc3NpZ25pbmcgaXQgdG8gYG5vb3BgXG4gICAgeC5vbmVycm9yID0gZnVuY3Rpb24gZXJyb3IoZXZ0KSB7XG4gICAgICAgIC8vIFhEb21haW5SZXF1ZXN0IHByb3ZpZGVzIG5vIGV2dCBwYXJhbWV0ZXJcbiAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzLCBldnQgfHwgdHJ1ZSwgbnVsbCk7XG4gICAgICAgIGNhbGxiYWNrID0gZnVuY3Rpb24oKSB7IH07XG4gICAgfTtcblxuICAgIC8vIElFOSBtdXN0IGhhdmUgb25wcm9ncmVzcyBiZSBzZXQgdG8gYSB1bmlxdWUgZnVuY3Rpb24uXG4gICAgeC5vbnByb2dyZXNzID0gZnVuY3Rpb24oKSB7IH07XG5cbiAgICB4Lm9udGltZW91dCA9IGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXMsIGV2dCwgbnVsbCk7XG4gICAgICAgIGNhbGxiYWNrID0gZnVuY3Rpb24oKSB7IH07XG4gICAgfTtcblxuICAgIHgub25hYm9ydCA9IGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXMsIGV2dCwgbnVsbCk7XG4gICAgICAgIGNhbGxiYWNrID0gZnVuY3Rpb24oKSB7IH07XG4gICAgfTtcblxuICAgIC8vIEdFVCBpcyB0aGUgb25seSBzdXBwb3J0ZWQgSFRUUCBWZXJiIGJ5IFhEb21haW5SZXF1ZXN0IGFuZCBpcyB0aGVcbiAgICAvLyBvbmx5IG9uZSBzdXBwb3J0ZWQgaGVyZS5cbiAgICB4Lm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7XG5cbiAgICAvLyBTZW5kIHRoZSByZXF1ZXN0LiBTZW5kaW5nIGRhdGEgaXMgbm90IHN1cHBvcnRlZC5cbiAgICB4LnNlbmQobnVsbCk7XG4gICAgc2VudCA9IHRydWU7XG5cbiAgICByZXR1cm4geDtcbn1cblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSBtb2R1bGUuZXhwb3J0cyA9IGNvcnNsaXRlO1xuIiwibW9kdWxlLmV4cG9ydHM9e1xuICBcImF1dGhvclwiOiBcIk1hcGJveFwiLFxuICBcIm5hbWVcIjogXCJtYXBib3guanNcIixcbiAgXCJkZXNjcmlwdGlvblwiOiBcIm1hcGJveCBqYXZhc2NyaXB0IGFwaVwiLFxuICBcInZlcnNpb25cIjogXCIzLjEuMVwiLFxuICBcImhvbWVwYWdlXCI6IFwiaHR0cDovL21hcGJveC5jb20vXCIsXG4gIFwicmVwb3NpdG9yeVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiZ2l0XCIsXG4gICAgXCJ1cmxcIjogXCJnaXQ6Ly9naXRodWIuY29tL21hcGJveC9tYXBib3guanMuZ2l0XCJcbiAgfSxcbiAgXCJtYWluXCI6IFwic3JjL2luZGV4LmpzXCIsXG4gIFwiZGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImNvcnNsaXRlXCI6IFwiMC4wLjZcIixcbiAgICBcImlzYXJyYXlcIjogXCIwLjAuMVwiLFxuICAgIFwibGVhZmxldFwiOiBcIjEuMC4yXCIsXG4gICAgXCJtdXN0YWNoZVwiOiBcIjIuMi4xXCIsXG4gICAgXCJzYW5pdGl6ZS1jYWphXCI6IFwiMC4xLjRcIlxuICB9LFxuICBcInNjcmlwdHNcIjoge1xuICAgIFwidGVzdFwiOiBcImVzbGludCAtLW5vLWVzbGludHJjIC1jIC5lc2xpbnRyYyBzcmMgJiYgcGhhbnRvbWpzIG5vZGVfbW9kdWxlcy9tb2NoYS1waGFudG9tanMtY29yZS9tb2NoYS1waGFudG9tanMtY29yZS5qcyB0ZXN0L2luZGV4Lmh0bWxcIlxuICB9LFxuICBcImxpY2Vuc2VcIjogXCJCU0QtMy1DbGF1c2VcIixcbiAgXCJkZXZEZXBlbmRlbmNpZXNcIjoge1xuICAgIFwiYnJvd3NlcmlmeVwiOiBcIl4xMy4wLjBcIixcbiAgICBcImNsZWFuLWNzc1wiOiBcIn4yLjAuN1wiLFxuICAgIFwiY3otY29udmVudGlvbmFsLWNoYW5nZWxvZ1wiOiBcIjEuMi4wXCIsXG4gICAgXCJlc2xpbnRcIjogXCJeMC4yMy4wXCIsXG4gICAgXCJleHBlY3QuanNcIjogXCIwLjMuMVwiLFxuICAgIFwiaGFwcGVuXCI6IFwiMC4xLjNcIixcbiAgICBcImxlYWZsZXQtZnVsbHNjcmVlblwiOiBcIjAuMC40XCIsXG4gICAgXCJsZWFmbGV0LWhhc2hcIjogXCIwLjIuMVwiLFxuICAgIFwibWFya2VkXCI6IFwifjAuMy4wXCIsXG4gICAgXCJtaW5pZnlpZnlcIjogXCJeNi4xLjBcIixcbiAgICBcIm1pbmltaXN0XCI6IFwiMC4wLjVcIixcbiAgICBcIm1vY2hhXCI6IFwiMi40LjVcIixcbiAgICBcIm1vY2hhLXBoYW50b21qcy1jb3JlXCI6IFwiMi4wLjFcIixcbiAgICBcInBoYW50b21qcy1wcmVidWlsdFwiOiBcIjIuMS4xMlwiLFxuICAgIFwic2lub25cIjogXCIxLjEwLjJcIlxuICB9LFxuICBcIm9wdGlvbmFsRGVwZW5kZW5jaWVzXCI6IHt9LFxuICBcImVuZ2luZXNcIjoge1xuICAgIFwibm9kZVwiOiBcIipcIlxuICB9LFxuICBcImNvbmZpZ1wiOiB7XG4gICAgXCJjb21taXRpemVuXCI6IHtcbiAgICAgIFwicGF0aFwiOiBcIi4vbm9kZV9tb2R1bGVzL2N6LWNvbnZlbnRpb25hbC1jaGFuZ2Vsb2dcIlxuICAgIH1cbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBIVFRQX1VSTDogJ2h0dHA6Ly9hLnRpbGVzLm1hcGJveC5jb20vdjQnLFxyXG4gICAgSFRUUFNfVVJMOiAnaHR0cHM6Ly9hLnRpbGVzLm1hcGJveC5jb20vdjQnLFxyXG4gICAgRk9SQ0VfSFRUUFM6IGZhbHNlLFxyXG4gICAgUkVRVUlSRV9BQ0NFU1NfVE9LRU46IHRydWVcclxufTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4vY29uZmlnJyksXHJcbiAgICB2ZXJzaW9uID0gcmVxdWlyZSgnLi4vcGFja2FnZS5qc29uJykudmVyc2lvbjtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGF0aCwgYWNjZXNzVG9rZW4pIHtcclxuICAgIGFjY2Vzc1Rva2VuID0gYWNjZXNzVG9rZW4gfHwgTC5tYXBib3guYWNjZXNzVG9rZW47XHJcblxyXG4gICAgaWYgKCFhY2Nlc3NUb2tlbiAmJiBjb25maWcuUkVRVUlSRV9BQ0NFU1NfVE9LRU4pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuIEFQSSBhY2Nlc3MgdG9rZW4gaXMgcmVxdWlyZWQgdG8gdXNlIE1hcGJveC5qcy4gJyArXHJcbiAgICAgICAgICAgICdTZWUgaHR0cHM6Ly93d3cubWFwYm94LmNvbS9tYXBib3guanMvYXBpL3YnICsgdmVyc2lvbiArICcvYXBpLWFjY2Vzcy10b2tlbnMvJyk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHVybCA9IChkb2N1bWVudC5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOicgfHwgY29uZmlnLkZPUkNFX0hUVFBTKSA/IGNvbmZpZy5IVFRQU19VUkwgOiBjb25maWcuSFRUUF9VUkw7XHJcbiAgICB1cmwgPSB1cmwucmVwbGFjZSgvXFwvdjQkLywgJycpO1xyXG4gICAgdXJsICs9IHBhdGg7XHJcblxyXG4gICAgaWYgKGNvbmZpZy5SRVFVSVJFX0FDQ0VTU19UT0tFTikge1xyXG4gICAgICAgIGlmIChhY2Nlc3NUb2tlblswXSA9PT0gJ3MnKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVXNlIGEgcHVibGljIGFjY2VzcyB0b2tlbiAocGsuKikgd2l0aCBNYXBib3guanMsIG5vdCBhIHNlY3JldCBhY2Nlc3MgdG9rZW4gKHNrLiopLiAnICtcclxuICAgICAgICAgICAgICAgICdTZWUgaHR0cHM6Ly93d3cubWFwYm94LmNvbS9tYXBib3guanMvYXBpL3YnICsgdmVyc2lvbiArICcvYXBpLWFjY2Vzcy10b2tlbnMvJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB1cmwgKz0gdXJsLmluZGV4T2YoJz8nKSAhPT0gLTEgPyAnJmFjY2Vzc190b2tlbj0nIDogJz9hY2Nlc3NfdG9rZW49JztcclxuICAgICAgICB1cmwgKz0gYWNjZXNzVG9rZW47XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHVybDtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzLnRpbGVKU09OID0gZnVuY3Rpb24odXJsT3JNYXBJRCwgYWNjZXNzVG9rZW4pIHtcclxuXHJcbiAgICBpZiAodXJsT3JNYXBJRC5pbmRleE9mKCdtYXBib3g6Ly9zdHlsZXMnKSA9PT0gMCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU3R5bGVzIGNyZWF0ZWQgd2l0aCBNYXBib3ggU3R1ZGlvIG5lZWQgdG8gYmUgdXNlZCB3aXRoICcgK1xyXG4gICAgICAgICAgICAnTC5tYXBib3guc3R5bGVMYXllciwgbm90IEwubWFwYm94LnRpbGVMYXllcicpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh1cmxPck1hcElELmluZGV4T2YoJy8nKSAhPT0gLTEpXHJcbiAgICAgICAgcmV0dXJuIHVybE9yTWFwSUQ7XHJcblxyXG4gICAgdmFyIHVybCA9IG1vZHVsZS5leHBvcnRzKCcvdjQvJyArIHVybE9yTWFwSUQgKyAnLmpzb24nLCBhY2Nlc3NUb2tlbik7XHJcblxyXG4gICAgLy8gVGlsZUpTT04gcmVxdWVzdHMgbmVlZCBhIHNlY3VyZSBmbGFnIGFwcGVuZGVkIHRvIHRoZWlyIFVSTHMgc29cclxuICAgIC8vIHRoYXQgdGhlIHNlcnZlciBrbm93cyB0byBzZW5kIFNTTC1pZmllZCByZXNvdXJjZSByZWZlcmVuY2VzLlxyXG4gICAgaWYgKHVybC5pbmRleE9mKCdodHRwcycpID09PSAwKVxyXG4gICAgICAgIHVybCArPSAnJnNlY3VyZSc7XHJcblxyXG4gICAgcmV0dXJuIHVybDtcclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cy5zdHlsZSA9IGZ1bmN0aW9uKHN0eWxlVVJMLCBhY2Nlc3NUb2tlbikge1xyXG4gICAgaWYgKHN0eWxlVVJMLmluZGV4T2YoJ21hcGJveDovL3N0eWxlcy8nKSA9PT0gLTEpIHRocm93IG5ldyBFcnJvcignSW5jb3JyZWN0bHkgZm9ybWF0dGVkIE1hcGJveCBzdHlsZSBhdCAnICsgc3R5bGVVUkwpO1xyXG5cclxuICAgIHZhciBvd25lcklEU3R5bGUgPSBzdHlsZVVSTC5zcGxpdCgnbWFwYm94Oi8vc3R5bGVzLycpWzFdO1xyXG4gICAgdmFyIHVybCA9IG1vZHVsZS5leHBvcnRzKCcvc3R5bGVzL3YxLycgKyBvd25lcklEU3R5bGUsIGFjY2Vzc1Rva2VuKVxyXG4gICAgICAgIC5yZXBsYWNlKCdodHRwOi8vJywgJ2h0dHBzOi8vJyk7XHJcblxyXG4gICAgcmV0dXJuIHVybDtcclxufTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuZnVuY3Rpb24gdXRmRGVjb2RlKGMpIHtcclxuICAgIGlmIChjID49IDkzKSBjLS07XHJcbiAgICBpZiAoYyA+PSAzNSkgYy0tO1xyXG4gICAgcmV0dXJuIGMgLSAzMjtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihkYXRhKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24oeCwgeSkge1xyXG4gICAgICAgIGlmICghZGF0YSkgcmV0dXJuO1xyXG4gICAgICAgIHZhciBpZHggPSB1dGZEZWNvZGUoZGF0YS5ncmlkW3ldLmNoYXJDb2RlQXQoeCkpLFxyXG4gICAgICAgICAgICBrZXkgPSBkYXRhLmtleXNbaWR4XTtcclxuICAgICAgICByZXR1cm4gZGF0YS5kYXRhW2tleV07XHJcbiAgICB9O1xyXG59O1xyXG4iLCJ3aW5kb3cuaW50ZXJuYWxzID0ge1xyXG4gICAgdXJsOiByZXF1aXJlKCcuL2Zvcm1hdF91cmwnKSxcclxuICAgIGNvbmZpZzogcmVxdWlyZSgnLi9jb25maWcnKSxcclxuICAgIHV0aWw6IHJlcXVpcmUoJy4vdXRpbCcpLFxyXG4gICAgZ3JpZDogcmVxdWlyZSgnLi9ncmlkJyksXHJcbiAgICByZXF1ZXN0OiByZXF1aXJlKCcuL3JlcXVlc3QnKVxyXG59O1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgY29yc2xpdGUgPSByZXF1aXJlKCdjb3JzbGl0ZScpLFxyXG4gICAgc3RyaWN0ID0gcmVxdWlyZSgnLi91dGlsJykuc3RyaWN0LFxyXG4gICAgY29uZmlnID0gcmVxdWlyZSgnLi9jb25maWcnKTtcclxuXHJcbnZhciBwcm90b2NvbCA9IC9eKGh0dHBzPzopPyg/PVxcL1xcLygufGFwaSlcXC50aWxlc1xcLm1hcGJveFxcLmNvbVxcLykvO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XHJcbiAgICBzdHJpY3QodXJsLCAnc3RyaW5nJyk7XHJcbiAgICBzdHJpY3QoY2FsbGJhY2ssICdmdW5jdGlvbicpO1xyXG5cclxuICAgIHVybCA9IHVybC5yZXBsYWNlKHByb3RvY29sLCBmdW5jdGlvbihtYXRjaCwgcHJvdG9jb2wpIHtcclxuICAgICAgICBpZiAoISgnd2l0aENyZWRlbnRpYWxzJyBpbiBuZXcgd2luZG93LlhNTEh0dHBSZXF1ZXN0KCkpKSB7XHJcbiAgICAgICAgICAgIC8vIFhEb21haW5SZXF1ZXN0IGluIHVzZTsgZG9lc24ndCBzdXBwb3J0IGNyb3NzLXByb3RvY29sIHJlcXVlc3RzXHJcbiAgICAgICAgICAgIHJldHVybiBkb2N1bWVudC5sb2NhdGlvbi5wcm90b2NvbDtcclxuICAgICAgICB9IGVsc2UgaWYgKHByb3RvY29sID09PSAnaHR0cHM6JyB8fCBkb2N1bWVudC5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOicgfHwgY29uZmlnLkZPUkNFX0hUVFBTKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnaHR0cHM6JztcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gJ2h0dHA6JztcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBmdW5jdGlvbiBvbmxvYWQoZXJyLCByZXNwKSB7XHJcbiAgICAgICAgaWYgKCFlcnIgJiYgcmVzcCkge1xyXG4gICAgICAgICAgICByZXNwID0gSlNPTi5wYXJzZShyZXNwLnJlc3BvbnNlVGV4dCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNhbGxiYWNrKGVyciwgcmVzcCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGNvcnNsaXRlKHVybCwgb25sb2FkKTtcclxufTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuZnVuY3Rpb24gY29udGFpbnMoaXRlbSwgbGlzdCkge1xyXG4gICAgaWYgKCFsaXN0IHx8ICFsaXN0Lmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKGxpc3RbaV0gPT09IGl0ZW0pIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGlkVXJsOiBmdW5jdGlvbihfLCB0KSB7XHJcbiAgICAgICAgaWYgKF8uaW5kZXhPZignLycpID09PSAtMSkgdC5sb2FkSUQoXyk7XHJcbiAgICAgICAgZWxzZSB0LmxvYWRVUkwoXyk7XHJcbiAgICB9LFxyXG4gICAgbG9nOiBmdW5jdGlvbihfKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBjb25zb2xlID09PSAnb2JqZWN0JyAmJlxyXG4gICAgICAgICAgICB0eXBlb2YgY29uc29sZS5lcnJvciA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKF8pO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBzdHJpY3Q6IGZ1bmN0aW9uKF8sIHR5cGUpIHtcclxuICAgICAgICBpZiAodHlwZW9mIF8gIT09IHR5cGUpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGFyZ3VtZW50OiAnICsgdHlwZSArICcgZXhwZWN0ZWQnKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgc3RyaWN0X2luc3RhbmNlOiBmdW5jdGlvbihfLCBrbGFzcywgbmFtZSkge1xyXG4gICAgICAgIGlmICghKF8gaW5zdGFuY2VvZiBrbGFzcykpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGFyZ3VtZW50OiAnICsgbmFtZSArICcgZXhwZWN0ZWQnKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgc3RyaWN0X29uZW9mOiBmdW5jdGlvbihfLCB2YWx1ZXMpIHtcclxuICAgICAgICBpZiAoIWNvbnRhaW5zKF8sIHZhbHVlcykpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGFyZ3VtZW50OiAnICsgXyArICcgZ2l2ZW4sIHZhbGlkIHZhbHVlcyBhcmUgJyArXHJcbiAgICAgICAgICAgICAgICB2YWx1ZXMuam9pbignLCAnKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIHN0cmlwX3RhZ3M6IGZ1bmN0aW9uKF8pIHtcclxuICAgICAgICByZXR1cm4gXy5yZXBsYWNlKC88W148XSs+L2csICcnKTtcclxuICAgIH0sXHJcbiAgICBsYm91bmRzOiBmdW5jdGlvbihfKSB7XHJcbiAgICAgICAgLy8gbGVhZmxldC1jb21wYXRpYmxlIGJvdW5kcywgc2luY2UgbGVhZmxldCBkb2VzIG5vdCBkbyBnZW9qc29uXHJcbiAgICAgICAgcmV0dXJuIG5ldyBMLkxhdExuZ0JvdW5kcyhbW19bMV0sIF9bMF1dLCBbX1szXSwgX1syXV1dKTtcclxuICAgIH1cclxufTtcclxuIl19
