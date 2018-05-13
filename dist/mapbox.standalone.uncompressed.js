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
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],3:[function(require,module,exports){
/*!
 * mustache.js - Logic-less {{mustache}} templates with JavaScript
 * http://github.com/janl/mustache.js
 */

/*global define: false Mustache: true*/

(function defineMustache (global, factory) {
  if (typeof exports === 'object' && exports && typeof exports.nodeName !== 'string') {
    factory(exports); // CommonJS
  } else if (typeof define === 'function' && define.amd) {
    define(['exports'], factory); // AMD
  } else {
    global.Mustache = {};
    factory(global.Mustache); // script, wsh, asp
  }
}(this, function mustacheFactory (mustache) {

  var objectToString = Object.prototype.toString;
  var isArray = Array.isArray || function isArrayPolyfill (object) {
    return objectToString.call(object) === '[object Array]';
  };

  function isFunction (object) {
    return typeof object === 'function';
  }

  /**
   * More correct typeof string handling array
   * which normally returns typeof 'object'
   */
  function typeStr (obj) {
    return isArray(obj) ? 'array' : typeof obj;
  }

  function escapeRegExp (string) {
    return string.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&');
  }

  /**
   * Null safe way of checking whether or not an object,
   * including its prototype, has a given property
   */
  function hasProperty (obj, propName) {
    return obj != null && typeof obj === 'object' && (propName in obj);
  }

  // Workaround for https://issues.apache.org/jira/browse/COUCHDB-577
  // See https://github.com/janl/mustache.js/issues/189
  var regExpTest = RegExp.prototype.test;
  function testRegExp (re, string) {
    return regExpTest.call(re, string);
  }

  var nonSpaceRe = /\S/;
  function isWhitespace (string) {
    return !testRegExp(nonSpaceRe, string);
  }

  var entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  function escapeHtml (string) {
    return String(string).replace(/[&<>"'`=\/]/g, function fromEntityMap (s) {
      return entityMap[s];
    });
  }

  var whiteRe = /\s*/;
  var spaceRe = /\s+/;
  var equalsRe = /\s*=/;
  var curlyRe = /\s*\}/;
  var tagRe = /#|\^|\/|>|\{|&|=|!/;

  /**
   * Breaks up the given `template` string into a tree of tokens. If the `tags`
   * argument is given here it must be an array with two string values: the
   * opening and closing tags used in the template (e.g. [ "<%", "%>" ]). Of
   * course, the default is to use mustaches (i.e. mustache.tags).
   *
   * A token is an array with at least 4 elements. The first element is the
   * mustache symbol that was used inside the tag, e.g. "#" or "&". If the tag
   * did not contain a symbol (i.e. {{myValue}}) this element is "name". For
   * all text that appears outside a symbol this element is "text".
   *
   * The second element of a token is its "value". For mustache tags this is
   * whatever else was inside the tag besides the opening symbol. For text tokens
   * this is the text itself.
   *
   * The third and fourth elements of the token are the start and end indices,
   * respectively, of the token in the original template.
   *
   * Tokens that are the root node of a subtree contain two more elements: 1) an
   * array of tokens in the subtree and 2) the index in the original template at
   * which the closing tag for that section begins.
   */
  function parseTemplate (template, tags) {
    if (!template)
      return [];

    var sections = [];     // Stack to hold section tokens
    var tokens = [];       // Buffer to hold the tokens
    var spaces = [];       // Indices of whitespace tokens on the current line
    var hasTag = false;    // Is there a {{tag}} on the current line?
    var nonSpace = false;  // Is there a non-space char on the current line?

    // Strips all whitespace tokens array for the current line
    // if there was a {{#tag}} on it and otherwise only space.
    function stripSpace () {
      if (hasTag && !nonSpace) {
        while (spaces.length)
          delete tokens[spaces.pop()];
      } else {
        spaces = [];
      }

      hasTag = false;
      nonSpace = false;
    }

    var openingTagRe, closingTagRe, closingCurlyRe;
    function compileTags (tagsToCompile) {
      if (typeof tagsToCompile === 'string')
        tagsToCompile = tagsToCompile.split(spaceRe, 2);

      if (!isArray(tagsToCompile) || tagsToCompile.length !== 2)
        throw new Error('Invalid tags: ' + tagsToCompile);

      openingTagRe = new RegExp(escapeRegExp(tagsToCompile[0]) + '\\s*');
      closingTagRe = new RegExp('\\s*' + escapeRegExp(tagsToCompile[1]));
      closingCurlyRe = new RegExp('\\s*' + escapeRegExp('}' + tagsToCompile[1]));
    }

    compileTags(tags || mustache.tags);

    var scanner = new Scanner(template);

    var start, type, value, chr, token, openSection;
    while (!scanner.eos()) {
      start = scanner.pos;

      // Match any text between tags.
      value = scanner.scanUntil(openingTagRe);

      if (value) {
        for (var i = 0, valueLength = value.length; i < valueLength; ++i) {
          chr = value.charAt(i);

          if (isWhitespace(chr)) {
            spaces.push(tokens.length);
          } else {
            nonSpace = true;
          }

          tokens.push([ 'text', chr, start, start + 1 ]);
          start += 1;

          // Check for whitespace on the current line.
          if (chr === '\n')
            stripSpace();
        }
      }

      // Match the opening tag.
      if (!scanner.scan(openingTagRe))
        break;

      hasTag = true;

      // Get the tag type.
      type = scanner.scan(tagRe) || 'name';
      scanner.scan(whiteRe);

      // Get the tag value.
      if (type === '=') {
        value = scanner.scanUntil(equalsRe);
        scanner.scan(equalsRe);
        scanner.scanUntil(closingTagRe);
      } else if (type === '{') {
        value = scanner.scanUntil(closingCurlyRe);
        scanner.scan(curlyRe);
        scanner.scanUntil(closingTagRe);
        type = '&';
      } else {
        value = scanner.scanUntil(closingTagRe);
      }

      // Match the closing tag.
      if (!scanner.scan(closingTagRe))
        throw new Error('Unclosed tag at ' + scanner.pos);

      token = [ type, value, start, scanner.pos ];
      tokens.push(token);

      if (type === '#' || type === '^') {
        sections.push(token);
      } else if (type === '/') {
        // Check section nesting.
        openSection = sections.pop();

        if (!openSection)
          throw new Error('Unopened section "' + value + '" at ' + start);

        if (openSection[1] !== value)
          throw new Error('Unclosed section "' + openSection[1] + '" at ' + start);
      } else if (type === 'name' || type === '{' || type === '&') {
        nonSpace = true;
      } else if (type === '=') {
        // Set the tags for the next time around.
        compileTags(value);
      }
    }

    // Make sure there are no open sections when we're done.
    openSection = sections.pop();

    if (openSection)
      throw new Error('Unclosed section "' + openSection[1] + '" at ' + scanner.pos);

    return nestTokens(squashTokens(tokens));
  }

  /**
   * Combines the values of consecutive text tokens in the given `tokens` array
   * to a single token.
   */
  function squashTokens (tokens) {
    var squashedTokens = [];

    var token, lastToken;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      token = tokens[i];

      if (token) {
        if (token[0] === 'text' && lastToken && lastToken[0] === 'text') {
          lastToken[1] += token[1];
          lastToken[3] = token[3];
        } else {
          squashedTokens.push(token);
          lastToken = token;
        }
      }
    }

    return squashedTokens;
  }

  /**
   * Forms the given array of `tokens` into a nested tree structure where
   * tokens that represent a section have two additional items: 1) an array of
   * all tokens that appear in that section and 2) the index in the original
   * template that represents the end of that section.
   */
  function nestTokens (tokens) {
    var nestedTokens = [];
    var collector = nestedTokens;
    var sections = [];

    var token, section;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      token = tokens[i];

      switch (token[0]) {
        case '#':
        case '^':
          collector.push(token);
          sections.push(token);
          collector = token[4] = [];
          break;
        case '/':
          section = sections.pop();
          section[5] = token[2];
          collector = sections.length > 0 ? sections[sections.length - 1][4] : nestedTokens;
          break;
        default:
          collector.push(token);
      }
    }

    return nestedTokens;
  }

  /**
   * A simple string scanner that is used by the template parser to find
   * tokens in template strings.
   */
  function Scanner (string) {
    this.string = string;
    this.tail = string;
    this.pos = 0;
  }

  /**
   * Returns `true` if the tail is empty (end of string).
   */
  Scanner.prototype.eos = function eos () {
    return this.tail === '';
  };

  /**
   * Tries to match the given regular expression at the current position.
   * Returns the matched text if it can match, the empty string otherwise.
   */
  Scanner.prototype.scan = function scan (re) {
    var match = this.tail.match(re);

    if (!match || match.index !== 0)
      return '';

    var string = match[0];

    this.tail = this.tail.substring(string.length);
    this.pos += string.length;

    return string;
  };

  /**
   * Skips all text until the given regular expression can be matched. Returns
   * the skipped string, which is the entire tail if no match can be made.
   */
  Scanner.prototype.scanUntil = function scanUntil (re) {
    var index = this.tail.search(re), match;

    switch (index) {
      case -1:
        match = this.tail;
        this.tail = '';
        break;
      case 0:
        match = '';
        break;
      default:
        match = this.tail.substring(0, index);
        this.tail = this.tail.substring(index);
    }

    this.pos += match.length;

    return match;
  };

  /**
   * Represents a rendering context by wrapping a view object and
   * maintaining a reference to the parent context.
   */
  function Context (view, parentContext) {
    this.view = view;
    this.cache = { '.': this.view };
    this.parent = parentContext;
  }

  /**
   * Creates a new context using the given view with this context
   * as the parent.
   */
  Context.prototype.push = function push (view) {
    return new Context(view, this);
  };

  /**
   * Returns the value of the given name in this context, traversing
   * up the context hierarchy if the value is absent in this context's view.
   */
  Context.prototype.lookup = function lookup (name) {
    var cache = this.cache;

    var value;
    if (cache.hasOwnProperty(name)) {
      value = cache[name];
    } else {
      var context = this, names, index, lookupHit = false;

      while (context) {
        if (name.indexOf('.') > 0) {
          value = context.view;
          names = name.split('.');
          index = 0;

          /**
           * Using the dot notion path in `name`, we descend through the
           * nested objects.
           *
           * To be certain that the lookup has been successful, we have to
           * check if the last object in the path actually has the property
           * we are looking for. We store the result in `lookupHit`.
           *
           * This is specially necessary for when the value has been set to
           * `undefined` and we want to avoid looking up parent contexts.
           **/
          while (value != null && index < names.length) {
            if (index === names.length - 1)
              lookupHit = hasProperty(value, names[index]);

            value = value[names[index++]];
          }
        } else {
          value = context.view[name];
          lookupHit = hasProperty(context.view, name);
        }

        if (lookupHit)
          break;

        context = context.parent;
      }

      cache[name] = value;
    }

    if (isFunction(value))
      value = value.call(this.view);

    return value;
  };

  /**
   * A Writer knows how to take a stream of tokens and render them to a
   * string, given a context. It also maintains a cache of templates to
   * avoid the need to parse the same template twice.
   */
  function Writer () {
    this.cache = {};
  }

  /**
   * Clears all cached templates in this writer.
   */
  Writer.prototype.clearCache = function clearCache () {
    this.cache = {};
  };

  /**
   * Parses and caches the given `template` and returns the array of tokens
   * that is generated from the parse.
   */
  Writer.prototype.parse = function parse (template, tags) {
    var cache = this.cache;
    var tokens = cache[template];

    if (tokens == null)
      tokens = cache[template] = parseTemplate(template, tags);

    return tokens;
  };

  /**
   * High-level method that is used to render the given `template` with
   * the given `view`.
   *
   * The optional `partials` argument may be an object that contains the
   * names and templates of partials that are used in the template. It may
   * also be a function that is used to load partial templates on the fly
   * that takes a single argument: the name of the partial.
   */
  Writer.prototype.render = function render (template, view, partials) {
    var tokens = this.parse(template);
    var context = (view instanceof Context) ? view : new Context(view);
    return this.renderTokens(tokens, context, partials, template);
  };

  /**
   * Low-level method that renders the given array of `tokens` using
   * the given `context` and `partials`.
   *
   * Note: The `originalTemplate` is only ever used to extract the portion
   * of the original template that was contained in a higher-order section.
   * If the template doesn't use higher-order sections, this argument may
   * be omitted.
   */
  Writer.prototype.renderTokens = function renderTokens (tokens, context, partials, originalTemplate) {
    var buffer = '';

    var token, symbol, value;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      value = undefined;
      token = tokens[i];
      symbol = token[0];

      if (symbol === '#') value = this.renderSection(token, context, partials, originalTemplate);
      else if (symbol === '^') value = this.renderInverted(token, context, partials, originalTemplate);
      else if (symbol === '>') value = this.renderPartial(token, context, partials, originalTemplate);
      else if (symbol === '&') value = this.unescapedValue(token, context);
      else if (symbol === 'name') value = this.escapedValue(token, context);
      else if (symbol === 'text') value = this.rawValue(token);

      if (value !== undefined)
        buffer += value;
    }

    return buffer;
  };

  Writer.prototype.renderSection = function renderSection (token, context, partials, originalTemplate) {
    var self = this;
    var buffer = '';
    var value = context.lookup(token[1]);

    // This function is used to render an arbitrary template
    // in the current context by higher-order sections.
    function subRender (template) {
      return self.render(template, context, partials);
    }

    if (!value) return;

    if (isArray(value)) {
      for (var j = 0, valueLength = value.length; j < valueLength; ++j) {
        buffer += this.renderTokens(token[4], context.push(value[j]), partials, originalTemplate);
      }
    } else if (typeof value === 'object' || typeof value === 'string' || typeof value === 'number') {
      buffer += this.renderTokens(token[4], context.push(value), partials, originalTemplate);
    } else if (isFunction(value)) {
      if (typeof originalTemplate !== 'string')
        throw new Error('Cannot use higher-order sections without the original template');

      // Extract the portion of the original template that the section contains.
      value = value.call(context.view, originalTemplate.slice(token[3], token[5]), subRender);

      if (value != null)
        buffer += value;
    } else {
      buffer += this.renderTokens(token[4], context, partials, originalTemplate);
    }
    return buffer;
  };

  Writer.prototype.renderInverted = function renderInverted (token, context, partials, originalTemplate) {
    var value = context.lookup(token[1]);

    // Use JavaScript's definition of falsy. Include empty arrays.
    // See https://github.com/janl/mustache.js/issues/186
    if (!value || (isArray(value) && value.length === 0))
      return this.renderTokens(token[4], context, partials, originalTemplate);
  };

  Writer.prototype.renderPartial = function renderPartial (token, context, partials) {
    if (!partials) return;

    var value = isFunction(partials) ? partials(token[1]) : partials[token[1]];
    if (value != null)
      return this.renderTokens(this.parse(value), context, partials, value);
  };

  Writer.prototype.unescapedValue = function unescapedValue (token, context) {
    var value = context.lookup(token[1]);
    if (value != null)
      return value;
  };

  Writer.prototype.escapedValue = function escapedValue (token, context) {
    var value = context.lookup(token[1]);
    if (value != null)
      return mustache.escape(value);
  };

  Writer.prototype.rawValue = function rawValue (token) {
    return token[1];
  };

  mustache.name = 'mustache.js';
  mustache.version = '2.2.1';
  mustache.tags = [ '{{', '}}' ];

  // All high-level mustache.* functions use this writer.
  var defaultWriter = new Writer();

  /**
   * Clears all cached templates in the default writer.
   */
  mustache.clearCache = function clearCache () {
    return defaultWriter.clearCache();
  };

  /**
   * Parses and caches the given template in the default writer and returns the
   * array of tokens it contains. Doing this ahead of time avoids the need to
   * parse templates on the fly as they are rendered.
   */
  mustache.parse = function parse (template, tags) {
    return defaultWriter.parse(template, tags);
  };

  /**
   * Renders the `template` with the given `view` and `partials` using the
   * default writer.
   */
  mustache.render = function render (template, view, partials) {
    if (typeof template !== 'string') {
      throw new TypeError('Invalid template! Template should be a "string" ' +
                          'but "' + typeStr(template) + '" was given as the first ' +
                          'argument for mustache#render(template, view, partials)');
    }

    return defaultWriter.render(template, view, partials);
  };

  // This is here for backwards compatibility with 0.4.x.,
  /*eslint-disable */ // eslint wants camel cased function name
  mustache.to_html = function to_html (template, view, partials, send) {
    /*eslint-enable*/

    var result = mustache.render(template, view, partials);

    if (isFunction(send)) {
      send(result);
    } else {
      return result;
    }
  };

  // Export the escaping function so that the user may override it.
  // See https://github.com/janl/mustache.js/issues/244
  mustache.escape = escapeHtml;

  // Export these mainly for testing, but also for advanced usage.
  mustache.Scanner = Scanner;
  mustache.Context = Context;
  mustache.Writer = Writer;

}));

},{}],4:[function(require,module,exports){
var html_sanitize = require('./sanitizer-bundle.js');

module.exports = function(_) {
    if (!_) return '';
    return html_sanitize(_, cleanUrl, cleanId);
};

// https://bugzilla.mozilla.org/show_bug.cgi?id=255107
function cleanUrl(url) {
    'use strict';
    if (/^https?/.test(url.getScheme())) return url.toString();
    if (/^mailto?/.test(url.getScheme())) return url.toString();
    if ('data' == url.getScheme() && /^image/.test(url.getPath())) {
        return url.toString();
    }
}

function cleanId(id) { return id; }

},{"./sanitizer-bundle.js":5}],5:[function(require,module,exports){

// Copyright (C) 2010 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview
 * Implements RFC 3986 for parsing/formatting URIs.
 *
 * @author mikesamuel@gmail.com
 * \@provides URI
 * \@overrides window
 */

var URI = (function () {

/**
 * creates a uri from the string form.  The parser is relaxed, so special
 * characters that aren't escaped but don't cause ambiguities will not cause
 * parse failures.
 *
 * @return {URI|null}
 */
function parse(uriStr) {
  var m = ('' + uriStr).match(URI_RE_);
  if (!m) { return null; }
  return new URI(
      nullIfAbsent(m[1]),
      nullIfAbsent(m[2]),
      nullIfAbsent(m[3]),
      nullIfAbsent(m[4]),
      nullIfAbsent(m[5]),
      nullIfAbsent(m[6]),
      nullIfAbsent(m[7]));
}


/**
 * creates a uri from the given parts.
 *
 * @param scheme {string} an unencoded scheme such as "http" or null
 * @param credentials {string} unencoded user credentials or null
 * @param domain {string} an unencoded domain name or null
 * @param port {number} a port number in [1, 32768].
 *    -1 indicates no port, as does null.
 * @param path {string} an unencoded path
 * @param query {Array.<string>|string|null} a list of unencoded cgi
 *   parameters where even values are keys and odds the corresponding values
 *   or an unencoded query.
 * @param fragment {string} an unencoded fragment without the "#" or null.
 * @return {URI}
 */
function create(scheme, credentials, domain, port, path, query, fragment) {
  var uri = new URI(
      encodeIfExists2(scheme, URI_DISALLOWED_IN_SCHEME_OR_CREDENTIALS_),
      encodeIfExists2(
          credentials, URI_DISALLOWED_IN_SCHEME_OR_CREDENTIALS_),
      encodeIfExists(domain),
      port > 0 ? port.toString() : null,
      encodeIfExists2(path, URI_DISALLOWED_IN_PATH_),
      null,
      encodeIfExists(fragment));
  if (query) {
    if ('string' === typeof query) {
      uri.setRawQuery(query.replace(/[^?&=0-9A-Za-z_\-~.%]/g, encodeOne));
    } else {
      uri.setAllParameters(query);
    }
  }
  return uri;
}
function encodeIfExists(unescapedPart) {
  if ('string' == typeof unescapedPart) {
    return encodeURIComponent(unescapedPart);
  }
  return null;
};
/**
 * if unescapedPart is non null, then escapes any characters in it that aren't
 * valid characters in a url and also escapes any special characters that
 * appear in extra.
 *
 * @param unescapedPart {string}
 * @param extra {RegExp} a character set of characters in [\01-\177].
 * @return {string|null} null iff unescapedPart == null.
 */
function encodeIfExists2(unescapedPart, extra) {
  if ('string' == typeof unescapedPart) {
    return encodeURI(unescapedPart).replace(extra, encodeOne);
  }
  return null;
};
/** converts a character in [\01-\177] to its url encoded equivalent. */
function encodeOne(ch) {
  var n = ch.charCodeAt(0);
  return '%' + '0123456789ABCDEF'.charAt((n >> 4) & 0xf) +
      '0123456789ABCDEF'.charAt(n & 0xf);
}

/**
 * {@updoc
 *  $ normPath('foo/./bar')
 *  # 'foo/bar'
 *  $ normPath('./foo')
 *  # 'foo'
 *  $ normPath('foo/.')
 *  # 'foo'
 *  $ normPath('foo//bar')
 *  # 'foo/bar'
 * }
 */
function normPath(path) {
  return path.replace(/(^|\/)\.(?:\/|$)/g, '$1').replace(/\/{2,}/g, '/');
}

var PARENT_DIRECTORY_HANDLER = new RegExp(
    ''
    // A path break
    + '(/|^)'
    // followed by a non .. path element
    // (cannot be . because normPath is used prior to this RegExp)
    + '(?:[^./][^/]*|\\.{2,}(?:[^./][^/]*)|\\.{3,}[^/]*)'
    // followed by .. followed by a path break.
    + '/\\.\\.(?:/|$)');

var PARENT_DIRECTORY_HANDLER_RE = new RegExp(PARENT_DIRECTORY_HANDLER);

var EXTRA_PARENT_PATHS_RE = /^(?:\.\.\/)*(?:\.\.$)?/;

/**
 * Normalizes its input path and collapses all . and .. sequences except for
 * .. sequences that would take it above the root of the current parent
 * directory.
 * {@updoc
 *  $ collapse_dots('foo/../bar')
 *  # 'bar'
 *  $ collapse_dots('foo/./bar')
 *  # 'foo/bar'
 *  $ collapse_dots('foo/../bar/./../../baz')
 *  # 'baz'
 *  $ collapse_dots('../foo')
 *  # '../foo'
 *  $ collapse_dots('../foo').replace(EXTRA_PARENT_PATHS_RE, '')
 *  # 'foo'
 * }
 */
function collapse_dots(path) {
  if (path === null) { return null; }
  var p = normPath(path);
  // Only /../ left to flatten
  var r = PARENT_DIRECTORY_HANDLER_RE;
  // We replace with $1 which matches a / before the .. because this
  // guarantees that:
  // (1) we have at most 1 / between the adjacent place,
  // (2) always have a slash if there is a preceding path section, and
  // (3) we never turn a relative path into an absolute path.
  for (var q; (q = p.replace(r, '$1')) != p; p = q) {};
  return p;
}

/**
 * resolves a relative url string to a base uri.
 * @return {URI}
 */
function resolve(baseUri, relativeUri) {
  // there are several kinds of relative urls:
  // 1. //foo - replaces everything from the domain on.  foo is a domain name
  // 2. foo - replaces the last part of the path, the whole query and fragment
  // 3. /foo - replaces the the path, the query and fragment
  // 4. ?foo - replace the query and fragment
  // 5. #foo - replace the fragment only

  var absoluteUri = baseUri.clone();
  // we satisfy these conditions by looking for the first part of relativeUri
  // that is not blank and applying defaults to the rest

  var overridden = relativeUri.hasScheme();

  if (overridden) {
    absoluteUri.setRawScheme(relativeUri.getRawScheme());
  } else {
    overridden = relativeUri.hasCredentials();
  }

  if (overridden) {
    absoluteUri.setRawCredentials(relativeUri.getRawCredentials());
  } else {
    overridden = relativeUri.hasDomain();
  }

  if (overridden) {
    absoluteUri.setRawDomain(relativeUri.getRawDomain());
  } else {
    overridden = relativeUri.hasPort();
  }

  var rawPath = relativeUri.getRawPath();
  var simplifiedPath = collapse_dots(rawPath);
  if (overridden) {
    absoluteUri.setPort(relativeUri.getPort());
    simplifiedPath = simplifiedPath
        && simplifiedPath.replace(EXTRA_PARENT_PATHS_RE, '');
  } else {
    overridden = !!rawPath;
    if (overridden) {
      // resolve path properly
      if (simplifiedPath.charCodeAt(0) !== 0x2f /* / */) {  // path is relative
        var absRawPath = collapse_dots(absoluteUri.getRawPath() || '')
            .replace(EXTRA_PARENT_PATHS_RE, '');
        var slash = absRawPath.lastIndexOf('/') + 1;
        simplifiedPath = collapse_dots(
            (slash ? absRawPath.substring(0, slash) : '')
            + collapse_dots(rawPath))
            .replace(EXTRA_PARENT_PATHS_RE, '');
      }
    } else {
      simplifiedPath = simplifiedPath
          && simplifiedPath.replace(EXTRA_PARENT_PATHS_RE, '');
      if (simplifiedPath !== rawPath) {
        absoluteUri.setRawPath(simplifiedPath);
      }
    }
  }

  if (overridden) {
    absoluteUri.setRawPath(simplifiedPath);
  } else {
    overridden = relativeUri.hasQuery();
  }

  if (overridden) {
    absoluteUri.setRawQuery(relativeUri.getRawQuery());
  } else {
    overridden = relativeUri.hasFragment();
  }

  if (overridden) {
    absoluteUri.setRawFragment(relativeUri.getRawFragment());
  }

  return absoluteUri;
}

/**
 * a mutable URI.
 *
 * This class contains setters and getters for the parts of the URI.
 * The <tt>getXYZ</tt>/<tt>setXYZ</tt> methods return the decoded part -- so
 * <code>uri.parse('/foo%20bar').getPath()</code> will return the decoded path,
 * <tt>/foo bar</tt>.
 *
 * <p>The raw versions of fields are available too.
 * <code>uri.parse('/foo%20bar').getRawPath()</code> will return the raw path,
 * <tt>/foo%20bar</tt>.  Use the raw setters with care, since
 * <code>URI::toString</code> is not guaranteed to return a valid url if a
 * raw setter was used.
 *
 * <p>All setters return <tt>this</tt> and so may be chained, a la
 * <code>uri.parse('/foo').setFragment('part').toString()</code>.
 *
 * <p>You should not use this constructor directly -- please prefer the factory
 * functions {@link uri.parse}, {@link uri.create}, {@link uri.resolve}
 * instead.</p>
 *
 * <p>The parameters are all raw (assumed to be properly escaped) parts, and
 * any (but not all) may be null.  Undefined is not allowed.</p>
 *
 * @constructor
 */
function URI(
    rawScheme,
    rawCredentials, rawDomain, port,
    rawPath, rawQuery, rawFragment) {
  this.scheme_ = rawScheme;
  this.credentials_ = rawCredentials;
  this.domain_ = rawDomain;
  this.port_ = port;
  this.path_ = rawPath;
  this.query_ = rawQuery;
  this.fragment_ = rawFragment;
  /**
   * @type {Array|null}
   */
  this.paramCache_ = null;
}

/** returns the string form of the url. */
URI.prototype.toString = function () {
  var out = [];
  if (null !== this.scheme_) { out.push(this.scheme_, ':'); }
  if (null !== this.domain_) {
    out.push('//');
    if (null !== this.credentials_) { out.push(this.credentials_, '@'); }
    out.push(this.domain_);
    if (null !== this.port_) { out.push(':', this.port_.toString()); }
  }
  if (null !== this.path_) { out.push(this.path_); }
  if (null !== this.query_) { out.push('?', this.query_); }
  if (null !== this.fragment_) { out.push('#', this.fragment_); }
  return out.join('');
};

URI.prototype.clone = function () {
  return new URI(this.scheme_, this.credentials_, this.domain_, this.port_,
                 this.path_, this.query_, this.fragment_);
};

URI.prototype.getScheme = function () {
  // HTML5 spec does not require the scheme to be lowercased but
  // all common browsers except Safari lowercase the scheme.
  return this.scheme_ && decodeURIComponent(this.scheme_).toLowerCase();
};
URI.prototype.getRawScheme = function () {
  return this.scheme_;
};
URI.prototype.setScheme = function (newScheme) {
  this.scheme_ = encodeIfExists2(
      newScheme, URI_DISALLOWED_IN_SCHEME_OR_CREDENTIALS_);
  return this;
};
URI.prototype.setRawScheme = function (newScheme) {
  this.scheme_ = newScheme ? newScheme : null;
  return this;
};
URI.prototype.hasScheme = function () {
  return null !== this.scheme_;
};


URI.prototype.getCredentials = function () {
  return this.credentials_ && decodeURIComponent(this.credentials_);
};
URI.prototype.getRawCredentials = function () {
  return this.credentials_;
};
URI.prototype.setCredentials = function (newCredentials) {
  this.credentials_ = encodeIfExists2(
      newCredentials, URI_DISALLOWED_IN_SCHEME_OR_CREDENTIALS_);

  return this;
};
URI.prototype.setRawCredentials = function (newCredentials) {
  this.credentials_ = newCredentials ? newCredentials : null;
  return this;
};
URI.prototype.hasCredentials = function () {
  return null !== this.credentials_;
};


URI.prototype.getDomain = function () {
  return this.domain_ && decodeURIComponent(this.domain_);
};
URI.prototype.getRawDomain = function () {
  return this.domain_;
};
URI.prototype.setDomain = function (newDomain) {
  return this.setRawDomain(newDomain && encodeURIComponent(newDomain));
};
URI.prototype.setRawDomain = function (newDomain) {
  this.domain_ = newDomain ? newDomain : null;
  // Maintain the invariant that paths must start with a slash when the URI
  // is not path-relative.
  return this.setRawPath(this.path_);
};
URI.prototype.hasDomain = function () {
  return null !== this.domain_;
};


URI.prototype.getPort = function () {
  return this.port_ && decodeURIComponent(this.port_);
};
URI.prototype.setPort = function (newPort) {
  if (newPort) {
    newPort = Number(newPort);
    if (newPort !== (newPort & 0xffff)) {
      throw new Error('Bad port number ' + newPort);
    }
    this.port_ = '' + newPort;
  } else {
    this.port_ = null;
  }
  return this;
};
URI.prototype.hasPort = function () {
  return null !== this.port_;
};


URI.prototype.getPath = function () {
  return this.path_ && decodeURIComponent(this.path_);
};
URI.prototype.getRawPath = function () {
  return this.path_;
};
URI.prototype.setPath = function (newPath) {
  return this.setRawPath(encodeIfExists2(newPath, URI_DISALLOWED_IN_PATH_));
};
URI.prototype.setRawPath = function (newPath) {
  if (newPath) {
    newPath = String(newPath);
    this.path_ = 
      // Paths must start with '/' unless this is a path-relative URL.
      (!this.domain_ || /^\//.test(newPath)) ? newPath : '/' + newPath;
  } else {
    this.path_ = null;
  }
  return this;
};
URI.prototype.hasPath = function () {
  return null !== this.path_;
};


URI.prototype.getQuery = function () {
  // From http://www.w3.org/Addressing/URL/4_URI_Recommentations.html
  // Within the query string, the plus sign is reserved as shorthand notation
  // for a space.
  return this.query_ && decodeURIComponent(this.query_).replace(/\+/g, ' ');
};
URI.prototype.getRawQuery = function () {
  return this.query_;
};
URI.prototype.setQuery = function (newQuery) {
  this.paramCache_ = null;
  this.query_ = encodeIfExists(newQuery);
  return this;
};
URI.prototype.setRawQuery = function (newQuery) {
  this.paramCache_ = null;
  this.query_ = newQuery ? newQuery : null;
  return this;
};
URI.prototype.hasQuery = function () {
  return null !== this.query_;
};

/**
 * sets the query given a list of strings of the form
 * [ key0, value0, key1, value1, ... ].
 *
 * <p><code>uri.setAllParameters(['a', 'b', 'c', 'd']).getQuery()</code>
 * will yield <code>'a=b&c=d'</code>.
 */
URI.prototype.setAllParameters = function (params) {
  if (typeof params === 'object') {
    if (!(params instanceof Array)
        && (params instanceof Object
            || Object.prototype.toString.call(params) !== '[object Array]')) {
      var newParams = [];
      var i = -1;
      for (var k in params) {
        var v = params[k];
        if ('string' === typeof v) {
          newParams[++i] = k;
          newParams[++i] = v;
        }
      }
      params = newParams;
    }
  }
  this.paramCache_ = null;
  var queryBuf = [];
  var separator = '';
  for (var j = 0; j < params.length;) {
    var k = params[j++];
    var v = params[j++];
    queryBuf.push(separator, encodeURIComponent(k.toString()));
    separator = '&';
    if (v) {
      queryBuf.push('=', encodeURIComponent(v.toString()));
    }
  }
  this.query_ = queryBuf.join('');
  return this;
};
URI.prototype.checkParameterCache_ = function () {
  if (!this.paramCache_) {
    var q = this.query_;
    if (!q) {
      this.paramCache_ = [];
    } else {
      var cgiParams = q.split(/[&\?]/);
      var out = [];
      var k = -1;
      for (var i = 0; i < cgiParams.length; ++i) {
        var m = cgiParams[i].match(/^([^=]*)(?:=(.*))?$/);
        // From http://www.w3.org/Addressing/URL/4_URI_Recommentations.html
        // Within the query string, the plus sign is reserved as shorthand
        // notation for a space.
        out[++k] = decodeURIComponent(m[1]).replace(/\+/g, ' ');
        out[++k] = decodeURIComponent(m[2] || '').replace(/\+/g, ' ');
      }
      this.paramCache_ = out;
    }
  }
};
/**
 * sets the values of the named cgi parameters.
 *
 * <p>So, <code>uri.parse('foo?a=b&c=d&e=f').setParameterValues('c', ['new'])
 * </code> yields <tt>foo?a=b&c=new&e=f</tt>.</p>
 *
 * @param key {string}
 * @param values {Array.<string>} the new values.  If values is a single string
 *   then it will be treated as the sole value.
 */
URI.prototype.setParameterValues = function (key, values) {
  // be nice and avoid subtle bugs where [] operator on string performs charAt
  // on some browsers and crashes on IE
  if (typeof values === 'string') {
    values = [ values ];
  }

  this.checkParameterCache_();
  var newValueIndex = 0;
  var pc = this.paramCache_;
  var params = [];
  for (var i = 0, k = 0; i < pc.length; i += 2) {
    if (key === pc[i]) {
      if (newValueIndex < values.length) {
        params.push(key, values[newValueIndex++]);
      }
    } else {
      params.push(pc[i], pc[i + 1]);
    }
  }
  while (newValueIndex < values.length) {
    params.push(key, values[newValueIndex++]);
  }
  this.setAllParameters(params);
  return this;
};
URI.prototype.removeParameter = function (key) {
  return this.setParameterValues(key, []);
};
/**
 * returns the parameters specified in the query part of the uri as a list of
 * keys and values like [ key0, value0, key1, value1, ... ].
 *
 * @return {Array.<string>}
 */
URI.prototype.getAllParameters = function () {
  this.checkParameterCache_();
  return this.paramCache_.slice(0, this.paramCache_.length);
};
/**
 * returns the value<b>s</b> for a given cgi parameter as a list of decoded
 * query parameter values.
 * @return {Array.<string>}
 */
URI.prototype.getParameterValues = function (paramNameUnescaped) {
  this.checkParameterCache_();
  var values = [];
  for (var i = 0; i < this.paramCache_.length; i += 2) {
    if (paramNameUnescaped === this.paramCache_[i]) {
      values.push(this.paramCache_[i + 1]);
    }
  }
  return values;
};
/**
 * returns a map of cgi parameter names to (non-empty) lists of values.
 * @return {Object.<string,Array.<string>>}
 */
URI.prototype.getParameterMap = function (paramNameUnescaped) {
  this.checkParameterCache_();
  var paramMap = {};
  for (var i = 0; i < this.paramCache_.length; i += 2) {
    var key = this.paramCache_[i++],
      value = this.paramCache_[i++];
    if (!(key in paramMap)) {
      paramMap[key] = [value];
    } else {
      paramMap[key].push(value);
    }
  }
  return paramMap;
};
/**
 * returns the first value for a given cgi parameter or null if the given
 * parameter name does not appear in the query string.
 * If the given parameter name does appear, but has no '<tt>=</tt>' following
 * it, then the empty string will be returned.
 * @return {string|null}
 */
URI.prototype.getParameterValue = function (paramNameUnescaped) {
  this.checkParameterCache_();
  for (var i = 0; i < this.paramCache_.length; i += 2) {
    if (paramNameUnescaped === this.paramCache_[i]) {
      return this.paramCache_[i + 1];
    }
  }
  return null;
};

URI.prototype.getFragment = function () {
  return this.fragment_ && decodeURIComponent(this.fragment_);
};
URI.prototype.getRawFragment = function () {
  return this.fragment_;
};
URI.prototype.setFragment = function (newFragment) {
  this.fragment_ = newFragment ? encodeURIComponent(newFragment) : null;
  return this;
};
URI.prototype.setRawFragment = function (newFragment) {
  this.fragment_ = newFragment ? newFragment : null;
  return this;
};
URI.prototype.hasFragment = function () {
  return null !== this.fragment_;
};

function nullIfAbsent(matchPart) {
  return ('string' == typeof matchPart) && (matchPart.length > 0)
         ? matchPart
         : null;
}




/**
 * a regular expression for breaking a URI into its component parts.
 *
 * <p>http://www.gbiv.com/protocols/uri/rfc/rfc3986.html#RFC2234 says
 * As the "first-match-wins" algorithm is identical to the "greedy"
 * disambiguation method used by POSIX regular expressions, it is natural and
 * commonplace to use a regular expression for parsing the potential five
 * components of a URI reference.
 *
 * <p>The following line is the regular expression for breaking-down a
 * well-formed URI reference into its components.
 *
 * <pre>
 * ^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?
 *  12            3  4          5       6  7        8 9
 * </pre>
 *
 * <p>The numbers in the second line above are only to assist readability; they
 * indicate the reference points for each subexpression (i.e., each paired
 * parenthesis). We refer to the value matched for subexpression <n> as $<n>.
 * For example, matching the above expression to
 * <pre>
 *     http://www.ics.uci.edu/pub/ietf/uri/#Related
 * </pre>
 * results in the following subexpression matches:
 * <pre>
 *    $1 = http:
 *    $2 = http
 *    $3 = //www.ics.uci.edu
 *    $4 = www.ics.uci.edu
 *    $5 = /pub/ietf/uri/
 *    $6 = <undefined>
 *    $7 = <undefined>
 *    $8 = #Related
 *    $9 = Related
 * </pre>
 * where <undefined> indicates that the component is not present, as is the
 * case for the query component in the above example. Therefore, we can
 * determine the value of the five components as
 * <pre>
 *    scheme    = $2
 *    authority = $4
 *    path      = $5
 *    query     = $7
 *    fragment  = $9
 * </pre>
 *
 * <p>msamuel: I have modified the regular expression slightly to expose the
 * credentials, domain, and port separately from the authority.
 * The modified version yields
 * <pre>
 *    $1 = http              scheme
 *    $2 = <undefined>       credentials -\
 *    $3 = www.ics.uci.edu   domain       | authority
 *    $4 = <undefined>       port        -/
 *    $5 = /pub/ietf/uri/    path
 *    $6 = <undefined>       query without ?
 *    $7 = Related           fragment without #
 * </pre>
 */
var URI_RE_ = new RegExp(
      "^" +
      "(?:" +
        "([^:/?#]+)" +         // scheme
      ":)?" +
      "(?://" +
        "(?:([^/?#]*)@)?" +    // credentials
        "([^/?#:@]*)" +        // domain
        "(?::([0-9]+))?" +     // port
      ")?" +
      "([^?#]+)?" +            // path
      "(?:\\?([^#]*))?" +      // query
      "(?:#(.*))?" +           // fragment
      "$"
      );

var URI_DISALLOWED_IN_SCHEME_OR_CREDENTIALS_ = /[#\/\?@]/g;
var URI_DISALLOWED_IN_PATH_ = /[\#\?]/g;

URI.parse = parse;
URI.create = create;
URI.resolve = resolve;
URI.collapse_dots = collapse_dots;  // Visible for testing.

// lightweight string-based api for loadModuleMaker
URI.utils = {
  mimeTypeOf: function (uri) {
    var uriObj = parse(uri);
    if (/\.html$/.test(uriObj.getPath())) {
      return 'text/html';
    } else {
      return 'application/javascript';
    }
  },
  resolve: function (base, uri) {
    if (base) {
      return resolve(parse(base), parse(uri)).toString();
    } else {
      return '' + uri;
    }
  }
};


return URI;
})();

// Copyright Google Inc.
// Licensed under the Apache Licence Version 2.0
// Autogenerated at Mon Feb 25 13:05:42 EST 2013
// @overrides window
// @provides html4
var html4 = {};
html4.atype = {
  'NONE': 0,
  'URI': 1,
  'URI_FRAGMENT': 11,
  'SCRIPT': 2,
  'STYLE': 3,
  'HTML': 12,
  'ID': 4,
  'IDREF': 5,
  'IDREFS': 6,
  'GLOBAL_NAME': 7,
  'LOCAL_NAME': 8,
  'CLASSES': 9,
  'FRAME_TARGET': 10,
  'MEDIA_QUERY': 13
};
html4[ 'atype' ] = html4.atype;
html4.ATTRIBS = {
  '*::class': 9,
  '*::dir': 0,
  '*::draggable': 0,
  '*::hidden': 0,
  '*::id': 4,
  '*::inert': 0,
  '*::itemprop': 0,
  '*::itemref': 6,
  '*::itemscope': 0,
  '*::lang': 0,
  '*::onblur': 2,
  '*::onchange': 2,
  '*::onclick': 2,
  '*::ondblclick': 2,
  '*::onfocus': 2,
  '*::onkeydown': 2,
  '*::onkeypress': 2,
  '*::onkeyup': 2,
  '*::onload': 2,
  '*::onmousedown': 2,
  '*::onmousemove': 2,
  '*::onmouseout': 2,
  '*::onmouseover': 2,
  '*::onmouseup': 2,
  '*::onreset': 2,
  '*::onscroll': 2,
  '*::onselect': 2,
  '*::onsubmit': 2,
  '*::onunload': 2,
  '*::spellcheck': 0,
  '*::style': 3,
  '*::title': 0,
  '*::translate': 0,
  'a::accesskey': 0,
  'a::coords': 0,
  'a::href': 1,
  'a::hreflang': 0,
  'a::name': 7,
  'a::onblur': 2,
  'a::onfocus': 2,
  'a::shape': 0,
  'a::tabindex': 0,
  'a::target': 10,
  'a::type': 0,
  'area::accesskey': 0,
  'area::alt': 0,
  'area::coords': 0,
  'area::href': 1,
  'area::nohref': 0,
  'area::onblur': 2,
  'area::onfocus': 2,
  'area::shape': 0,
  'area::tabindex': 0,
  'area::target': 10,
  'audio::controls': 0,
  'audio::loop': 0,
  'audio::mediagroup': 5,
  'audio::muted': 0,
  'audio::preload': 0,
  'bdo::dir': 0,
  'blockquote::cite': 1,
  'br::clear': 0,
  'button::accesskey': 0,
  'button::disabled': 0,
  'button::name': 8,
  'button::onblur': 2,
  'button::onfocus': 2,
  'button::tabindex': 0,
  'button::type': 0,
  'button::value': 0,
  'canvas::height': 0,
  'canvas::width': 0,
  'caption::align': 0,
  'col::align': 0,
  'col::char': 0,
  'col::charoff': 0,
  'col::span': 0,
  'col::valign': 0,
  'col::width': 0,
  'colgroup::align': 0,
  'colgroup::char': 0,
  'colgroup::charoff': 0,
  'colgroup::span': 0,
  'colgroup::valign': 0,
  'colgroup::width': 0,
  'command::checked': 0,
  'command::command': 5,
  'command::disabled': 0,
  'command::icon': 1,
  'command::label': 0,
  'command::radiogroup': 0,
  'command::type': 0,
  'data::value': 0,
  'del::cite': 1,
  'del::datetime': 0,
  'details::open': 0,
  'dir::compact': 0,
  'div::align': 0,
  'dl::compact': 0,
  'fieldset::disabled': 0,
  'font::color': 0,
  'font::face': 0,
  'font::size': 0,
  'form::accept': 0,
  'form::action': 1,
  'form::autocomplete': 0,
  'form::enctype': 0,
  'form::method': 0,
  'form::name': 7,
  'form::novalidate': 0,
  'form::onreset': 2,
  'form::onsubmit': 2,
  'form::target': 10,
  'h1::align': 0,
  'h2::align': 0,
  'h3::align': 0,
  'h4::align': 0,
  'h5::align': 0,
  'h6::align': 0,
  'hr::align': 0,
  'hr::noshade': 0,
  'hr::size': 0,
  'hr::width': 0,
  'iframe::align': 0,
  'iframe::frameborder': 0,
  'iframe::height': 0,
  'iframe::marginheight': 0,
  'iframe::marginwidth': 0,
  'iframe::width': 0,
  'img::align': 0,
  'img::alt': 0,
  'img::border': 0,
  'img::height': 0,
  'img::hspace': 0,
  'img::ismap': 0,
  'img::name': 7,
  'img::src': 1,
  'img::usemap': 11,
  'img::vspace': 0,
  'img::width': 0,
  'input::accept': 0,
  'input::accesskey': 0,
  'input::align': 0,
  'input::alt': 0,
  'input::autocomplete': 0,
  'input::checked': 0,
  'input::disabled': 0,
  'input::inputmode': 0,
  'input::ismap': 0,
  'input::list': 5,
  'input::max': 0,
  'input::maxlength': 0,
  'input::min': 0,
  'input::multiple': 0,
  'input::name': 8,
  'input::onblur': 2,
  'input::onchange': 2,
  'input::onfocus': 2,
  'input::onselect': 2,
  'input::placeholder': 0,
  'input::readonly': 0,
  'input::required': 0,
  'input::size': 0,
  'input::src': 1,
  'input::step': 0,
  'input::tabindex': 0,
  'input::type': 0,
  'input::usemap': 11,
  'input::value': 0,
  'ins::cite': 1,
  'ins::datetime': 0,
  'label::accesskey': 0,
  'label::for': 5,
  'label::onblur': 2,
  'label::onfocus': 2,
  'legend::accesskey': 0,
  'legend::align': 0,
  'li::type': 0,
  'li::value': 0,
  'map::name': 7,
  'menu::compact': 0,
  'menu::label': 0,
  'menu::type': 0,
  'meter::high': 0,
  'meter::low': 0,
  'meter::max': 0,
  'meter::min': 0,
  'meter::value': 0,
  'ol::compact': 0,
  'ol::reversed': 0,
  'ol::start': 0,
  'ol::type': 0,
  'optgroup::disabled': 0,
  'optgroup::label': 0,
  'option::disabled': 0,
  'option::label': 0,
  'option::selected': 0,
  'option::value': 0,
  'output::for': 6,
  'output::name': 8,
  'p::align': 0,
  'pre::width': 0,
  'progress::max': 0,
  'progress::min': 0,
  'progress::value': 0,
  'q::cite': 1,
  'select::autocomplete': 0,
  'select::disabled': 0,
  'select::multiple': 0,
  'select::name': 8,
  'select::onblur': 2,
  'select::onchange': 2,
  'select::onfocus': 2,
  'select::required': 0,
  'select::size': 0,
  'select::tabindex': 0,
  'source::type': 0,
  'table::align': 0,
  'table::bgcolor': 0,
  'table::border': 0,
  'table::cellpadding': 0,
  'table::cellspacing': 0,
  'table::frame': 0,
  'table::rules': 0,
  'table::summary': 0,
  'table::width': 0,
  'tbody::align': 0,
  'tbody::char': 0,
  'tbody::charoff': 0,
  'tbody::valign': 0,
  'td::abbr': 0,
  'td::align': 0,
  'td::axis': 0,
  'td::bgcolor': 0,
  'td::char': 0,
  'td::charoff': 0,
  'td::colspan': 0,
  'td::headers': 6,
  'td::height': 0,
  'td::nowrap': 0,
  'td::rowspan': 0,
  'td::scope': 0,
  'td::valign': 0,
  'td::width': 0,
  'textarea::accesskey': 0,
  'textarea::autocomplete': 0,
  'textarea::cols': 0,
  'textarea::disabled': 0,
  'textarea::inputmode': 0,
  'textarea::name': 8,
  'textarea::onblur': 2,
  'textarea::onchange': 2,
  'textarea::onfocus': 2,
  'textarea::onselect': 2,
  'textarea::placeholder': 0,
  'textarea::readonly': 0,
  'textarea::required': 0,
  'textarea::rows': 0,
  'textarea::tabindex': 0,
  'textarea::wrap': 0,
  'tfoot::align': 0,
  'tfoot::char': 0,
  'tfoot::charoff': 0,
  'tfoot::valign': 0,
  'th::abbr': 0,
  'th::align': 0,
  'th::axis': 0,
  'th::bgcolor': 0,
  'th::char': 0,
  'th::charoff': 0,
  'th::colspan': 0,
  'th::headers': 6,
  'th::height': 0,
  'th::nowrap': 0,
  'th::rowspan': 0,
  'th::scope': 0,
  'th::valign': 0,
  'th::width': 0,
  'thead::align': 0,
  'thead::char': 0,
  'thead::charoff': 0,
  'thead::valign': 0,
  'tr::align': 0,
  'tr::bgcolor': 0,
  'tr::char': 0,
  'tr::charoff': 0,
  'tr::valign': 0,
  'track::default': 0,
  'track::kind': 0,
  'track::label': 0,
  'track::srclang': 0,
  'ul::compact': 0,
  'ul::type': 0,
  'video::controls': 0,
  'video::height': 0,
  'video::loop': 0,
  'video::mediagroup': 5,
  'video::muted': 0,
  'video::poster': 1,
  'video::preload': 0,
  'video::width': 0
};
html4[ 'ATTRIBS' ] = html4.ATTRIBS;
html4.eflags = {
  'OPTIONAL_ENDTAG': 1,
  'EMPTY': 2,
  'CDATA': 4,
  'RCDATA': 8,
  'UNSAFE': 16,
  'FOLDABLE': 32,
  'SCRIPT': 64,
  'STYLE': 128,
  'VIRTUALIZED': 256
};
html4[ 'eflags' ] = html4.eflags;
// these are bitmasks of the eflags above.
html4.ELEMENTS = {
  'a': 0,
  'abbr': 0,
  'acronym': 0,
  'address': 0,
  'applet': 272,
  'area': 2,
  'article': 0,
  'aside': 0,
  'audio': 0,
  'b': 0,
  'base': 274,
  'basefont': 274,
  'bdi': 0,
  'bdo': 0,
  'big': 0,
  'blockquote': 0,
  'body': 305,
  'br': 2,
  'button': 0,
  'canvas': 0,
  'caption': 0,
  'center': 0,
  'cite': 0,
  'code': 0,
  'col': 2,
  'colgroup': 1,
  'command': 2,
  'data': 0,
  'datalist': 0,
  'dd': 1,
  'del': 0,
  'details': 0,
  'dfn': 0,
  'dialog': 272,
  'dir': 0,
  'div': 0,
  'dl': 0,
  'dt': 1,
  'em': 0,
  'fieldset': 0,
  'figcaption': 0,
  'figure': 0,
  'font': 0,
  'footer': 0,
  'form': 0,
  'frame': 274,
  'frameset': 272,
  'h1': 0,
  'h2': 0,
  'h3': 0,
  'h4': 0,
  'h5': 0,
  'h6': 0,
  'head': 305,
  'header': 0,
  'hgroup': 0,
  'hr': 2,
  'html': 305,
  'i': 0,
  'iframe': 16,
  'img': 2,
  'input': 2,
  'ins': 0,
  'isindex': 274,
  'kbd': 0,
  'keygen': 274,
  'label': 0,
  'legend': 0,
  'li': 1,
  'link': 274,
  'map': 0,
  'mark': 0,
  'menu': 0,
  'meta': 274,
  'meter': 0,
  'nav': 0,
  'nobr': 0,
  'noembed': 276,
  'noframes': 276,
  'noscript': 276,
  'object': 272,
  'ol': 0,
  'optgroup': 0,
  'option': 1,
  'output': 0,
  'p': 1,
  'param': 274,
  'pre': 0,
  'progress': 0,
  'q': 0,
  's': 0,
  'samp': 0,
  'script': 84,
  'section': 0,
  'select': 0,
  'small': 0,
  'source': 2,
  'span': 0,
  'strike': 0,
  'strong': 0,
  'style': 148,
  'sub': 0,
  'summary': 0,
  'sup': 0,
  'table': 0,
  'tbody': 1,
  'td': 1,
  'textarea': 8,
  'tfoot': 1,
  'th': 1,
  'thead': 1,
  'time': 0,
  'title': 280,
  'tr': 1,
  'track': 2,
  'tt': 0,
  'u': 0,
  'ul': 0,
  'var': 0,
  'video': 0,
  'wbr': 2
};
html4[ 'ELEMENTS' ] = html4.ELEMENTS;
html4.ELEMENT_DOM_INTERFACES = {
  'a': 'HTMLAnchorElement',
  'abbr': 'HTMLElement',
  'acronym': 'HTMLElement',
  'address': 'HTMLElement',
  'applet': 'HTMLAppletElement',
  'area': 'HTMLAreaElement',
  'article': 'HTMLElement',
  'aside': 'HTMLElement',
  'audio': 'HTMLAudioElement',
  'b': 'HTMLElement',
  'base': 'HTMLBaseElement',
  'basefont': 'HTMLBaseFontElement',
  'bdi': 'HTMLElement',
  'bdo': 'HTMLElement',
  'big': 'HTMLElement',
  'blockquote': 'HTMLQuoteElement',
  'body': 'HTMLBodyElement',
  'br': 'HTMLBRElement',
  'button': 'HTMLButtonElement',
  'canvas': 'HTMLCanvasElement',
  'caption': 'HTMLTableCaptionElement',
  'center': 'HTMLElement',
  'cite': 'HTMLElement',
  'code': 'HTMLElement',
  'col': 'HTMLTableColElement',
  'colgroup': 'HTMLTableColElement',
  'command': 'HTMLCommandElement',
  'data': 'HTMLElement',
  'datalist': 'HTMLDataListElement',
  'dd': 'HTMLElement',
  'del': 'HTMLModElement',
  'details': 'HTMLDetailsElement',
  'dfn': 'HTMLElement',
  'dialog': 'HTMLDialogElement',
  'dir': 'HTMLDirectoryElement',
  'div': 'HTMLDivElement',
  'dl': 'HTMLDListElement',
  'dt': 'HTMLElement',
  'em': 'HTMLElement',
  'fieldset': 'HTMLFieldSetElement',
  'figcaption': 'HTMLElement',
  'figure': 'HTMLElement',
  'font': 'HTMLFontElement',
  'footer': 'HTMLElement',
  'form': 'HTMLFormElement',
  'frame': 'HTMLFrameElement',
  'frameset': 'HTMLFrameSetElement',
  'h1': 'HTMLHeadingElement',
  'h2': 'HTMLHeadingElement',
  'h3': 'HTMLHeadingElement',
  'h4': 'HTMLHeadingElement',
  'h5': 'HTMLHeadingElement',
  'h6': 'HTMLHeadingElement',
  'head': 'HTMLHeadElement',
  'header': 'HTMLElement',
  'hgroup': 'HTMLElement',
  'hr': 'HTMLHRElement',
  'html': 'HTMLHtmlElement',
  'i': 'HTMLElement',
  'iframe': 'HTMLIFrameElement',
  'img': 'HTMLImageElement',
  'input': 'HTMLInputElement',
  'ins': 'HTMLModElement',
  'isindex': 'HTMLUnknownElement',
  'kbd': 'HTMLElement',
  'keygen': 'HTMLKeygenElement',
  'label': 'HTMLLabelElement',
  'legend': 'HTMLLegendElement',
  'li': 'HTMLLIElement',
  'link': 'HTMLLinkElement',
  'map': 'HTMLMapElement',
  'mark': 'HTMLElement',
  'menu': 'HTMLMenuElement',
  'meta': 'HTMLMetaElement',
  'meter': 'HTMLMeterElement',
  'nav': 'HTMLElement',
  'nobr': 'HTMLElement',
  'noembed': 'HTMLElement',
  'noframes': 'HTMLElement',
  'noscript': 'HTMLElement',
  'object': 'HTMLObjectElement',
  'ol': 'HTMLOListElement',
  'optgroup': 'HTMLOptGroupElement',
  'option': 'HTMLOptionElement',
  'output': 'HTMLOutputElement',
  'p': 'HTMLParagraphElement',
  'param': 'HTMLParamElement',
  'pre': 'HTMLPreElement',
  'progress': 'HTMLProgressElement',
  'q': 'HTMLQuoteElement',
  's': 'HTMLElement',
  'samp': 'HTMLElement',
  'script': 'HTMLScriptElement',
  'section': 'HTMLElement',
  'select': 'HTMLSelectElement',
  'small': 'HTMLElement',
  'source': 'HTMLSourceElement',
  'span': 'HTMLSpanElement',
  'strike': 'HTMLElement',
  'strong': 'HTMLElement',
  'style': 'HTMLStyleElement',
  'sub': 'HTMLElement',
  'summary': 'HTMLElement',
  'sup': 'HTMLElement',
  'table': 'HTMLTableElement',
  'tbody': 'HTMLTableSectionElement',
  'td': 'HTMLTableDataCellElement',
  'textarea': 'HTMLTextAreaElement',
  'tfoot': 'HTMLTableSectionElement',
  'th': 'HTMLTableHeaderCellElement',
  'thead': 'HTMLTableSectionElement',
  'time': 'HTMLTimeElement',
  'title': 'HTMLTitleElement',
  'tr': 'HTMLTableRowElement',
  'track': 'HTMLTrackElement',
  'tt': 'HTMLElement',
  'u': 'HTMLElement',
  'ul': 'HTMLUListElement',
  'var': 'HTMLElement',
  'video': 'HTMLVideoElement',
  'wbr': 'HTMLElement'
};
html4[ 'ELEMENT_DOM_INTERFACES' ] = html4.ELEMENT_DOM_INTERFACES;
html4.ueffects = {
  'NOT_LOADED': 0,
  'SAME_DOCUMENT': 1,
  'NEW_DOCUMENT': 2
};
html4[ 'ueffects' ] = html4.ueffects;
html4.URIEFFECTS = {
  'a::href': 2,
  'area::href': 2,
  'blockquote::cite': 0,
  'command::icon': 1,
  'del::cite': 0,
  'form::action': 2,
  'img::src': 1,
  'input::src': 1,
  'ins::cite': 0,
  'q::cite': 0,
  'video::poster': 1
};
html4[ 'URIEFFECTS' ] = html4.URIEFFECTS;
html4.ltypes = {
  'UNSANDBOXED': 2,
  'SANDBOXED': 1,
  'DATA': 0
};
html4[ 'ltypes' ] = html4.ltypes;
html4.LOADERTYPES = {
  'a::href': 2,
  'area::href': 2,
  'blockquote::cite': 2,
  'command::icon': 1,
  'del::cite': 2,
  'form::action': 2,
  'img::src': 1,
  'input::src': 1,
  'ins::cite': 2,
  'q::cite': 2,
  'video::poster': 1
};
html4[ 'LOADERTYPES' ] = html4.LOADERTYPES;

// Copyright (C) 2006 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview
 * An HTML sanitizer that can satisfy a variety of security policies.
 *
 * <p>
 * The HTML sanitizer is built around a SAX parser and HTML element and
 * attributes schemas.
 *
 * If the cssparser is loaded, inline styles are sanitized using the
 * css property and value schemas.  Else they are remove during
 * sanitization.
 *
 * If it exists, uses parseCssDeclarations, sanitizeCssProperty,  cssSchema
 *
 * @author mikesamuel@gmail.com
 * @author jasvir@gmail.com
 * \@requires html4, URI
 * \@overrides window
 * \@provides html, html_sanitize
 */

// The Turkish i seems to be a non-issue, but abort in case it is.
if ('I'.toLowerCase() !== 'i') { throw 'I/i problem'; }

/**
 * \@namespace
 */
var html = (function(html4) {

  // For closure compiler
  var parseCssDeclarations, sanitizeCssProperty, cssSchema;
  if ('undefined' !== typeof window) {
    parseCssDeclarations = window['parseCssDeclarations'];
    sanitizeCssProperty = window['sanitizeCssProperty'];
    cssSchema = window['cssSchema'];
  }

  // The keys of this object must be 'quoted' or JSCompiler will mangle them!
  // This is a partial list -- lookupEntity() uses the host browser's parser
  // (when available) to implement full entity lookup.
  // Note that entities are in general case-sensitive; the uppercase ones are
  // explicitly defined by HTML5 (presumably as compatibility).
  var ENTITIES = {
    'lt': '<',
    'LT': '<',
    'gt': '>',
    'GT': '>',
    'amp': '&',
    'AMP': '&',
    'quot': '"',
    'apos': '\'',
    'nbsp': '\u00A0'
  };

  // Patterns for types of entity/character reference names.
  var decimalEscapeRe = /^#(\d+)$/;
  var hexEscapeRe = /^#x([0-9A-Fa-f]+)$/;
  // contains every entity per http://www.w3.org/TR/2011/WD-html5-20110113/named-character-references.html
  var safeEntityNameRe = /^[A-Za-z][A-za-z0-9]+$/;
  // Used as a hook to invoke the browser's entity parsing. <textarea> is used
  // because its content is parsed for entities but not tags.
  // TODO(kpreid): This retrieval is a kludge and leads to silent loss of
  // functionality if the document isn't available.
  var entityLookupElement =
      ('undefined' !== typeof window && window['document'])
          ? window['document'].createElement('textarea') : null;
  /**
   * Decodes an HTML entity.
   *
   * {\@updoc
   * $ lookupEntity('lt')
   * # '<'
   * $ lookupEntity('GT')
   * # '>'
   * $ lookupEntity('amp')
   * # '&'
   * $ lookupEntity('nbsp')
   * # '\xA0'
   * $ lookupEntity('apos')
   * # "'"
   * $ lookupEntity('quot')
   * # '"'
   * $ lookupEntity('#xa')
   * # '\n'
   * $ lookupEntity('#10')
   * # '\n'
   * $ lookupEntity('#x0a')
   * # '\n'
   * $ lookupEntity('#010')
   * # '\n'
   * $ lookupEntity('#x00A')
   * # '\n'
   * $ lookupEntity('Pi')      // Known failure
   * # '\u03A0'
   * $ lookupEntity('pi')      // Known failure
   * # '\u03C0'
   * }
   *
   * @param {string} name the content between the '&' and the ';'.
   * @return {string} a single unicode code-point as a string.
   */
  function lookupEntity(name) {
    // TODO: entity lookup as specified by HTML5 actually depends on the
    // presence of the ";".
    if (ENTITIES.hasOwnProperty(name)) { return ENTITIES[name]; }
    var m = name.match(decimalEscapeRe);
    if (m) {
      return String.fromCharCode(parseInt(m[1], 10));
    } else if (!!(m = name.match(hexEscapeRe))) {
      return String.fromCharCode(parseInt(m[1], 16));
    } else if (entityLookupElement && safeEntityNameRe.test(name)) {
      entityLookupElement.innerHTML = '&' + name + ';';
      var text = entityLookupElement.textContent;
      ENTITIES[name] = text;
      return text;
    } else {
      return '&' + name + ';';
    }
  }

  function decodeOneEntity(_, name) {
    return lookupEntity(name);
  }

  var nulRe = /\0/g;
  function stripNULs(s) {
    return s.replace(nulRe, '');
  }

  var ENTITY_RE_1 = /&(#[0-9]+|#[xX][0-9A-Fa-f]+|\w+);/g;
  var ENTITY_RE_2 = /^(#[0-9]+|#[xX][0-9A-Fa-f]+|\w+);/;
  /**
   * The plain text of a chunk of HTML CDATA which possibly containing.
   *
   * {\@updoc
   * $ unescapeEntities('')
   * # ''
   * $ unescapeEntities('hello World!')
   * # 'hello World!'
   * $ unescapeEntities('1 &lt; 2 &amp;&AMP; 4 &gt; 3&#10;')
   * # '1 < 2 && 4 > 3\n'
   * $ unescapeEntities('&lt;&lt <- unfinished entity&gt;')
   * # '<&lt <- unfinished entity>'
   * $ unescapeEntities('/foo?bar=baz&copy=true')  // & often unescaped in URLS
   * # '/foo?bar=baz&copy=true'
   * $ unescapeEntities('pi=&pi;&#x3c0;, Pi=&Pi;\u03A0') // FIXME: known failure
   * # 'pi=\u03C0\u03c0, Pi=\u03A0\u03A0'
   * }
   *
   * @param {string} s a chunk of HTML CDATA.  It must not start or end inside
   *     an HTML entity.
   */
  function unescapeEntities(s) {
    return s.replace(ENTITY_RE_1, decodeOneEntity);
  }

  var ampRe = /&/g;
  var looseAmpRe = /&([^a-z#]|#(?:[^0-9x]|x(?:[^0-9a-f]|$)|$)|$)/gi;
  var ltRe = /[<]/g;
  var gtRe = />/g;
  var quotRe = /\"/g;

  /**
   * Escapes HTML special characters in attribute values.
   *
   * {\@updoc
   * $ escapeAttrib('')
   * # ''
   * $ escapeAttrib('"<<&==&>>"')  // Do not just escape the first occurrence.
   * # '&#34;&lt;&lt;&amp;&#61;&#61;&amp;&gt;&gt;&#34;'
   * $ escapeAttrib('Hello <World>!')
   * # 'Hello &lt;World&gt;!'
   * }
   */
  function escapeAttrib(s) {
    return ('' + s).replace(ampRe, '&amp;').replace(ltRe, '&lt;')
        .replace(gtRe, '&gt;').replace(quotRe, '&#34;');
  }

  /**
   * Escape entities in RCDATA that can be escaped without changing the meaning.
   * {\@updoc
   * $ normalizeRCData('1 < 2 &&amp; 3 > 4 &amp;& 5 &lt; 7&8')
   * # '1 &lt; 2 &amp;&amp; 3 &gt; 4 &amp;&amp; 5 &lt; 7&amp;8'
   * }
   */
  function normalizeRCData(rcdata) {
    return rcdata
        .replace(looseAmpRe, '&amp;$1')
        .replace(ltRe, '&lt;')
        .replace(gtRe, '&gt;');
  }

  // TODO(felix8a): validate sanitizer regexs against the HTML5 grammar at
  // http://www.whatwg.org/specs/web-apps/current-work/multipage/syntax.html
  // http://www.whatwg.org/specs/web-apps/current-work/multipage/parsing.html
  // http://www.whatwg.org/specs/web-apps/current-work/multipage/tokenization.html
  // http://www.whatwg.org/specs/web-apps/current-work/multipage/tree-construction.html

  // We initially split input so that potentially meaningful characters
  // like '<' and '>' are separate tokens, using a fast dumb process that
  // ignores quoting.  Then we walk that token stream, and when we see a
  // '<' that's the start of a tag, we use ATTR_RE to extract tag
  // attributes from the next token.  That token will never have a '>'
  // character.  However, it might have an unbalanced quote character, and
  // when we see that, we combine additional tokens to balance the quote.

  var ATTR_RE = new RegExp(
    '^\\s*' +
    '([-.:\\w]+)' +             // 1 = Attribute name
    '(?:' + (
      '\\s*(=)\\s*' +           // 2 = Is there a value?
      '(' + (                   // 3 = Attribute value
        // TODO(felix8a): maybe use backref to match quotes
        '(\")[^\"]*(\"|$)' +    // 4, 5 = Double-quoted string
        '|' +
        '(\')[^\']*(\'|$)' +    // 6, 7 = Single-quoted string
        '|' +
        // Positive lookahead to prevent interpretation of
        // <foo a= b=c> as <foo a='b=c'>
        // TODO(felix8a): might be able to drop this case
        '(?=[a-z][-\\w]*\\s*=)' +
        '|' +
        // Unquoted value that isn't an attribute name
        // (since we didn't match the positive lookahead above)
        '[^\"\'\\s]*' ) +
      ')' ) +
    ')?',
    'i');

  // false on IE<=8, true on most other browsers
  var splitWillCapture = ('a,b'.split(/(,)/).length === 3);

  // bitmask for tags with special parsing, like <script> and <textarea>
  var EFLAGS_TEXT = html4.eflags['CDATA'] | html4.eflags['RCDATA'];

  /**
   * Given a SAX-like event handler, produce a function that feeds those
   * events and a parameter to the event handler.
   *
   * The event handler has the form:{@code
   * {
   *   // Name is an upper-case HTML tag name.  Attribs is an array of
   *   // alternating upper-case attribute names, and attribute values.  The
   *   // attribs array is reused by the parser.  Param is the value passed to
   *   // the saxParser.
   *   startTag: function (name, attribs, param) { ... },
   *   endTag:   function (name, param) { ... },
   *   pcdata:   function (text, param) { ... },
   *   rcdata:   function (text, param) { ... },
   *   cdata:    function (text, param) { ... },
   *   startDoc: function (param) { ... },
   *   endDoc:   function (param) { ... }
   * }}
   *
   * @param {Object} handler a record containing event handlers.
   * @return {function(string, Object)} A function that takes a chunk of HTML
   *     and a parameter.  The parameter is passed on to the handler methods.
   */
  function makeSaxParser(handler) {
    // Accept quoted or unquoted keys (Closure compat)
    var hcopy = {
      cdata: handler.cdata || handler['cdata'],
      comment: handler.comment || handler['comment'],
      endDoc: handler.endDoc || handler['endDoc'],
      endTag: handler.endTag || handler['endTag'],
      pcdata: handler.pcdata || handler['pcdata'],
      rcdata: handler.rcdata || handler['rcdata'],
      startDoc: handler.startDoc || handler['startDoc'],
      startTag: handler.startTag || handler['startTag']
    };
    return function(htmlText, param) {
      return parse(htmlText, hcopy, param);
    };
  }

  // Parsing strategy is to split input into parts that might be lexically
  // meaningful (every ">" becomes a separate part), and then recombine
  // parts if we discover they're in a different context.

  // TODO(felix8a): Significant performance regressions from -legacy,
  // tested on
  //    Chrome 18.0
  //    Firefox 11.0
  //    IE 6, 7, 8, 9
  //    Opera 11.61
  //    Safari 5.1.3
  // Many of these are unusual patterns that are linearly slower and still
  // pretty fast (eg 1ms to 5ms), so not necessarily worth fixing.

  // TODO(felix8a): "<script> && && && ... <\/script>" is slower on all
  // browsers.  The hotspot is htmlSplit.

  // TODO(felix8a): "<p title='>>>>...'><\/p>" is slower on all browsers.
  // This is partly htmlSplit, but the hotspot is parseTagAndAttrs.

  // TODO(felix8a): "<a><\/a><a><\/a>..." is slower on IE9.
  // "<a>1<\/a><a>1<\/a>..." is faster, "<a><\/a>2<a><\/a>2..." is faster.

  // TODO(felix8a): "<p<p<p..." is slower on IE[6-8]

  var continuationMarker = {};
  function parse(htmlText, handler, param) {
    var m, p, tagName;
    var parts = htmlSplit(htmlText);
    var state = {
      noMoreGT: false,
      noMoreEndComments: false
    };
    parseCPS(handler, parts, 0, state, param);
  }

  function continuationMaker(h, parts, initial, state, param) {
    return function () {
      parseCPS(h, parts, initial, state, param);
    };
  }

  function parseCPS(h, parts, initial, state, param) {
    try {
      if (h.startDoc && initial == 0) { h.startDoc(param); }
      var m, p, tagName;
      for (var pos = initial, end = parts.length; pos < end;) {
        var current = parts[pos++];
        var next = parts[pos];
        switch (current) {
        case '&':
          if (ENTITY_RE_2.test(next)) {
            if (h.pcdata) {
              h.pcdata('&' + next, param, continuationMarker,
                continuationMaker(h, parts, pos, state, param));
            }
            pos++;
          } else {
            if (h.pcdata) { h.pcdata("&amp;", param, continuationMarker,
                continuationMaker(h, parts, pos, state, param));
            }
          }
          break;
        case '<\/':
          if (m = /^([-\w:]+)[^\'\"]*/.exec(next)) {
            if (m[0].length === next.length && parts[pos + 1] === '>') {
              // fast case, no attribute parsing needed
              pos += 2;
              tagName = m[1].toLowerCase();
              if (h.endTag) {
                h.endTag(tagName, param, continuationMarker,
                  continuationMaker(h, parts, pos, state, param));
              }
            } else {
              // slow case, need to parse attributes
              // TODO(felix8a): do we really care about misparsing this?
              pos = parseEndTag(
                parts, pos, h, param, continuationMarker, state);
            }
          } else {
            if (h.pcdata) {
              h.pcdata('&lt;/', param, continuationMarker,
                continuationMaker(h, parts, pos, state, param));
            }
          }
          break;
        case '<':
          if (m = /^([-\w:]+)\s*\/?/.exec(next)) {
            if (m[0].length === next.length && parts[pos + 1] === '>') {
              // fast case, no attribute parsing needed
              pos += 2;
              tagName = m[1].toLowerCase();
              if (h.startTag) {
                h.startTag(tagName, [], param, continuationMarker,
                  continuationMaker(h, parts, pos, state, param));
              }
              // tags like <script> and <textarea> have special parsing
              var eflags = html4.ELEMENTS[tagName];
              if (eflags & EFLAGS_TEXT) {
                var tag = { name: tagName, next: pos, eflags: eflags };
                pos = parseText(
                  parts, tag, h, param, continuationMarker, state);
              }
            } else {
              // slow case, need to parse attributes
              pos = parseStartTag(
                parts, pos, h, param, continuationMarker, state);
            }
          } else {
            if (h.pcdata) {
              h.pcdata('&lt;', param, continuationMarker,
                continuationMaker(h, parts, pos, state, param));
            }
          }
          break;
        case '<\!--':
          // The pathological case is n copies of '<\!--' without '-->', and
          // repeated failure to find '-->' is quadratic.  We avoid that by
          // remembering when search for '-->' fails.
          if (!state.noMoreEndComments) {
            // A comment <\!--x--> is split into three tokens:
            //   '<\!--', 'x--', '>'
            // We want to find the next '>' token that has a preceding '--'.
            // pos is at the 'x--'.
            for (p = pos + 1; p < end; p++) {
              if (parts[p] === '>' && /--$/.test(parts[p - 1])) { break; }
            }
            if (p < end) {
              if (h.comment) {
                var comment = parts.slice(pos, p).join('');
                h.comment(
                  comment.substr(0, comment.length - 2), param,
                  continuationMarker,
                  continuationMaker(h, parts, p + 1, state, param));
              }
              pos = p + 1;
            } else {
              state.noMoreEndComments = true;
            }
          }
          if (state.noMoreEndComments) {
            if (h.pcdata) {
              h.pcdata('&lt;!--', param, continuationMarker,
                continuationMaker(h, parts, pos, state, param));
            }
          }
          break;
        case '<\!':
          if (!/^\w/.test(next)) {
            if (h.pcdata) {
              h.pcdata('&lt;!', param, continuationMarker,
                continuationMaker(h, parts, pos, state, param));
            }
          } else {
            // similar to noMoreEndComment logic
            if (!state.noMoreGT) {
              for (p = pos + 1; p < end; p++) {
                if (parts[p] === '>') { break; }
              }
              if (p < end) {
                pos = p + 1;
              } else {
                state.noMoreGT = true;
              }
            }
            if (state.noMoreGT) {
              if (h.pcdata) {
                h.pcdata('&lt;!', param, continuationMarker,
                  continuationMaker(h, parts, pos, state, param));
              }
            }
          }
          break;
        case '<?':
          // similar to noMoreEndComment logic
          if (!state.noMoreGT) {
            for (p = pos + 1; p < end; p++) {
              if (parts[p] === '>') { break; }
            }
            if (p < end) {
              pos = p + 1;
            } else {
              state.noMoreGT = true;
            }
          }
          if (state.noMoreGT) {
            if (h.pcdata) {
              h.pcdata('&lt;?', param, continuationMarker,
                continuationMaker(h, parts, pos, state, param));
            }
          }
          break;
        case '>':
          if (h.pcdata) {
            h.pcdata("&gt;", param, continuationMarker,
              continuationMaker(h, parts, pos, state, param));
          }
          break;
        case '':
          break;
        default:
          if (h.pcdata) {
            h.pcdata(current, param, continuationMarker,
              continuationMaker(h, parts, pos, state, param));
          }
          break;
        }
      }
      if (h.endDoc) { h.endDoc(param); }
    } catch (e) {
      if (e !== continuationMarker) { throw e; }
    }
  }

  // Split str into parts for the html parser.
  function htmlSplit(str) {
    // can't hoist this out of the function because of the re.exec loop.
    var re = /(<\/|<\!--|<[!?]|[&<>])/g;
    str += '';
    if (splitWillCapture) {
      return str.split(re);
    } else {
      var parts = [];
      var lastPos = 0;
      var m;
      while ((m = re.exec(str)) !== null) {
        parts.push(str.substring(lastPos, m.index));
        parts.push(m[0]);
        lastPos = m.index + m[0].length;
      }
      parts.push(str.substring(lastPos));
      return parts;
    }
  }

  function parseEndTag(parts, pos, h, param, continuationMarker, state) {
    var tag = parseTagAndAttrs(parts, pos);
    // drop unclosed tags
    if (!tag) { return parts.length; }
    if (h.endTag) {
      h.endTag(tag.name, param, continuationMarker,
        continuationMaker(h, parts, pos, state, param));
    }
    return tag.next;
  }

  function parseStartTag(parts, pos, h, param, continuationMarker, state) {
    var tag = parseTagAndAttrs(parts, pos);
    // drop unclosed tags
    if (!tag) { return parts.length; }
    if (h.startTag) {
      h.startTag(tag.name, tag.attrs, param, continuationMarker,
        continuationMaker(h, parts, tag.next, state, param));
    }
    // tags like <script> and <textarea> have special parsing
    if (tag.eflags & EFLAGS_TEXT) {
      return parseText(parts, tag, h, param, continuationMarker, state);
    } else {
      return tag.next;
    }
  }

  var endTagRe = {};

  // Tags like <script> and <textarea> are flagged as CDATA or RCDATA,
  // which means everything is text until we see the correct closing tag.
  function parseText(parts, tag, h, param, continuationMarker, state) {
    var end = parts.length;
    if (!endTagRe.hasOwnProperty(tag.name)) {
      endTagRe[tag.name] = new RegExp('^' + tag.name + '(?:[\\s\\/]|$)', 'i');
    }
    var re = endTagRe[tag.name];
    var first = tag.next;
    var p = tag.next + 1;
    for (; p < end; p++) {
      if (parts[p - 1] === '<\/' && re.test(parts[p])) { break; }
    }
    if (p < end) { p -= 1; }
    var buf = parts.slice(first, p).join('');
    if (tag.eflags & html4.eflags['CDATA']) {
      if (h.cdata) {
        h.cdata(buf, param, continuationMarker,
          continuationMaker(h, parts, p, state, param));
      }
    } else if (tag.eflags & html4.eflags['RCDATA']) {
      if (h.rcdata) {
        h.rcdata(normalizeRCData(buf), param, continuationMarker,
          continuationMaker(h, parts, p, state, param));
      }
    } else {
      throw new Error('bug');
    }
    return p;
  }

  // at this point, parts[pos-1] is either "<" or "<\/".
  function parseTagAndAttrs(parts, pos) {
    var m = /^([-\w:]+)/.exec(parts[pos]);
    var tag = {};
    tag.name = m[1].toLowerCase();
    tag.eflags = html4.ELEMENTS[tag.name];
    var buf = parts[pos].substr(m[0].length);
    // Find the next '>'.  We optimistically assume this '>' is not in a
    // quoted context, and further down we fix things up if it turns out to
    // be quoted.
    var p = pos + 1;
    var end = parts.length;
    for (; p < end; p++) {
      if (parts[p] === '>') { break; }
      buf += parts[p];
    }
    if (end <= p) { return void 0; }
    var attrs = [];
    while (buf !== '') {
      m = ATTR_RE.exec(buf);
      if (!m) {
        // No attribute found: skip garbage
        buf = buf.replace(/^[\s\S][^a-z\s]*/, '');

      } else if ((m[4] && !m[5]) || (m[6] && !m[7])) {
        // Unterminated quote: slurp to the next unquoted '>'
        var quote = m[4] || m[6];
        var sawQuote = false;
        var abuf = [buf, parts[p++]];
        for (; p < end; p++) {
          if (sawQuote) {
            if (parts[p] === '>') { break; }
          } else if (0 <= parts[p].indexOf(quote)) {
            sawQuote = true;
          }
          abuf.push(parts[p]);
        }
        // Slurp failed: lose the garbage
        if (end <= p) { break; }
        // Otherwise retry attribute parsing
        buf = abuf.join('');
        continue;

      } else {
        // We have an attribute
        var aName = m[1].toLowerCase();
        var aValue = m[2] ? decodeValue(m[3]) : '';
        attrs.push(aName, aValue);
        buf = buf.substr(m[0].length);
      }
    }
    tag.attrs = attrs;
    tag.next = p + 1;
    return tag;
  }

  function decodeValue(v) {
    var q = v.charCodeAt(0);
    if (q === 0x22 || q === 0x27) { // " or '
      v = v.substr(1, v.length - 2);
    }
    return unescapeEntities(stripNULs(v));
  }

  /**
   * Returns a function that strips unsafe tags and attributes from html.
   * @param {function(string, Array.<string>): ?Array.<string>} tagPolicy
   *     A function that takes (tagName, attribs[]), where tagName is a key in
   *     html4.ELEMENTS and attribs is an array of alternating attribute names
   *     and values.  It should return a record (as follows), or null to delete
   *     the element.  It's okay for tagPolicy to modify the attribs array,
   *     but the same array is reused, so it should not be held between calls.
   *     Record keys:
   *        attribs: (required) Sanitized attributes array.
   *        tagName: Replacement tag name.
   * @return {function(string, Array)} A function that sanitizes a string of
   *     HTML and appends result strings to the second argument, an array.
   */
  function makeHtmlSanitizer(tagPolicy) {
    var stack;
    var ignoring;
    var emit = function (text, out) {
      if (!ignoring) { out.push(text); }
    };
    return makeSaxParser({
      'startDoc': function(_) {
        stack = [];
        ignoring = false;
      },
      'startTag': function(tagNameOrig, attribs, out) {
        if (ignoring) { return; }
        if (!html4.ELEMENTS.hasOwnProperty(tagNameOrig)) { return; }
        var eflagsOrig = html4.ELEMENTS[tagNameOrig];
        if (eflagsOrig & html4.eflags['FOLDABLE']) {
          return;
        }

        var decision = tagPolicy(tagNameOrig, attribs);
        if (!decision) {
          ignoring = !(eflagsOrig & html4.eflags['EMPTY']);
          return;
        } else if (typeof decision !== 'object') {
          throw new Error('tagPolicy did not return object (old API?)');
        }
        if ('attribs' in decision) {
          attribs = decision['attribs'];
        } else {
          throw new Error('tagPolicy gave no attribs');
        }
        var eflagsRep;
        var tagNameRep;
        if ('tagName' in decision) {
          tagNameRep = decision['tagName'];
          eflagsRep = html4.ELEMENTS[tagNameRep];
        } else {
          tagNameRep = tagNameOrig;
          eflagsRep = eflagsOrig;
        }
        // TODO(mikesamuel): relying on tagPolicy not to insert unsafe
        // attribute names.

        // If this is an optional-end-tag element and either this element or its
        // previous like sibling was rewritten, then insert a close tag to
        // preserve structure.
        if (eflagsOrig & html4.eflags['OPTIONAL_ENDTAG']) {
          var onStack = stack[stack.length - 1];
          if (onStack && onStack.orig === tagNameOrig &&
              (onStack.rep !== tagNameRep || tagNameOrig !== tagNameRep)) {
                out.push('<\/', onStack.rep, '>');
          }
        }

        if (!(eflagsOrig & html4.eflags['EMPTY'])) {
          stack.push({orig: tagNameOrig, rep: tagNameRep});
        }

        out.push('<', tagNameRep);
        for (var i = 0, n = attribs.length; i < n; i += 2) {
          var attribName = attribs[i],
              value = attribs[i + 1];
          if (value !== null && value !== void 0) {
            out.push(' ', attribName, '="', escapeAttrib(value), '"');
          }
        }
        out.push('>');

        if ((eflagsOrig & html4.eflags['EMPTY'])
            && !(eflagsRep & html4.eflags['EMPTY'])) {
          // replacement is non-empty, synthesize end tag
          out.push('<\/', tagNameRep, '>');
        }
      },
      'endTag': function(tagName, out) {
        if (ignoring) {
          ignoring = false;
          return;
        }
        if (!html4.ELEMENTS.hasOwnProperty(tagName)) { return; }
        var eflags = html4.ELEMENTS[tagName];
        if (!(eflags & (html4.eflags['EMPTY'] | html4.eflags['FOLDABLE']))) {
          var index;
          if (eflags & html4.eflags['OPTIONAL_ENDTAG']) {
            for (index = stack.length; --index >= 0;) {
              var stackElOrigTag = stack[index].orig;
              if (stackElOrigTag === tagName) { break; }
              if (!(html4.ELEMENTS[stackElOrigTag] &
                    html4.eflags['OPTIONAL_ENDTAG'])) {
                // Don't pop non optional end tags looking for a match.
                return;
              }
            }
          } else {
            for (index = stack.length; --index >= 0;) {
              if (stack[index].orig === tagName) { break; }
            }
          }
          if (index < 0) { return; }  // Not opened.
          for (var i = stack.length; --i > index;) {
            var stackElRepTag = stack[i].rep;
            if (!(html4.ELEMENTS[stackElRepTag] &
                  html4.eflags['OPTIONAL_ENDTAG'])) {
              out.push('<\/', stackElRepTag, '>');
            }
          }
          if (index < stack.length) {
            tagName = stack[index].rep;
          }
          stack.length = index;
          out.push('<\/', tagName, '>');
        }
      },
      'pcdata': emit,
      'rcdata': emit,
      'cdata': emit,
      'endDoc': function(out) {
        for (; stack.length; stack.length--) {
          out.push('<\/', stack[stack.length - 1].rep, '>');
        }
      }
    });
  }

  var ALLOWED_URI_SCHEMES = /^(?:https?|mailto|data)$/i;

  function safeUri(uri, effect, ltype, hints, naiveUriRewriter) {
    if (!naiveUriRewriter) { return null; }
    try {
      var parsed = URI.parse('' + uri);
      if (parsed) {
        if (!parsed.hasScheme() ||
            ALLOWED_URI_SCHEMES.test(parsed.getScheme())) {
          var safe = naiveUriRewriter(parsed, effect, ltype, hints);
          return safe ? safe.toString() : null;
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  function log(logger, tagName, attribName, oldValue, newValue) {
    if (!attribName) {
      logger(tagName + " removed", {
        change: "removed",
        tagName: tagName
      });
    }
    if (oldValue !== newValue) {
      var changed = "changed";
      if (oldValue && !newValue) {
        changed = "removed";
      } else if (!oldValue && newValue)  {
        changed = "added";
      }
      logger(tagName + "." + attribName + " " + changed, {
        change: changed,
        tagName: tagName,
        attribName: attribName,
        oldValue: oldValue,
        newValue: newValue
      });
    }
  }

  function lookupAttribute(map, tagName, attribName) {
    var attribKey;
    attribKey = tagName + '::' + attribName;
    if (map.hasOwnProperty(attribKey)) {
      return map[attribKey];
    }
    attribKey = '*::' + attribName;
    if (map.hasOwnProperty(attribKey)) {
      return map[attribKey];
    }
    return void 0;
  }
  function getAttributeType(tagName, attribName) {
    return lookupAttribute(html4.ATTRIBS, tagName, attribName);
  }
  function getLoaderType(tagName, attribName) {
    return lookupAttribute(html4.LOADERTYPES, tagName, attribName);
  }
  function getUriEffect(tagName, attribName) {
    return lookupAttribute(html4.URIEFFECTS, tagName, attribName);
  }

  /**
   * Sanitizes attributes on an HTML tag.
   * @param {string} tagName An HTML tag name in lowercase.
   * @param {Array.<?string>} attribs An array of alternating names and values.
   * @param {?function(?string): ?string} opt_naiveUriRewriter A transform to
   *     apply to URI attributes; it can return a new string value, or null to
   *     delete the attribute.  If unspecified, URI attributes are deleted.
   * @param {function(?string): ?string} opt_nmTokenPolicy A transform to apply
   *     to attributes containing HTML names, element IDs, and space-separated
   *     lists of classes; it can return a new string value, or null to delete
   *     the attribute.  If unspecified, these attributes are kept unchanged.
   * @return {Array.<?string>} The sanitized attributes as a list of alternating
   *     names and values, where a null value means to omit the attribute.
   */
  function sanitizeAttribs(tagName, attribs,
    opt_naiveUriRewriter, opt_nmTokenPolicy, opt_logger) {
    // TODO(felix8a): it's obnoxious that domado duplicates much of this
    // TODO(felix8a): maybe consistently enforce constraints like target=
    for (var i = 0; i < attribs.length; i += 2) {
      var attribName = attribs[i];
      var value = attribs[i + 1];
      var oldValue = value;
      var atype = null, attribKey;
      if ((attribKey = tagName + '::' + attribName,
           html4.ATTRIBS.hasOwnProperty(attribKey)) ||
          (attribKey = '*::' + attribName,
           html4.ATTRIBS.hasOwnProperty(attribKey))) {
        atype = html4.ATTRIBS[attribKey];
      }
      if (atype !== null) {
        switch (atype) {
          case html4.atype['NONE']: break;
          case html4.atype['SCRIPT']:
            value = null;
            if (opt_logger) {
              log(opt_logger, tagName, attribName, oldValue, value);
            }
            break;
          case html4.atype['STYLE']:
            if ('undefined' === typeof parseCssDeclarations) {
              value = null;
              if (opt_logger) {
                log(opt_logger, tagName, attribName, oldValue, value);
	      }
              break;
            }
            var sanitizedDeclarations = [];
            parseCssDeclarations(
                value,
                {
                  declaration: function (property, tokens) {
                    var normProp = property.toLowerCase();
                    var schema = cssSchema[normProp];
                    if (!schema) {
                      return;
                    }
                    sanitizeCssProperty(
                        normProp, schema, tokens,
                        opt_naiveUriRewriter
                        ? function (url) {
                            return safeUri(
                                url, html4.ueffects.SAME_DOCUMENT,
                                html4.ltypes.SANDBOXED,
                                {
                                  "TYPE": "CSS",
                                  "CSS_PROP": normProp
                                }, opt_naiveUriRewriter);
                          }
                        : null);
                    sanitizedDeclarations.push(property + ': ' + tokens.join(' '));
                  }
                });
            value = sanitizedDeclarations.length > 0 ?
              sanitizedDeclarations.join(' ; ') : null;
            if (opt_logger) {
              log(opt_logger, tagName, attribName, oldValue, value);
            }
            break;
          case html4.atype['ID']:
          case html4.atype['IDREF']:
          case html4.atype['IDREFS']:
          case html4.atype['GLOBAL_NAME']:
          case html4.atype['LOCAL_NAME']:
          case html4.atype['CLASSES']:
            value = opt_nmTokenPolicy ? opt_nmTokenPolicy(value) : value;
            if (opt_logger) {
              log(opt_logger, tagName, attribName, oldValue, value);
            }
            break;
          case html4.atype['URI']:
            value = safeUri(value,
              getUriEffect(tagName, attribName),
              getLoaderType(tagName, attribName),
              {
                "TYPE": "MARKUP",
                "XML_ATTR": attribName,
                "XML_TAG": tagName
              }, opt_naiveUriRewriter);
              if (opt_logger) {
              log(opt_logger, tagName, attribName, oldValue, value);
            }
            break;
          case html4.atype['URI_FRAGMENT']:
            if (value && '#' === value.charAt(0)) {
              value = value.substring(1);  // remove the leading '#'
              value = opt_nmTokenPolicy ? opt_nmTokenPolicy(value) : value;
              if (value !== null && value !== void 0) {
                value = '#' + value;  // restore the leading '#'
              }
            } else {
              value = null;
            }
            if (opt_logger) {
              log(opt_logger, tagName, attribName, oldValue, value);
            }
            break;
          default:
            value = null;
            if (opt_logger) {
              log(opt_logger, tagName, attribName, oldValue, value);
            }
            break;
        }
      } else {
        value = null;
        if (opt_logger) {
          log(opt_logger, tagName, attribName, oldValue, value);
        }
      }
      attribs[i + 1] = value;
    }
    return attribs;
  }

  /**
   * Creates a tag policy that omits all tags marked UNSAFE in html4-defs.js
   * and applies the default attribute sanitizer with the supplied policy for
   * URI attributes and NMTOKEN attributes.
   * @param {?function(?string): ?string} opt_naiveUriRewriter A transform to
   *     apply to URI attributes.  If not given, URI attributes are deleted.
   * @param {function(?string): ?string} opt_nmTokenPolicy A transform to apply
   *     to attributes containing HTML names, element IDs, and space-separated
   *     lists of classes.  If not given, such attributes are left unchanged.
   * @return {function(string, Array.<?string>)} A tagPolicy suitable for
   *     passing to html.sanitize.
   */
  function makeTagPolicy(
    opt_naiveUriRewriter, opt_nmTokenPolicy, opt_logger) {
    return function(tagName, attribs) {
      if (!(html4.ELEMENTS[tagName] & html4.eflags['UNSAFE'])) {
        return {
          'attribs': sanitizeAttribs(tagName, attribs,
            opt_naiveUriRewriter, opt_nmTokenPolicy, opt_logger)
        };
      } else {
        if (opt_logger) {
          log(opt_logger, tagName, undefined, undefined, undefined);
        }
      }
    };
  }

  /**
   * Sanitizes HTML tags and attributes according to a given policy.
   * @param {string} inputHtml The HTML to sanitize.
   * @param {function(string, Array.<?string>)} tagPolicy A function that
   *     decides which tags to accept and sanitizes their attributes (see
   *     makeHtmlSanitizer above for details).
   * @return {string} The sanitized HTML.
   */
  function sanitizeWithPolicy(inputHtml, tagPolicy) {
    var outputArray = [];
    makeHtmlSanitizer(tagPolicy)(inputHtml, outputArray);
    return outputArray.join('');
  }

  /**
   * Strips unsafe tags and attributes from HTML.
   * @param {string} inputHtml The HTML to sanitize.
   * @param {?function(?string): ?string} opt_naiveUriRewriter A transform to
   *     apply to URI attributes.  If not given, URI attributes are deleted.
   * @param {function(?string): ?string} opt_nmTokenPolicy A transform to apply
   *     to attributes containing HTML names, element IDs, and space-separated
   *     lists of classes.  If not given, such attributes are left unchanged.
   */
  function sanitize(inputHtml,
    opt_naiveUriRewriter, opt_nmTokenPolicy, opt_logger) {
    var tagPolicy = makeTagPolicy(
      opt_naiveUriRewriter, opt_nmTokenPolicy, opt_logger);
    return sanitizeWithPolicy(inputHtml, tagPolicy);
  }

  // Export both quoted and unquoted names for Closure linkage.
  var html = {};
  html.escapeAttrib = html['escapeAttrib'] = escapeAttrib;
  html.makeHtmlSanitizer = html['makeHtmlSanitizer'] = makeHtmlSanitizer;
  html.makeSaxParser = html['makeSaxParser'] = makeSaxParser;
  html.makeTagPolicy = html['makeTagPolicy'] = makeTagPolicy;
  html.normalizeRCData = html['normalizeRCData'] = normalizeRCData;
  html.sanitize = html['sanitize'] = sanitize;
  html.sanitizeAttribs = html['sanitizeAttribs'] = sanitizeAttribs;
  html.sanitizeWithPolicy = html['sanitizeWithPolicy'] = sanitizeWithPolicy;
  html.unescapeEntities = html['unescapeEntities'] = unescapeEntities;
  return html;
})(html4);

var html_sanitize = html['sanitize'];

// Loosen restrictions of Caja's
// html-sanitizer to allow for styling
html4.ATTRIBS['*::style'] = 0;
html4.ELEMENTS['style'] = 0;
html4.ATTRIBS['a::target'] = 0;
html4.ELEMENTS['video'] = 0;
html4.ATTRIBS['video::src'] = 0;
html4.ATTRIBS['video::poster'] = 0;
html4.ATTRIBS['video::controls'] = 0;
html4.ELEMENTS['audio'] = 0;
html4.ATTRIBS['audio::src'] = 0;
html4.ATTRIBS['video::autoplay'] = 0;
html4.ATTRIBS['video::controls'] = 0;

if (typeof module !== 'undefined') {
    module.exports = html_sanitize;
}

},{}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
'use strict';

module.exports = {
    HTTP_URL: 'http://a.tiles.mapbox.com/v4',
    HTTPS_URL: 'https://a.tiles.mapbox.com/v4',
    FORCE_HTTPS: false,
    REQUIRE_ACCESS_TOKEN: true
};

},{}],8:[function(require,module,exports){
'use strict';

var util = require('./util'),
    format_url = require('./format_url'),
    request = require('./request'),
    marker = require('./marker'),
    simplestyle = require('./simplestyle');

// # featureLayer
//
// A layer of features, loaded from Mapbox or else. Adds the ability
// to reset features, filter them, and load them from a GeoJSON URL.
var FeatureLayer = L.FeatureGroup.extend({
    options: {
        filter: function() { return true; },
        sanitizer: require('sanitize-caja'),
        style: simplestyle.style,
        popupOptions: { closeButton: false }
    },

    initialize: function(_, options) {
        L.setOptions(this, options);

        this._layers = {};

        if (typeof _ === 'string') {
            util.idUrl(_, this);
        // javascript object of TileJSON data
        } else if (_ && typeof _ === 'object') {
            this.setGeoJSON(_);
        }
    },

    setGeoJSON: function(_) {
        this._geojson = _;
        this.clearLayers();
        this._initialize(_);
        return this;
    },

    getGeoJSON: function() {
        return this._geojson;
    },

    loadURL: function(url) {
        if (this._request && 'abort' in this._request) this._request.abort();
        this._request = request(url, L.bind(function(err, json) {
            this._request = null;
            if (err && err.type !== 'abort') {
                util.log('could not load features at ' + url);
                this.fire('error', {error: err});
            } else if (json) {
                this.setGeoJSON(json);
                this.fire('ready');
            }
        }, this));
        return this;
    },

    loadID: function(id) {
        return this.loadURL(format_url('/v4/' + id + '/features.json', this.options.accessToken));
    },

    setFilter: function(_) {
        this.options.filter = _;
        if (this._geojson) {
            this.clearLayers();
            this._initialize(this._geojson);
        }
        return this;
    },

    getFilter: function() {
        return this.options.filter;
    },

    _initialize: function(json) {
        var features = L.Util.isArray(json) ? json : json.features,
            i, len;

        if (features) {
            for (i = 0, len = features.length; i < len; i++) {
                // Only add this if geometry or geometries are set and not null
                if (features[i].geometries || features[i].geometry || features[i].features) {
                    this._initialize(features[i]);
                }
            }
        } else if (this.options.filter(json)) {

            var opts = {accessToken: this.options.accessToken},
                pointToLayer = this.options.pointToLayer || function(feature, latlon) {
                  return marker.style(feature, latlon, opts);
                },
                layer = L.GeoJSON.geometryToLayer(json, {
                    pointToLayer: pointToLayer
                }),
                popupHtml = marker.createPopup(json, this.options.sanitizer),
                style = this.options.style,
                defaultStyle = style === simplestyle.style;

            if (style && 'setStyle' in layer &&
                // if the style method is the simplestyle default, then
                // never style L.Circle or L.CircleMarker because
                // simplestyle has no rules over them, only over geometry
                // primitives directly from GeoJSON
                (!(defaultStyle && (layer instanceof L.Circle ||
                  layer instanceof L.CircleMarker)))) {
                if (typeof style === 'function') {
                    style = style(json);
                }
                layer.setStyle(style);
            }

            layer.feature = json;

            if (popupHtml) {
                layer.bindPopup(popupHtml, this.options.popupOptions);
            }

            this.addLayer(layer);
        }
    }
});

module.exports.FeatureLayer = FeatureLayer;

module.exports.featureLayer = function(_, options) {
    return new FeatureLayer(_, options);
};

},{"./format_url":10,"./marker":21,"./request":22,"./simplestyle":24,"./util":27,"sanitize-caja":4}],9:[function(require,module,exports){
'use strict';

var Feedback = L.Class.extend({
    includes: L.Mixin.Events,
    data: {},
    record: function(data) {
        L.extend(this.data, data);
        this.fire('change');
    }
});

module.exports = new Feedback();

},{}],10:[function(require,module,exports){
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

},{"../package.json":6,"./config":7}],11:[function(require,module,exports){
'use strict';

var isArray = require('isarray'),
    util = require('./util'),
    format_url = require('./format_url'),
    feedback = require('./feedback'),
    request = require('./request');

// Low-level geocoding interface - wraps specific API calls and their
// return values.
module.exports = function(url, options) {
    if (!options) options = {};
    var geocoder = {};

    util.strict(url, 'string');

    if (url.indexOf('/') === -1) {
        url = format_url('/geocoding/v5/' + url + '/{query}.json', options.accessToken, 5);
    }

    function roundTo(latLng, precision) {
        var mult = Math.pow(10, precision);
        latLng.lat = Math.round(latLng.lat * mult) / mult;
        latLng.lng = Math.round(latLng.lng * mult) / mult;
        return latLng;
    }

    geocoder.getURL = function() {
        return url;
    };

    geocoder.queryURL = function(_) {
        var isObject = !(isArray(_) || typeof _ === 'string'),
            query = isObject ? _.query : _;

        if (isArray(query)) {
            var parts = [];
            for (var i = 0; i < query.length; i++) {
                parts[i] = encodeURIComponent(query[i]);
            }
            query = parts.join(';');
        } else {
            query = encodeURIComponent(query);
        }

        feedback.record({ geocoding: query });

        var url = L.Util.template(geocoder.getURL(), {query: query});

        if (isObject) {
            if (_.types) {
                if (isArray(_.types)) {
                    url += '&types=' + _.types.join();
                } else {
                    url += '&types=' + _.types;
                }
            }

            if (_.country) {
                if (isArray(_.country)) {
                    url += '&country=' + _.country.join();
                } else {
                    url += '&country=' + _.country;
                }
            }

            if (_.bbox) {
                if (isArray(_.bbox)) {
                    url += '&bbox=' + _.bbox.join();
                } else {
                    url += '&bbox=' + _.bbox;
                }
            }

            if (_.proximity) {
                var proximity = roundTo(L.latLng(_.proximity), 3);
                url += '&proximity=' + proximity.lng + ',' + proximity.lat;
            }

            if (typeof _.autocomplete === 'boolean') {
                url += '&autocomplete=' + _.autocomplete;
            }
        }

        return url;
    };

    geocoder.query = function(_, callback) {
        util.strict(callback, 'function');

        request(geocoder.queryURL(_), function(err, json) {
            if (json && (json.length || json.features)) {
                var res = {
                    results: json
                };
                if (json.features && json.features.length) {
                    res.latlng = [
                        json.features[0].center[1],
                        json.features[0].center[0]];

                    if (json.features[0].bbox) {
                        res.bounds = json.features[0].bbox;
                        res.lbounds = util.lbounds(res.bounds);
                    }
                }
                callback(null, res);
            } else callback(err || true);
        });

        return geocoder;
    };

    // a reverse geocode:
    //
    //  geocoder.reverseQuery([80, 20])
    geocoder.reverseQuery = function(_, callback) {
        var q = '';

        // sort through different ways people represent lat and lon pairs
        function normalize(x) {
            var latLng;
            if (x.lat !== undefined && x.lng !== undefined) {
                latLng = L.latLng(x.lat, x.lng);
            } else if (x.lat !== undefined && x.lon !== undefined) {
                latLng = L.latLng(x.lat, x.lon);
            } else {
                latLng = L.latLng(x[1], x[0]);
            }
            latLng = roundTo(latLng, 5);
            return latLng.lng + ',' + latLng.lat;
        }

        if (_.length && _[0].length) {
            for (var i = 0, pts = []; i < _.length; i++) {
                pts.push(normalize(_[i]));
            }
            q = pts.join(';');
        } else {
            q = normalize(_);
        }

        request(geocoder.queryURL(q), function(err, json) {
            callback(err, json);
        });

        return geocoder;
    };

    return geocoder;
};

},{"./feedback":9,"./format_url":10,"./request":22,"./util":27,"isarray":2}],12:[function(require,module,exports){
'use strict';

var geocoder = require('./geocoder'),
    util = require('./util');

var GeocoderControl = L.Control.extend({
    includes: L.Mixin.Events,

    options: {
        proximity: true,
        position: 'topleft',
        pointZoom: 16,
        keepOpen: false,
        autocomplete: false,
        queryOptions: {}
    },

    initialize: function(_, options) {
        L.Util.setOptions(this, options);
        this.setURL(_);
        this._updateSubmit = L.bind(this._updateSubmit, this);
        this._updateAutocomplete = L.bind(this._updateAutocomplete, this);
        this._chooseResult = L.bind(this._chooseResult, this);
    },

    setURL: function(_) {
        this.geocoder = geocoder(_, {
            accessToken: this.options.accessToken
        });
        return this;
    },

    getURL: function() {
        return this.geocoder.getURL();
    },

    setID: function(_) {
        return this.setURL(_);
    },

    setTileJSON: function(_) {
        return this.setURL(_.geocoder);
    },

    _toggle: function(e) {
        if (e) L.DomEvent.stop(e);
        if (L.DomUtil.hasClass(this._container, 'active')) {
            L.DomUtil.removeClass(this._container, 'active');
            this._results.innerHTML = '';
            this._input.blur();
        } else {
            L.DomUtil.addClass(this._container, 'active');
            this._input.focus();
            this._input.select();
        }
    },

    _closeIfOpen: function() {
        if (L.DomUtil.hasClass(this._container, 'active') &&
            !this.options.keepOpen) {
            L.DomUtil.removeClass(this._container, 'active');
            this._results.innerHTML = '';
            this._input.blur();
        }
    },

    onAdd: function(map) {

        var container = L.DomUtil.create('div', 'leaflet-control-mapbox-geocoder leaflet-bar leaflet-control'),
            link = L.DomUtil.create('a', 'leaflet-control-mapbox-geocoder-toggle mapbox-icon mapbox-icon-geocoder', container),
            results = L.DomUtil.create('div', 'leaflet-control-mapbox-geocoder-results', container),
            wrap = L.DomUtil.create('div', 'leaflet-control-mapbox-geocoder-wrap', container),
            form = L.DomUtil.create('form', 'leaflet-control-mapbox-geocoder-form', wrap),
            input = L.DomUtil.create('input', '', form);

        link.href = '#';
        link.innerHTML = '&nbsp;';

        input.type = 'text';
        input.setAttribute('placeholder', 'Search');

        L.DomEvent.addListener(form, 'submit', this._geocode, this);
        L.DomEvent.addListener(input, 'keyup', this._autocomplete, this);
        L.DomEvent.disableClickPropagation(container);

        this._map = map;
        this._results = results;
        this._input = input;
        this._form = form;

        if (this.options.keepOpen) {
            L.DomUtil.addClass(container, 'active');
        } else {
            this._map.on('click', this._closeIfOpen, this);
            L.DomEvent.addListener(link, 'click', this._toggle, this);
        }

        return container;
    },

    _updateSubmit: function(err, resp) {
        L.DomUtil.removeClass(this._container, 'searching');
        this._results.innerHTML = '';
        if (err || !resp) {
            this.fire('error', {error: err});
        } else {
            var features = [];
            if (resp.results && resp.results.features) {
                features = resp.results.features;
            }
            if (features.length === 1) {
                this.fire('autoselect', { feature: features[0] });
                this.fire('found', {results: resp.results});
                this._chooseResult(features[0]);
                this._closeIfOpen();
            } else if (features.length > 1) {
                this.fire('found', {results: resp.results});
                this._displayResults(features);
            } else {
                this.fire('notfound');
                this._displayResults(features);
            }
        }
    },

    _updateAutocomplete: function(err, resp) {
        this._results.innerHTML = '';
        if (err || !resp) {
            this.fire('error', {error: err});
        } else {
            var features = [];
            if (resp.results && resp.results.features) {
                features = resp.results.features;
            }
            if (features.length) {
                this.fire('found', {results: resp.results});
            } else {
                this.fire('notfound');
            }
            this._displayResults(features);
        }
    },

    _displayResults: function(features) {
        for (var i = 0, l = Math.min(features.length, 5); i < l; i++) {
            var feature = features[i];
            var name = feature.place_name;
            if (!name.length) continue;

            var r = L.DomUtil.create('a', '', this._results);
            var text = ('innerText' in r) ? 'innerText' : 'textContent';
            r[text] = name;
            r.setAttribute('title', name);
            r.href = '#';

            (L.bind(function(feature) {
                L.DomEvent.addListener(r, 'click', function(e) {
                    this._chooseResult(feature);
                    L.DomEvent.stop(e);
                    this.fire('select', { feature: feature });
                }, this);
            }, this))(feature);
        }
        if (features.length > 5) {
            var outof = L.DomUtil.create('span', '', this._results);
            outof.innerHTML = 'Top 5 of ' + features.length + '  results';
        }
    },

    _chooseResult: function(result) {
        if (result.bbox) {
            this._map.fitBounds(util.lbounds(result.bbox));
        } else if (result.center) {
            this._map.setView([result.center[1], result.center[0]], (this._map.getZoom() === undefined) ?
                this.options.pointZoom :
                Math.max(this._map.getZoom(), this.options.pointZoom));
        }
    },

    _geocode: function(e) {
        L.DomEvent.preventDefault(e);
        if (this._input.value === '') return this._updateSubmit();
        L.DomUtil.addClass(this._container, 'searching');
        this.geocoder.query(L.Util.extend({
            query: this._input.value,
            proximity: this.options.proximity ? this._map.getCenter() : false
        }, this.options.queryOptions), this._updateSubmit);
    },

    _autocomplete: function() {
        if (!this.options.autocomplete) return;
        if (this._input.value === '') return this._updateAutocomplete();
        this.geocoder.query(L.Util.extend({
            query: this._input.value,
            proximity: this.options.proximity ? this._map.getCenter() : false
        }, this.options.queryOptions), this._updateAutocomplete);
    }
});

module.exports.GeocoderControl = GeocoderControl;

module.exports.geocoderControl = function(_, options) {
    return new GeocoderControl(_, options);
};

},{"./geocoder":11,"./util":27}],13:[function(require,module,exports){
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

},{}],14:[function(require,module,exports){
'use strict';

var util = require('./util'),
    Mustache = require('mustache');

var GridControl = L.Control.extend({

    options: {
        pinnable: true,
        follow: false,
        sanitizer: require('sanitize-caja'),
        touchTeaser: true,
        location: true
    },

    _currentContent: '',

    // pinned means that this control is on a feature and the user has likely
    // clicked. pinned will not become false unless the user clicks off
    // of the feature onto another or clicks x
    _pinned: false,

    initialize: function(_, options) {
        L.Util.setOptions(this, options);
        util.strict_instance(_, L.Class, 'L.mapbox.gridLayer');
        this._layer = _;
    },

    setTemplate: function(template) {
        util.strict(template, 'string');
        this.options.template = template;
        return this;
    },

    _template: function(format, data) {
        if (!data) return;
        var template = this.options.template || this._layer.getTileJSON().template;
        if (template) {
            var d = {};
            d['__' + format + '__'] = true;
            return this.options.sanitizer(
                Mustache.to_html(template, L.extend(d, data)));
        }
    },

    // change the content of the tooltip HTML if it has changed, otherwise
    // noop
    _show: function(content, o) {
        if (content === this._currentContent) return;

        this._currentContent = content;

        if (this.options.follow) {
            this._popup.setContent(content)
                .setLatLng(o.latLng);
            if (this._map._popup !== this._popup) this._popup.openOn(this._map);
        } else {
            this._container.style.display = 'block';
            this._contentWrapper.innerHTML = content;
        }
    },

    hide: function() {
        this._pinned = false;
        this._currentContent = '';

        this._map.closePopup();
        this._container.style.display = 'none';
        this._contentWrapper.innerHTML = '';

        L.DomUtil.removeClass(this._container, 'closable');

        return this;
    },

    _mouseover: function(o) {
        if (o.data) {
            L.DomUtil.addClass(this._map._container, 'map-clickable');
        } else {
            L.DomUtil.removeClass(this._map._container, 'map-clickable');
        }

        if (this._pinned) return;

        var content = this._template('teaser', o.data);
        if (content) {
            this._show(content, o);
        } else {
            this.hide();
        }
    },

    _mousemove: function(o) {
        if (this._pinned) return;
        if (!this.options.follow) return;

        this._popup.setLatLng(o.latLng);
    },

    _navigateTo: function(url) {
        window.top.location.href = url;
    },

    _click: function(o) {

        var location_formatted = this._template('location', o.data);
        if (this.options.location && location_formatted &&
            location_formatted.search(/^https?:/) === 0) {
            return this._navigateTo(this._template('location', o.data));
        }

        if (!this.options.pinnable) return;

        var content = this._template('full', o.data);

        if (!content && this.options.touchTeaser && L.Browser.touch) {
            content = this._template('teaser', o.data);
        }

        if (content) {
            L.DomUtil.addClass(this._container, 'closable');
            this._pinned = true;
            this._show(content, o);
        } else if (this._pinned) {
            L.DomUtil.removeClass(this._container, 'closable');
            this._pinned = false;
            this.hide();
        }
    },

    _onPopupClose: function() {
        this._currentContent = null;
        this._pinned = false;
    },

    _createClosebutton: function(container, fn) {
        var link = L.DomUtil.create('a', 'close', container);

        link.innerHTML = 'close';
        link.href = '#';
        link.title = 'close';

        L.DomEvent
            .on(link, 'click', L.DomEvent.stopPropagation)
            .on(link, 'mousedown', L.DomEvent.stopPropagation)
            .on(link, 'dblclick', L.DomEvent.stopPropagation)
            .on(link, 'click', L.DomEvent.preventDefault)
            .on(link, 'click', fn, this);

        return link;
    },

    onAdd: function(map) {
        this._map = map;

        var className = 'leaflet-control-grid map-tooltip',
            container = L.DomUtil.create('div', className),
            contentWrapper = L.DomUtil.create('div', 'map-tooltip-content');

        // hide the container element initially
        container.style.display = 'none';
        this._createClosebutton(container, this.hide);
        container.appendChild(contentWrapper);

        this._contentWrapper = contentWrapper;
        this._popup = new L.Popup({ autoPan: false, closeOnClick: false });

        map.on('popupclose', this._onPopupClose, this);

        L.DomEvent
            .disableClickPropagation(container)
            // allow people to scroll tooltips with mousewheel
            .addListener(container, 'mousewheel', L.DomEvent.stopPropagation);

        this._layer
            .on('mouseover', this._mouseover, this)
            .on('mousemove', this._mousemove, this)
            .on('click', this._click, this);

        return container;
    },

    onRemove: function (map) {

        map.off('popupclose', this._onPopupClose, this);

        this._layer
            .off('mouseover', this._mouseover, this)
            .off('mousemove', this._mousemove, this)
            .off('click', this._click, this);
    }
});

module.exports.GridControl = GridControl;

module.exports.gridControl = function(_, options) {
    return new GridControl(_, options);
};

},{"./util":27,"mustache":3,"sanitize-caja":4}],15:[function(require,module,exports){
'use strict';

var util = require('./util'),
    request = require('./request'),
    grid = require('./grid');

// forked from danzel/L.UTFGrid
var GridLayer = L.Layer.extend({
    includes: [require('./load_tilejson')],

    options: {
        template: function() { return ''; }
    },

    _mouseOn: null,
    _tilejson: {},
    _cache: {},

    initialize: function(_, options) {
        L.Util.setOptions(this, options);
        this._loadTileJSON(_);
    },

    _setTileJSON: function(json) {
        util.strict(json, 'object');

        L.extend(this.options, {
            grids: json.grids,
            minZoom: json.minzoom,
            maxZoom: json.maxzoom,
            bounds: json.bounds && util.lbounds(json.bounds)
        });

        this._tilejson = json;
        this._cache = {};
        this._update();

        return this;
    },

    getTileJSON: function() {
        return this._tilejson;
    },

    active: function() {
        return !!(this._map && this.options.grids && this.options.grids.length);
    },

    onAdd: function(map) {
        this._map = map;
        this._update();

        this._map
            .on('click', this._click, this)
            .on('mousemove', this._move, this)
            .on('moveend', this._update, this);
    },

    onRemove: function() {
        this._map
            .off('click', this._click, this)
            .off('mousemove', this._move, this)
            .off('moveend', this._update, this);
    },

    getData: function(latlng, callback) {
        if (!this.active()) return;

        var map = this._map,
            point = map.project(latlng.wrap()),
            tileSize = 256,
            resolution = 4,
            x = Math.floor(point.x / tileSize),
            y = Math.floor(point.y / tileSize),
            max = map.options.crs.scale(map.getZoom()) / tileSize;

        x = (x + max) % max;
        y = (y + max) % max;

        this._getTile(map.getZoom(), x, y, function(grid) {
            var gridX = Math.floor((point.x - (x * tileSize)) / resolution),
                gridY = Math.floor((point.y - (y * tileSize)) / resolution);

            callback(grid(gridX, gridY));
        });

        return this;
    },

    _click: function(e) {
        this.getData(e.latlng, L.bind(function(data) {
            this.fire('click', {
                latLng: e.latlng,
                data: data
            });
        }, this));
    },

    _move: function(e) {
        this.getData(e.latlng, L.bind(function(data) {
            if (data !== this._mouseOn) {
                if (this._mouseOn) {
                    this.fire('mouseout', {
                        latLng: e.latlng,
                        data: this._mouseOn
                    });
                }

                this.fire('mouseover', {
                    latLng: e.latlng,
                    data: data
                });

                this._mouseOn = data;
            } else {
                this.fire('mousemove', {
                    latLng: e.latlng,
                    data: data
                });
            }
        }, this));
    },

    _getTileURL: function(tilePoint) {
        var urls = this.options.grids,
            index = (tilePoint.x + tilePoint.y) % urls.length,
            url = urls[index];

        return L.Util.template(url, tilePoint);
    },

    // Load up all required json grid files
    _update: function() {
        if (!this.active()) return;

        var bounds = this._map.getPixelBounds(),
            z = this._map.getZoom(),
            tileSize = 256;

        if (z > this.options.maxZoom || z < this.options.minZoom) return;

        var tileBounds = L.bounds(
                bounds.min.divideBy(tileSize)._floor(),
                bounds.max.divideBy(tileSize)._floor()),
            max = this._map.options.crs.scale(z) / tileSize;

        for (var x = tileBounds.min.x; x <= tileBounds.max.x; x++) {
            for (var y = tileBounds.min.y; y <= tileBounds.max.y; y++) {
                // x wrapped
                this._getTile(z, ((x % max) + max) % max, ((y % max) + max) % max);
            }
        }
    },

    _getTile: function(z, x, y, callback) {
        var key = z + '_' + x + '_' + y,
            tilePoint = L.point(x, y);

        tilePoint.z = z;

        if (!this._tileShouldBeLoaded(tilePoint)) {
            return;
        }

        if (key in this._cache) {
            if (!callback) return;

            if (typeof this._cache[key] === 'function') {
                callback(this._cache[key]); // Already loaded
            } else {
                this._cache[key].push(callback); // Pending
            }

            return;
        }

        this._cache[key] = [];

        if (callback) {
            this._cache[key].push(callback);
        }

        request(this._getTileURL(tilePoint), L.bind(function(err, json) {
            var callbacks = this._cache[key];
            this._cache[key] = grid(json);
            for (var i = 0; i < callbacks.length; ++i) {
                callbacks[i](this._cache[key]);
            }
        }, this));
    },

    _tileShouldBeLoaded: function(tilePoint) {
        if (tilePoint.z > this.options.maxZoom || tilePoint.z < this.options.minZoom) {
            return false;
        }

        if (this.options.bounds) {
            var tileSize = 256,
                nwPoint = tilePoint.multiplyBy(tileSize),
                sePoint = nwPoint.add(new L.Point(tileSize, tileSize)),
                nw = this._map.unproject(nwPoint),
                se = this._map.unproject(sePoint),
                bounds = new L.LatLngBounds([nw, se]);

            if (!this.options.bounds.intersects(bounds)) {
                return false;
            }
        }

        return true;
    }
});

module.exports.GridLayer = GridLayer;

module.exports.gridLayer = function(_, options) {
    return new GridLayer(_, options);
};

},{"./grid":13,"./load_tilejson":17,"./request":22,"./util":27}],16:[function(require,module,exports){
'use strict';

var LegendControl = L.Control.extend({

    options: {
        position: 'bottomright',
        sanitizer: require('sanitize-caja')
    },

    initialize: function(options) {
        L.setOptions(this, options);
        this._legends = {};
    },

    onAdd: function() {
        this._container = L.DomUtil.create('div', 'map-legends wax-legends');
        L.DomEvent.disableClickPropagation(this._container);

        this._update();

        return this._container;
    },

    addLegend: function(text) {
        if (!text) { return this; }

        if (!this._legends[text]) {
            this._legends[text] = 0;
        }

        this._legends[text]++;
        return this._update();
    },

    removeLegend: function(text) {
        if (!text) { return this; }
        if (this._legends[text]) this._legends[text]--;
        return this._update();
    },

    _update: function() {
        if (!this._map) { return this; }

        this._container.innerHTML = '';
        var hide = 'none';

        for (var i in this._legends) {
            if (this._legends.hasOwnProperty(i) && this._legends[i]) {
                var div = L.DomUtil.create('div', 'map-legend wax-legend', this._container);
                div.innerHTML = this.options.sanitizer(i);
                hide = 'block';
            }
        }

        // hide the control entirely unless there is at least one legend;
        // otherwise there will be a small grey blemish on the map.
        this._container.style.display = hide;

        return this;
    }
});

module.exports.LegendControl = LegendControl;

module.exports.legendControl = function(options) {
    return new LegendControl(options);
};

},{"sanitize-caja":4}],17:[function(require,module,exports){
'use strict';

var request = require('./request'),
    format_url = require('./format_url'),
    util = require('./util');

module.exports = {
    _loadTileJSON: function(_) {
        if (typeof _ === 'string') {
            _ = format_url.tileJSON(_, this.options && this.options.accessToken);
            request(_, L.bind(function(err, json) {
                if (err) {
                    util.log('could not load TileJSON at ' + _);
                    this.fire('error', {error: err});
                } else if (json) {
                    this._setTileJSON(json);
                    this.fire('ready');
                }
            }, this));
        } else if (_ && typeof _ === 'object') {
            this._setTileJSON(_);
        }
    }
};

},{"./format_url":10,"./request":22,"./util":27}],18:[function(require,module,exports){
'use strict';

var tileLayer = require('./tile_layer').tileLayer,
    featureLayer = require('./feature_layer').featureLayer,
    gridLayer = require('./grid_layer').gridLayer,
    gridControl = require('./grid_control').gridControl,
    shareControl = require('./share_control').shareControl,
    legendControl = require('./legend_control').legendControl,
    mapboxLogoControl = require('./mapbox_logo').mapboxLogoControl,
    feedback = require('./feedback');

function withAccessToken(options, accessToken) {
    if (!accessToken || options.accessToken)
        return options;
    return L.extend({accessToken: accessToken}, options);
}

var LMap = L.Map.extend({
    includes: [require('./load_tilejson')],

    options: {
        tileLayer: {},
        featureLayer: {},
        gridLayer: {},
        legendControl: {},
        gridControl: {},
        shareControl: false,
        sanitizer: require('sanitize-caja')
    },

    _tilejson: {},

    initialize: function(element, _, options) {

        L.Map.prototype.initialize.call(this, element,
            L.extend({}, L.Map.prototype.options, options));

        // Disable the default 'Leaflet' text
        if (this.attributionControl) {
            this.attributionControl.setPrefix('');

            var compact = this.options.attributionControl.compact;
            // Set a compact display if map container width is < 640 or
            // compact is set to `true` in attributionControl options.
            if (compact || (compact !== false && this._container.offsetWidth <= 640)) {
                L.DomUtil.addClass(this.attributionControl._container, 'leaflet-compact-attribution');
            }

            if (compact === undefined) {
                this.on('resize', function() {
                    if (this._container.offsetWidth > 640) {
                        L.DomUtil.removeClass(this.attributionControl._container, 'leaflet-compact-attribution');
                    } else {
                        L.DomUtil.addClass(this.attributionControl._container, 'leaflet-compact-attribution');
                    }
                });
            }
        }

        if (this.options.tileLayer) {
            this.tileLayer = tileLayer(undefined,
                withAccessToken(this.options.tileLayer, this.options.accessToken));
            this.addLayer(this.tileLayer);
        }

        if (this.options.featureLayer) {
            this.featureLayer = featureLayer(undefined,
                withAccessToken(this.options.featureLayer, this.options.accessToken));
            this.addLayer(this.featureLayer);
        }

        if (this.options.gridLayer) {
            this.gridLayer = gridLayer(undefined,
                withAccessToken(this.options.gridLayer, this.options.accessToken));
            this.addLayer(this.gridLayer);
        }

        if (this.options.gridLayer && this.options.gridControl) {
            this.gridControl = gridControl(this.gridLayer, this.options.gridControl);
            this.addControl(this.gridControl);
        }

        if (this.options.legendControl) {
            this.legendControl = legendControl(this.options.legendControl);
            this.addControl(this.legendControl);
        }

        if (this.options.shareControl) {
            this.shareControl = shareControl(undefined,
                withAccessToken(this.options.shareControl, this.options.accessToken));
            this.addControl(this.shareControl);
        }

        this._mapboxLogoControl = mapboxLogoControl(this.options.mapboxLogoControl);
        this.addControl(this._mapboxLogoControl);

        this._loadTileJSON(_);

        this.on('layeradd', this._onLayerAdd, this)
            .on('layerremove', this._onLayerRemove, this)
            .on('moveend', this._updateMapFeedbackLink, this);

        this.whenReady(function () {
            feedback.on('change', this._updateMapFeedbackLink, this);
        });

        this.on('unload', function () {
            feedback.off('change', this._updateMapFeedbackLink, this);
        });
    },

    // use a javascript object of tilejson data to configure this layer
    _setTileJSON: function(_) {
        this._tilejson = _;
        this._initialize(_);
        return this;
    },

    getTileJSON: function() {
        return this._tilejson;
    },

    _initialize: function(json) {
        if (this.tileLayer) {
            this.tileLayer._setTileJSON(json);
            this._updateLayer(this.tileLayer);
        }

        if (this.featureLayer && !this.featureLayer.getGeoJSON() && json.data && json.data[0]) {
            this.featureLayer.loadURL(json.data[0]);
        }

        if (this.gridLayer) {
            this.gridLayer._setTileJSON(json);
            this._updateLayer(this.gridLayer);
        }

        if (this.legendControl && json.legend) {
            this.legendControl.addLegend(json.legend);
        }

        if (this.shareControl) {
            this.shareControl._setTileJSON(json);
        }

        this._mapboxLogoControl._setTileJSON(json);

        if (!this._loaded && json.center) {
            var zoom = this.getZoom() !== undefined ? this.getZoom() : json.center[2],
                center = L.latLng(json.center[1], json.center[0]);

            this.setView(center, zoom);
        }
    },

    _updateMapFeedbackLink: function() {
        if (!this._controlContainer.getElementsByClassName) return;
        var link = this._controlContainer.getElementsByClassName('mapbox-improve-map');
        if (link.length && this._loaded) {
            var center = this.getCenter().wrap();
            var tilejson = this._tilejson || {};
            var id = tilejson.id || '';

            var hash = '#' + id + '/' +
                center.lng.toFixed(3) + '/' +
                center.lat.toFixed(3) + '/' +
                this.getZoom();

            for (var key in feedback.data) {
                hash += '/' + key + '=' + feedback.data[key];
            }

            for (var i = 0; i < link.length; i++) {
                link[i].hash = hash;
            }
        }
    },

    _onLayerAdd: function(e) {
        if ('on' in e.layer) {
            e.layer.on('ready', this._onLayerReady, this);
        }
        window.setTimeout(L.bind(this._updateMapFeedbackLink, this), 0); // Update after attribution control resets the HTML.
    },

    _onLayerRemove: function(e) {
        if ('on' in e.layer) {
            e.layer.off('ready', this._onLayerReady, this);
        }
        window.setTimeout(L.bind(this._updateMapFeedbackLink, this), 0); // Update after attribution control resets the HTML.
    },

    _onLayerReady: function(e) {
        this._updateLayer(e.target);
    },

    _updateLayer: function(layer) {
        if (!layer.options) return;

        if (this.attributionControl && this._loaded && layer.getAttribution) {
            this.attributionControl.addAttribution(layer.getAttribution());
        }

        if (!(L.stamp(layer) in this._zoomBoundLayers) &&
                (layer.options.maxZoom || layer.options.minZoom)) {
            this._zoomBoundLayers[L.stamp(layer)] = layer;
        }

        this._updateMapFeedbackLink();
        this._updateZoomLevels();
    }
});

module.exports.Map = LMap;

module.exports.map = function(element, _, options) {
    return new LMap(element, _, options);
};

},{"./feature_layer":8,"./feedback":9,"./grid_control":14,"./grid_layer":15,"./legend_control":16,"./load_tilejson":17,"./mapbox_logo":20,"./share_control":23,"./tile_layer":26,"sanitize-caja":4}],19:[function(require,module,exports){
'use strict';

var geocoderControl = require('./geocoder_control'),
    gridControl = require('./grid_control'),
    featureLayer = require('./feature_layer'),
    legendControl = require('./legend_control'),
    shareControl = require('./share_control'),
    tileLayer = require('./tile_layer'),
    map = require('./map'),
    gridLayer = require('./grid_layer'),
    styleLayer = require('./style_layer');

L.mapbox = module.exports = {
    VERSION: require('../package.json').version,
    geocoder: require('./geocoder'),
    marker: require('./marker'),
    simplestyle: require('./simplestyle'),
    tileLayer: tileLayer.tileLayer,
    TileLayer: tileLayer.TileLayer,
    styleLayer: styleLayer.styleLayer,
    StyleLayer: styleLayer.StyleLayer,
    shareControl: shareControl.shareControl,
    ShareControl: shareControl.ShareControl,
    legendControl: legendControl.legendControl,
    LegendControl: legendControl.LegendControl,
    geocoderControl: geocoderControl.geocoderControl,
    GeocoderControl: geocoderControl.GeocoderControl,
    gridControl: gridControl.gridControl,
    GridControl: gridControl.GridControl,
    gridLayer: gridLayer.gridLayer,
    GridLayer: gridLayer.GridLayer,
    featureLayer: featureLayer.featureLayer,
    FeatureLayer: featureLayer.FeatureLayer,
    map: map.map,
    Map: map.Map,
    config: require('./config'),
    sanitize: require('sanitize-caja'),
    template: require('mustache').to_html,
    feedback: require('./feedback')
};


// Hardcode image path, because Leaflet's autodetection
// fails, because mapbox.js is not named leaflet.js
window.L.Icon.Default.imagePath =
    // Detect bad-news protocols like file:// and hardcode
    // to https if they're detected.
    ((document.location.protocol === 'https:' ||
    document.location.protocol === 'http:') ? '' : 'https:') +
    '//api.tiles.mapbox.com/mapbox.js/' + 'v' +
    require('../package.json').version + '/images/';

},{"../package.json":6,"./config":7,"./feature_layer":8,"./feedback":9,"./geocoder":11,"./geocoder_control":12,"./grid_control":14,"./grid_layer":15,"./legend_control":16,"./map":18,"./marker":21,"./share_control":23,"./simplestyle":24,"./style_layer":25,"./tile_layer":26,"mustache":3,"sanitize-caja":4}],20:[function(require,module,exports){
'use strict';

var MapboxLogoControl = L.Control.extend({

    options: {
        position: 'bottomleft'
    },

    initialize: function(options) {
        L.setOptions(this, options);
    },

    onAdd: function() {
        this._container = L.DomUtil.create('div', 'mapbox-logo');
        return this._container;
    },

    _setTileJSON: function(json) {
        // Check if account referenced by the accessToken
        // is asscociated with the Mapbox Logo
        // as determined by mapbox-maps.
        if (json.mapbox_logo) {
            L.DomUtil.addClass(this._container, 'mapbox-logo-true');
        }
    }
});

module.exports.MapboxLogoControl = MapboxLogoControl;

module.exports.mapboxLogoControl = function(options) {
    return new MapboxLogoControl(options);
};

},{}],21:[function(require,module,exports){
'use strict';

var format_url = require('./format_url'),
    util = require('./util'),
    sanitize = require('sanitize-caja');

// mapbox-related markers functionality
// provide an icon from mapbox's simple-style spec and hosted markers
// service
function icon(fp, options) {
    fp = fp || {};

    var sizes = {
            small: [20, 50],
            medium: [30, 70],
            large: [35, 90]
        },
        size = fp['marker-size'] || 'medium',
        symbol = ('marker-symbol' in fp && fp['marker-symbol'] !== '') ? '-' + fp['marker-symbol'] : '',
        color = (fp['marker-color'] || '7e7e7e').replace('#', '');

    return L.icon({
        iconUrl: format_url('/v4/marker/' +
            'pin-' + size.charAt(0) + symbol + '+' + color +
            // detect and use retina markers, which are x2 resolution
            (L.Browser.retina ? '@2x' : '') + '.png', options && options.accessToken),
        iconSize: sizes[size],
        iconAnchor: [sizes[size][0] / 2, sizes[size][1] / 2],
        popupAnchor: [0, -sizes[size][1] / 2]
    });
}

// a factory that provides markers for Leaflet from Mapbox's
// [simple-style specification](https://github.com/mapbox/simplestyle-spec)
// and [Markers API](http://mapbox.com/developers/api/#markers).
function style(f, latlon, options) {
    return L.marker(latlon, {
        icon: icon(f.properties, options),
        title: util.strip_tags(
            sanitize((f.properties && f.properties.title) || ''))
    });
}

// Sanitize and format properties of a GeoJSON Feature object in order
// to form the HTML string used as the argument for `L.createPopup`
function createPopup(f, sanitizer) {
    if (!f || !f.properties) return '';
    var popup = '';

    if (f.properties.title) {
        popup += '<div class="marker-title">' + f.properties.title + '</div>';
    }

    if (f.properties.description) {
        popup += '<div class="marker-description">' + f.properties.description + '</div>';
    }

    return (sanitizer || sanitize)(popup);
}

module.exports = {
    icon: icon,
    style: style,
    createPopup: createPopup
};

},{"./format_url":10,"./util":27,"sanitize-caja":4}],22:[function(require,module,exports){
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

},{"./config":7,"./util":27,"corslite":1}],23:[function(require,module,exports){
'use strict';

var format_url = require('./format_url');

var ShareControl = L.Control.extend({
    includes: [require('./load_tilejson')],

    options: {
        position: 'topleft',
        url: ''
    },

    initialize: function(_, options) {
        L.setOptions(this, options);
        this._loadTileJSON(_);
    },

    _setTileJSON: function(json) {
        this._tilejson = json;
    },

    onAdd: function(map) {
        this._map = map;

        var container = L.DomUtil.create('div', 'leaflet-control-mapbox-share leaflet-bar');
        var link = L.DomUtil.create('a', 'mapbox-share mapbox-icon mapbox-icon-share', container);
        link.href = '#';

        this._modal = L.DomUtil.create('div', 'mapbox-modal', this._map._container);
        this._mask = L.DomUtil.create('div', 'mapbox-modal-mask', this._modal);
        this._content = L.DomUtil.create('div', 'mapbox-modal-content', this._modal);

        L.DomEvent.addListener(link, 'click', this._shareClick, this);
        L.DomEvent.disableClickPropagation(container);

        this._map.on('mousedown', this._clickOut, this);

        return container;
    },

    _clickOut: function(e) {
        if (this._sharing) {
            L.DomEvent.preventDefault(e);
            L.DomUtil.removeClass(this._modal, 'active');
            this._content.innerHTML = '';
            this._sharing = null;
            return;
        }
    },

    _shareClick: function(e) {
        L.DomEvent.stop(e);
        if (this._sharing) return this._clickOut(e);

        var tilejson = this._tilejson || this._map._tilejson || {},
            url = encodeURIComponent(this.options.url || tilejson.webpage || window.location),
            name = encodeURIComponent(tilejson.name),
            image = format_url('/v4/' + tilejson.id + '/' + this._map.getCenter().lng + ',' + this._map.getCenter().lat + ',' + this._map.getZoom() + '/600x600.png', this.options.accessToken),
            embed = format_url('/v4/' + tilejson.id + '.html', this.options.accessToken),
            twitterURL = '//twitter.com/intent/tweet?status=' + name + ' ' + url,
            facebookURL = '//www.facebook.com/sharer.php?u=' + url + '&t=' + name,
            pinterestURL = '//www.pinterest.com/pin/create/button/?url=' + url + '&media=' + image + '&description=' + name,
            embedValue = '<iframe width="100%" height="500px" frameBorder="0" src="' + embed + '"></iframe>',
            embedLabel = 'Copy and paste this <strong>HTML code</strong> into documents to embed this map on web pages.';

        function createShareButton(buttonClass, href, socialMediaName) {
            var elem = document.createElement('a');
            elem.setAttribute('class', buttonClass);
            elem.setAttribute('href', href);
            elem.setAttribute('target', '_blank');
            socialMediaName = document.createTextNode(socialMediaName);
            elem.appendChild(socialMediaName);

            return elem;
        }

        L.DomUtil.addClass(this._modal, 'active');

        this._sharing = L.DomUtil.create('div', 'mapbox-modal-body', this._content);

        var twitterButton = createShareButton('mapbox-button mapbox-button-icon mapbox-icon-twitter', twitterURL, 'Twitter');
        var facebookButton = createShareButton('mapbox-button mapbox-button-icon mapbox-icon-facebook', facebookURL, 'Facebook');
        var pinterestButton = createShareButton('mapbox-button mapbox-button-icon mapbox-icon-pinterest', pinterestURL, 'Pinterest');

        var shareHeader = document.createElement('h3');
        var shareText = document.createTextNode('Share this map');
        shareHeader.appendChild(shareText);

        var shareButtons = document.createElement('div');
        shareButtons.setAttribute('class', 'mapbox-share-buttons');
        shareButtons.appendChild(facebookButton);
        shareButtons.appendChild(twitterButton);
        shareButtons.appendChild(pinterestButton);

        this._sharing.appendChild(shareHeader);
        this._sharing.appendChild(shareButtons);

        var input = L.DomUtil.create('input', 'mapbox-embed', this._sharing);
        input.type = 'text';
        input.value = embedValue;

        var label = L.DomUtil.create('label', 'mapbox-embed-description', this._sharing);
        label.innerHTML = embedLabel;

        var close = L.DomUtil.create('a', 'leaflet-popup-close-button', this._sharing);
        close.href = '#';

        L.DomEvent.disableClickPropagation(this._sharing);
        L.DomEvent.addListener(close, 'click', this._clickOut, this);
        L.DomEvent.addListener(input, 'click', function(e) {
            e.target.focus();
            e.target.select();
        });
    }
});

module.exports.ShareControl = ShareControl;

module.exports.shareControl = function(_, options) {
    return new ShareControl(_, options);
};

},{"./format_url":10,"./load_tilejson":17}],24:[function(require,module,exports){
'use strict';

// an implementation of the simplestyle spec for polygon and linestring features
// https://github.com/mapbox/simplestyle-spec
var defaults = {
    stroke: '#555555',
    'stroke-width': 2,
    'stroke-opacity': 1,
    fill: '#555555',
    'fill-opacity': 0.5
};

var mapping = [
    ['stroke', 'color'],
    ['stroke-width', 'weight'],
    ['stroke-opacity', 'opacity'],
    ['fill', 'fillColor'],
    ['fill-opacity', 'fillOpacity']
];

function fallback(a, b) {
    var c = {};
    for (var k in b) {
        if (a[k] === undefined) c[k] = b[k];
        else c[k] = a[k];
    }
    return c;
}

function remap(a) {
    var d = {};
    for (var i = 0; i < mapping.length; i++) {
        d[mapping[i][1]] = a[mapping[i][0]];
    }
    return d;
}

function style(feature) {
    return remap(fallback(feature.properties || {}, defaults));
}

module.exports = {
    style: style,
    defaults: defaults
};

},{}],25:[function(require,module,exports){
'use strict';

var util = require('./util');
var format_url = require('./format_url');
var request = require('./request');

var StyleLayer = L.TileLayer.extend({

    options: {
        sanitizer: require('sanitize-caja')
    },

    initialize: function(_, options) {
        L.TileLayer.prototype.initialize.call(this, undefined, L.extend({}, options, {
            tileSize: 512,
            zoomOffset: -1,
            minNativeZoom: 0,
            tms: false
        }));
        this._url = this._formatTileURL(_);
        this._getAttribution(_);
    },

    _getAttribution: function(_) {
        var styleURL = format_url.style(_, this.options && this.options.accessToken);
        request(styleURL, L.bind(function(err, style) {
            if (err) {
                util.log('could not load Mapbox style at ' + styleURL);
                this.fire('error', {error: err});
            }
            var sources = [];
            for (var id in style.sources) {
                var source = style.sources[id].url.split('mapbox://')[1];
                sources.push(source);
            }
            request(format_url.tileJSON(sources.join(), this.options.accessToken), L.bind(function(err, json) {
                if (err) {
                    util.log('could not load TileJSON at ' + _);
                    this.fire('error', {error: err});
                } else if (json) {
                    util.strict(json, 'object');

                    this.options.attribution = this.options.sanitizer(json.attribution);

                    this._tilejson = json;
                    this.fire('ready');
                }
            }, this));
        }, this));
    },

    // disable the setUrl function, which is not available on mapbox tilelayers
    setUrl: null,

    _formatTileURL: function(style) {
        if (typeof style === 'string') {
            if (style.indexOf('mapbox://styles/') === -1) {
                util.log('Incorrectly formatted Mapbox style at ' + style);
                this.fire('error');
            }
            var ownerIDStyle = style.split('mapbox://styles/')[1];
            return format_url('/styles/v1/' + ownerIDStyle + '/tiles/{z}/{x}/{y}{r}', this.options.accessToken);
        } else if (typeof style === 'object') {
            return format_url('/styles/v1/' + style.owner + '/' + style.id + '/tiles/{z}/{x}/{y}{r}', this.options.accessToken);
        }
    }
});

module.exports.StyleLayer = StyleLayer;

module.exports.styleLayer = function(_, options) {
    return new StyleLayer(_, options);
};

},{"./format_url":10,"./request":22,"./util":27,"sanitize-caja":4}],26:[function(require,module,exports){
'use strict';

var util = require('./util');
var formatPattern = /\.((?:png|jpg)\d*)(?=$|\?)/;

var TileLayer = L.TileLayer.extend({
    includes: [require('./load_tilejson')],

    options: {
        sanitizer: require('sanitize-caja')
    },

    // http://mapbox.com/developers/api/#image_quality
    formats: [
        'png', 'jpg',
        // PNG
        'png32', 'png64', 'png128', 'png256',
        // JPG
        'jpg70', 'jpg80', 'jpg90'],

    scalePrefix: '@2x.',

    initialize: function(_, options) {
        L.TileLayer.prototype.initialize.call(this, undefined, options);

        this._tilejson = {};

        if (options && options.format) {
            util.strict_oneof(options.format, this.formats);
        }

        this._loadTileJSON(_);
    },

    setFormat: function(_) {
        util.strict(_, 'string');
        this.options.format = _;
        this.redraw();
        return this;
    },

    // disable the setUrl function, which is not available on mapbox tilelayers
    setUrl: null,

    _setTileJSON: function(json) {
        util.strict(json, 'object');

        if (!this.options.format) {
          var match = json.tiles[0].match(formatPattern);
          if (match) {
              this.options.format = match[1];
          }
        }

        L.extend(this.options, {
            tiles: json.tiles,
            attribution: this.options.sanitizer(json.attribution),
            minZoom: json.minzoom || 0,
            maxZoom: json.maxzoom || 18,
            tms: json.scheme === 'tms',
            bounds: json.bounds && util.lbounds(json.bounds)
        });

        this._tilejson = json;
        this.redraw();
        return this;
    },

    getTileJSON: function() {
        return this._tilejson;
    },

    // this is an exception to mapbox.js naming rules because it's called
    // by `L.map`
    getTileUrl: function(tilePoint) {
        var tiles = this.options.tiles,
            index = Math.floor(Math.abs(tilePoint.x + tilePoint.y) % tiles.length),
            url = tiles[index];

        var templated = L.Util.template(url, tilePoint);
        if (!templated || !this.options.format) {
            return templated;
        } else {
            return templated.replace(formatPattern,
                (L.Browser.retina ? this.scalePrefix : '.') + this.options.format);
        }
    },

    // TileJSON.TileLayers are added to the map immediately, so that they get
    // the desired z-index, but do not update until the TileJSON has been loaded.
    _update: function() {
        if (this.options.tiles) {
            L.TileLayer.prototype._update.call(this);
        }
    }
});

module.exports.TileLayer = TileLayer;

module.exports.tileLayer = function(_, options) {
    return new TileLayer(_, options);
};

},{"./load_tilejson":17,"./util":27,"sanitize-caja":4}],27:[function(require,module,exports){
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

},{}]},{},[19])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvY29yc2xpdGUvY29yc2xpdGUuanMiLCJub2RlX21vZHVsZXMvaXNhcnJheS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9tdXN0YWNoZS9tdXN0YWNoZS5qcyIsIm5vZGVfbW9kdWxlcy9zYW5pdGl6ZS1jYWphL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Nhbml0aXplLWNhamEvc2FuaXRpemVyLWJ1bmRsZS5qcyIsInBhY2thZ2UuanNvbiIsInNyYy9jb25maWcuanMiLCJzcmMvZmVhdHVyZV9sYXllci5qcyIsInNyYy9mZWVkYmFjay5qcyIsInNyYy9mb3JtYXRfdXJsLmpzIiwic3JjL2dlb2NvZGVyLmpzIiwic3JjL2dlb2NvZGVyX2NvbnRyb2wuanMiLCJzcmMvZ3JpZC5qcyIsInNyYy9ncmlkX2NvbnRyb2wuanMiLCJzcmMvZ3JpZF9sYXllci5qcyIsInNyYy9sZWdlbmRfY29udHJvbC5qcyIsInNyYy9sb2FkX3RpbGVqc29uLmpzIiwic3JjL21hcC5qcyIsInNyYy9tYXBib3guanMiLCJzcmMvbWFwYm94X2xvZ28uanMiLCJzcmMvbWFya2VyLmpzIiwic3JjL3JlcXVlc3QuanMiLCJzcmMvc2hhcmVfY29udHJvbC5qcyIsInNyYy9zaW1wbGVzdHlsZS5qcyIsInNyYy9zdHlsZV9sYXllci5qcyIsInNyYy90aWxlX2xheWVyLmpzIiwic3JjL3V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvNEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdE1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJmdW5jdGlvbiBjb3JzbGl0ZSh1cmwsIGNhbGxiYWNrLCBjb3JzKSB7XG4gICAgdmFyIHNlbnQgPSBmYWxzZTtcblxuICAgIGlmICh0eXBlb2Ygd2luZG93LlhNTEh0dHBSZXF1ZXN0ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soRXJyb3IoJ0Jyb3dzZXIgbm90IHN1cHBvcnRlZCcpKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGNvcnMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHZhciBtID0gdXJsLm1hdGNoKC9eXFxzKmh0dHBzPzpcXC9cXC9bXlxcL10qLyk7XG4gICAgICAgIGNvcnMgPSBtICYmIChtWzBdICE9PSBsb2NhdGlvbi5wcm90b2NvbCArICcvLycgKyBsb2NhdGlvbi5kb21haW4gK1xuICAgICAgICAgICAgICAgIChsb2NhdGlvbi5wb3J0ID8gJzonICsgbG9jYXRpb24ucG9ydCA6ICcnKSk7XG4gICAgfVxuXG4gICAgdmFyIHggPSBuZXcgd2luZG93LlhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICBmdW5jdGlvbiBpc1N1Y2Nlc3NmdWwoc3RhdHVzKSB7XG4gICAgICAgIHJldHVybiBzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCB8fCBzdGF0dXMgPT09IDMwNDtcbiAgICB9XG5cbiAgICBpZiAoY29ycyAmJiAhKCd3aXRoQ3JlZGVudGlhbHMnIGluIHgpKSB7XG4gICAgICAgIC8vIElFOC05XG4gICAgICAgIHggPSBuZXcgd2luZG93LlhEb21haW5SZXF1ZXN0KCk7XG5cbiAgICAgICAgLy8gRW5zdXJlIGNhbGxiYWNrIGlzIG5ldmVyIGNhbGxlZCBzeW5jaHJvbm91c2x5LCBpLmUuLCBiZWZvcmVcbiAgICAgICAgLy8geC5zZW5kKCkgcmV0dXJucyAodGhpcyBoYXMgYmVlbiBvYnNlcnZlZCBpbiB0aGUgd2lsZCkuXG4gICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWFwYm94L21hcGJveC5qcy9pc3N1ZXMvNDcyXG4gICAgICAgIHZhciBvcmlnaW5hbCA9IGNhbGxiYWNrO1xuICAgICAgICBjYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYgKHNlbnQpIHtcbiAgICAgICAgICAgICAgICBvcmlnaW5hbC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXMsIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWwuYXBwbHkodGhhdCwgYXJncyk7XG4gICAgICAgICAgICAgICAgfSwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkZWQoKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIC8vIFhEb21haW5SZXF1ZXN0XG4gICAgICAgICAgICB4LnN0YXR1cyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAvLyBtb2Rlcm4gYnJvd3NlcnNcbiAgICAgICAgICAgIGlzU3VjY2Vzc2Z1bCh4LnN0YXR1cykpIGNhbGxiYWNrLmNhbGwoeCwgbnVsbCwgeCk7XG4gICAgICAgIGVsc2UgY2FsbGJhY2suY2FsbCh4LCB4LCBudWxsKTtcbiAgICB9XG5cbiAgICAvLyBCb3RoIGBvbnJlYWR5c3RhdGVjaGFuZ2VgIGFuZCBgb25sb2FkYCBjYW4gZmlyZS4gYG9ucmVhZHlzdGF0ZWNoYW5nZWBcbiAgICAvLyBoYXMgW2JlZW4gc3VwcG9ydGVkIGZvciBsb25nZXJdKGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzkxODE1MDgvMjI5MDAxKS5cbiAgICBpZiAoJ29ubG9hZCcgaW4geCkge1xuICAgICAgICB4Lm9ubG9hZCA9IGxvYWRlZDtcbiAgICB9IGVsc2Uge1xuICAgICAgICB4Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uIHJlYWR5c3RhdGUoKSB7XG4gICAgICAgICAgICBpZiAoeC5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICAgICAgbG9hZGVkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gQ2FsbCB0aGUgY2FsbGJhY2sgd2l0aCB0aGUgWE1MSHR0cFJlcXVlc3Qgb2JqZWN0IGFzIGFuIGVycm9yIGFuZCBwcmV2ZW50XG4gICAgLy8gaXQgZnJvbSBldmVyIGJlaW5nIGNhbGxlZCBhZ2FpbiBieSByZWFzc2lnbmluZyBpdCB0byBgbm9vcGBcbiAgICB4Lm9uZXJyb3IgPSBmdW5jdGlvbiBlcnJvcihldnQpIHtcbiAgICAgICAgLy8gWERvbWFpblJlcXVlc3QgcHJvdmlkZXMgbm8gZXZ0IHBhcmFtZXRlclxuICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXMsIGV2dCB8fCB0cnVlLCBudWxsKTtcbiAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbigpIHsgfTtcbiAgICB9O1xuXG4gICAgLy8gSUU5IG11c3QgaGF2ZSBvbnByb2dyZXNzIGJlIHNldCB0byBhIHVuaXF1ZSBmdW5jdGlvbi5cbiAgICB4Lm9ucHJvZ3Jlc3MgPSBmdW5jdGlvbigpIHsgfTtcblxuICAgIHgub250aW1lb3V0ID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgIGNhbGxiYWNrLmNhbGwodGhpcywgZXZ0LCBudWxsKTtcbiAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbigpIHsgfTtcbiAgICB9O1xuXG4gICAgeC5vbmFib3J0ID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgIGNhbGxiYWNrLmNhbGwodGhpcywgZXZ0LCBudWxsKTtcbiAgICAgICAgY2FsbGJhY2sgPSBmdW5jdGlvbigpIHsgfTtcbiAgICB9O1xuXG4gICAgLy8gR0VUIGlzIHRoZSBvbmx5IHN1cHBvcnRlZCBIVFRQIFZlcmIgYnkgWERvbWFpblJlcXVlc3QgYW5kIGlzIHRoZVxuICAgIC8vIG9ubHkgb25lIHN1cHBvcnRlZCBoZXJlLlxuICAgIHgub3BlbignR0VUJywgdXJsLCB0cnVlKTtcblxuICAgIC8vIFNlbmQgdGhlIHJlcXVlc3QuIFNlbmRpbmcgZGF0YSBpcyBub3Qgc3VwcG9ydGVkLlxuICAgIHguc2VuZChudWxsKTtcbiAgICBzZW50ID0gdHJ1ZTtcblxuICAgIHJldHVybiB4O1xufVxuXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpIG1vZHVsZS5leHBvcnRzID0gY29yc2xpdGU7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCIvKiFcbiAqIG11c3RhY2hlLmpzIC0gTG9naWMtbGVzcyB7e211c3RhY2hlfX0gdGVtcGxhdGVzIHdpdGggSmF2YVNjcmlwdFxuICogaHR0cDovL2dpdGh1Yi5jb20vamFubC9tdXN0YWNoZS5qc1xuICovXG5cbi8qZ2xvYmFsIGRlZmluZTogZmFsc2UgTXVzdGFjaGU6IHRydWUqL1xuXG4oZnVuY3Rpb24gZGVmaW5lTXVzdGFjaGUgKGdsb2JhbCwgZmFjdG9yeSkge1xuICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIGV4cG9ydHMgJiYgdHlwZW9mIGV4cG9ydHMubm9kZU5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgZmFjdG9yeShleHBvcnRzKTsgLy8gQ29tbW9uSlNcbiAgfSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICBkZWZpbmUoWydleHBvcnRzJ10sIGZhY3RvcnkpOyAvLyBBTURcbiAgfSBlbHNlIHtcbiAgICBnbG9iYWwuTXVzdGFjaGUgPSB7fTtcbiAgICBmYWN0b3J5KGdsb2JhbC5NdXN0YWNoZSk7IC8vIHNjcmlwdCwgd3NoLCBhc3BcbiAgfVxufSh0aGlzLCBmdW5jdGlvbiBtdXN0YWNoZUZhY3RvcnkgKG11c3RhY2hlKSB7XG5cbiAgdmFyIG9iamVjdFRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbiAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIGlzQXJyYXlQb2x5ZmlsbCAob2JqZWN0KSB7XG4gICAgcmV0dXJuIG9iamVjdFRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfTtcblxuICBmdW5jdGlvbiBpc0Z1bmN0aW9uIChvYmplY3QpIHtcbiAgICByZXR1cm4gdHlwZW9mIG9iamVjdCA9PT0gJ2Z1bmN0aW9uJztcbiAgfVxuXG4gIC8qKlxuICAgKiBNb3JlIGNvcnJlY3QgdHlwZW9mIHN0cmluZyBoYW5kbGluZyBhcnJheVxuICAgKiB3aGljaCBub3JtYWxseSByZXR1cm5zIHR5cGVvZiAnb2JqZWN0J1xuICAgKi9cbiAgZnVuY3Rpb24gdHlwZVN0ciAob2JqKSB7XG4gICAgcmV0dXJuIGlzQXJyYXkob2JqKSA/ICdhcnJheScgOiB0eXBlb2Ygb2JqO1xuICB9XG5cbiAgZnVuY3Rpb24gZXNjYXBlUmVnRXhwIChzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1tcXC1cXFtcXF17fSgpKis/LixcXFxcXFxeJHwjXFxzXS9nLCAnXFxcXCQmJyk7XG4gIH1cblxuICAvKipcbiAgICogTnVsbCBzYWZlIHdheSBvZiBjaGVja2luZyB3aGV0aGVyIG9yIG5vdCBhbiBvYmplY3QsXG4gICAqIGluY2x1ZGluZyBpdHMgcHJvdG90eXBlLCBoYXMgYSBnaXZlbiBwcm9wZXJ0eVxuICAgKi9cbiAgZnVuY3Rpb24gaGFzUHJvcGVydHkgKG9iaiwgcHJvcE5hbWUpIHtcbiAgICByZXR1cm4gb2JqICE9IG51bGwgJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgKHByb3BOYW1lIGluIG9iaik7XG4gIH1cblxuICAvLyBXb3JrYXJvdW5kIGZvciBodHRwczovL2lzc3Vlcy5hcGFjaGUub3JnL2ppcmEvYnJvd3NlL0NPVUNIREItNTc3XG4gIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vamFubC9tdXN0YWNoZS5qcy9pc3N1ZXMvMTg5XG4gIHZhciByZWdFeHBUZXN0ID0gUmVnRXhwLnByb3RvdHlwZS50ZXN0O1xuICBmdW5jdGlvbiB0ZXN0UmVnRXhwIChyZSwgc3RyaW5nKSB7XG4gICAgcmV0dXJuIHJlZ0V4cFRlc3QuY2FsbChyZSwgc3RyaW5nKTtcbiAgfVxuXG4gIHZhciBub25TcGFjZVJlID0gL1xcUy87XG4gIGZ1bmN0aW9uIGlzV2hpdGVzcGFjZSAoc3RyaW5nKSB7XG4gICAgcmV0dXJuICF0ZXN0UmVnRXhwKG5vblNwYWNlUmUsIHN0cmluZyk7XG4gIH1cblxuICB2YXIgZW50aXR5TWFwID0ge1xuICAgICcmJzogJyZhbXA7JyxcbiAgICAnPCc6ICcmbHQ7JyxcbiAgICAnPic6ICcmZ3Q7JyxcbiAgICAnXCInOiAnJnF1b3Q7JyxcbiAgICBcIidcIjogJyYjMzk7JyxcbiAgICAnLyc6ICcmI3gyRjsnLFxuICAgICdgJzogJyYjeDYwOycsXG4gICAgJz0nOiAnJiN4M0Q7J1xuICB9O1xuXG4gIGZ1bmN0aW9uIGVzY2FwZUh0bWwgKHN0cmluZykge1xuICAgIHJldHVybiBTdHJpbmcoc3RyaW5nKS5yZXBsYWNlKC9bJjw+XCInYD1cXC9dL2csIGZ1bmN0aW9uIGZyb21FbnRpdHlNYXAgKHMpIHtcbiAgICAgIHJldHVybiBlbnRpdHlNYXBbc107XG4gICAgfSk7XG4gIH1cblxuICB2YXIgd2hpdGVSZSA9IC9cXHMqLztcbiAgdmFyIHNwYWNlUmUgPSAvXFxzKy87XG4gIHZhciBlcXVhbHNSZSA9IC9cXHMqPS87XG4gIHZhciBjdXJseVJlID0gL1xccypcXH0vO1xuICB2YXIgdGFnUmUgPSAvI3xcXF58XFwvfD58XFx7fCZ8PXwhLztcblxuICAvKipcbiAgICogQnJlYWtzIHVwIHRoZSBnaXZlbiBgdGVtcGxhdGVgIHN0cmluZyBpbnRvIGEgdHJlZSBvZiB0b2tlbnMuIElmIHRoZSBgdGFnc2BcbiAgICogYXJndW1lbnQgaXMgZ2l2ZW4gaGVyZSBpdCBtdXN0IGJlIGFuIGFycmF5IHdpdGggdHdvIHN0cmluZyB2YWx1ZXM6IHRoZVxuICAgKiBvcGVuaW5nIGFuZCBjbG9zaW5nIHRhZ3MgdXNlZCBpbiB0aGUgdGVtcGxhdGUgKGUuZy4gWyBcIjwlXCIsIFwiJT5cIiBdKS4gT2ZcbiAgICogY291cnNlLCB0aGUgZGVmYXVsdCBpcyB0byB1c2UgbXVzdGFjaGVzIChpLmUuIG11c3RhY2hlLnRhZ3MpLlxuICAgKlxuICAgKiBBIHRva2VuIGlzIGFuIGFycmF5IHdpdGggYXQgbGVhc3QgNCBlbGVtZW50cy4gVGhlIGZpcnN0IGVsZW1lbnQgaXMgdGhlXG4gICAqIG11c3RhY2hlIHN5bWJvbCB0aGF0IHdhcyB1c2VkIGluc2lkZSB0aGUgdGFnLCBlLmcuIFwiI1wiIG9yIFwiJlwiLiBJZiB0aGUgdGFnXG4gICAqIGRpZCBub3QgY29udGFpbiBhIHN5bWJvbCAoaS5lLiB7e215VmFsdWV9fSkgdGhpcyBlbGVtZW50IGlzIFwibmFtZVwiLiBGb3JcbiAgICogYWxsIHRleHQgdGhhdCBhcHBlYXJzIG91dHNpZGUgYSBzeW1ib2wgdGhpcyBlbGVtZW50IGlzIFwidGV4dFwiLlxuICAgKlxuICAgKiBUaGUgc2Vjb25kIGVsZW1lbnQgb2YgYSB0b2tlbiBpcyBpdHMgXCJ2YWx1ZVwiLiBGb3IgbXVzdGFjaGUgdGFncyB0aGlzIGlzXG4gICAqIHdoYXRldmVyIGVsc2Ugd2FzIGluc2lkZSB0aGUgdGFnIGJlc2lkZXMgdGhlIG9wZW5pbmcgc3ltYm9sLiBGb3IgdGV4dCB0b2tlbnNcbiAgICogdGhpcyBpcyB0aGUgdGV4dCBpdHNlbGYuXG4gICAqXG4gICAqIFRoZSB0aGlyZCBhbmQgZm91cnRoIGVsZW1lbnRzIG9mIHRoZSB0b2tlbiBhcmUgdGhlIHN0YXJ0IGFuZCBlbmQgaW5kaWNlcyxcbiAgICogcmVzcGVjdGl2ZWx5LCBvZiB0aGUgdG9rZW4gaW4gdGhlIG9yaWdpbmFsIHRlbXBsYXRlLlxuICAgKlxuICAgKiBUb2tlbnMgdGhhdCBhcmUgdGhlIHJvb3Qgbm9kZSBvZiBhIHN1YnRyZWUgY29udGFpbiB0d28gbW9yZSBlbGVtZW50czogMSkgYW5cbiAgICogYXJyYXkgb2YgdG9rZW5zIGluIHRoZSBzdWJ0cmVlIGFuZCAyKSB0aGUgaW5kZXggaW4gdGhlIG9yaWdpbmFsIHRlbXBsYXRlIGF0XG4gICAqIHdoaWNoIHRoZSBjbG9zaW5nIHRhZyBmb3IgdGhhdCBzZWN0aW9uIGJlZ2lucy5cbiAgICovXG4gIGZ1bmN0aW9uIHBhcnNlVGVtcGxhdGUgKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgaWYgKCF0ZW1wbGF0ZSlcbiAgICAgIHJldHVybiBbXTtcblxuICAgIHZhciBzZWN0aW9ucyA9IFtdOyAgICAgLy8gU3RhY2sgdG8gaG9sZCBzZWN0aW9uIHRva2Vuc1xuICAgIHZhciB0b2tlbnMgPSBbXTsgICAgICAgLy8gQnVmZmVyIHRvIGhvbGQgdGhlIHRva2Vuc1xuICAgIHZhciBzcGFjZXMgPSBbXTsgICAgICAgLy8gSW5kaWNlcyBvZiB3aGl0ZXNwYWNlIHRva2VucyBvbiB0aGUgY3VycmVudCBsaW5lXG4gICAgdmFyIGhhc1RhZyA9IGZhbHNlOyAgICAvLyBJcyB0aGVyZSBhIHt7dGFnfX0gb24gdGhlIGN1cnJlbnQgbGluZT9cbiAgICB2YXIgbm9uU3BhY2UgPSBmYWxzZTsgIC8vIElzIHRoZXJlIGEgbm9uLXNwYWNlIGNoYXIgb24gdGhlIGN1cnJlbnQgbGluZT9cblxuICAgIC8vIFN0cmlwcyBhbGwgd2hpdGVzcGFjZSB0b2tlbnMgYXJyYXkgZm9yIHRoZSBjdXJyZW50IGxpbmVcbiAgICAvLyBpZiB0aGVyZSB3YXMgYSB7eyN0YWd9fSBvbiBpdCBhbmQgb3RoZXJ3aXNlIG9ubHkgc3BhY2UuXG4gICAgZnVuY3Rpb24gc3RyaXBTcGFjZSAoKSB7XG4gICAgICBpZiAoaGFzVGFnICYmICFub25TcGFjZSkge1xuICAgICAgICB3aGlsZSAoc3BhY2VzLmxlbmd0aClcbiAgICAgICAgICBkZWxldGUgdG9rZW5zW3NwYWNlcy5wb3AoKV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzcGFjZXMgPSBbXTtcbiAgICAgIH1cblxuICAgICAgaGFzVGFnID0gZmFsc2U7XG4gICAgICBub25TcGFjZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBvcGVuaW5nVGFnUmUsIGNsb3NpbmdUYWdSZSwgY2xvc2luZ0N1cmx5UmU7XG4gICAgZnVuY3Rpb24gY29tcGlsZVRhZ3MgKHRhZ3NUb0NvbXBpbGUpIHtcbiAgICAgIGlmICh0eXBlb2YgdGFnc1RvQ29tcGlsZSA9PT0gJ3N0cmluZycpXG4gICAgICAgIHRhZ3NUb0NvbXBpbGUgPSB0YWdzVG9Db21waWxlLnNwbGl0KHNwYWNlUmUsIDIpO1xuXG4gICAgICBpZiAoIWlzQXJyYXkodGFnc1RvQ29tcGlsZSkgfHwgdGFnc1RvQ29tcGlsZS5sZW5ndGggIT09IDIpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB0YWdzOiAnICsgdGFnc1RvQ29tcGlsZSk7XG5cbiAgICAgIG9wZW5pbmdUYWdSZSA9IG5ldyBSZWdFeHAoZXNjYXBlUmVnRXhwKHRhZ3NUb0NvbXBpbGVbMF0pICsgJ1xcXFxzKicpO1xuICAgICAgY2xvc2luZ1RhZ1JlID0gbmV3IFJlZ0V4cCgnXFxcXHMqJyArIGVzY2FwZVJlZ0V4cCh0YWdzVG9Db21waWxlWzFdKSk7XG4gICAgICBjbG9zaW5nQ3VybHlSZSA9IG5ldyBSZWdFeHAoJ1xcXFxzKicgKyBlc2NhcGVSZWdFeHAoJ30nICsgdGFnc1RvQ29tcGlsZVsxXSkpO1xuICAgIH1cblxuICAgIGNvbXBpbGVUYWdzKHRhZ3MgfHwgbXVzdGFjaGUudGFncyk7XG5cbiAgICB2YXIgc2Nhbm5lciA9IG5ldyBTY2FubmVyKHRlbXBsYXRlKTtcblxuICAgIHZhciBzdGFydCwgdHlwZSwgdmFsdWUsIGNociwgdG9rZW4sIG9wZW5TZWN0aW9uO1xuICAgIHdoaWxlICghc2Nhbm5lci5lb3MoKSkge1xuICAgICAgc3RhcnQgPSBzY2FubmVyLnBvcztcblxuICAgICAgLy8gTWF0Y2ggYW55IHRleHQgYmV0d2VlbiB0YWdzLlxuICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChvcGVuaW5nVGFnUmUpO1xuXG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHZhbHVlTGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBpIDwgdmFsdWVMZW5ndGg7ICsraSkge1xuICAgICAgICAgIGNociA9IHZhbHVlLmNoYXJBdChpKTtcblxuICAgICAgICAgIGlmIChpc1doaXRlc3BhY2UoY2hyKSkge1xuICAgICAgICAgICAgc3BhY2VzLnB1c2godG9rZW5zLmxlbmd0aCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5vblNwYWNlID0gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0b2tlbnMucHVzaChbICd0ZXh0JywgY2hyLCBzdGFydCwgc3RhcnQgKyAxIF0pO1xuICAgICAgICAgIHN0YXJ0ICs9IDE7XG5cbiAgICAgICAgICAvLyBDaGVjayBmb3Igd2hpdGVzcGFjZSBvbiB0aGUgY3VycmVudCBsaW5lLlxuICAgICAgICAgIGlmIChjaHIgPT09ICdcXG4nKVxuICAgICAgICAgICAgc3RyaXBTcGFjZSgpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIE1hdGNoIHRoZSBvcGVuaW5nIHRhZy5cbiAgICAgIGlmICghc2Nhbm5lci5zY2FuKG9wZW5pbmdUYWdSZSkpXG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBoYXNUYWcgPSB0cnVlO1xuXG4gICAgICAvLyBHZXQgdGhlIHRhZyB0eXBlLlxuICAgICAgdHlwZSA9IHNjYW5uZXIuc2Nhbih0YWdSZSkgfHwgJ25hbWUnO1xuICAgICAgc2Nhbm5lci5zY2FuKHdoaXRlUmUpO1xuXG4gICAgICAvLyBHZXQgdGhlIHRhZyB2YWx1ZS5cbiAgICAgIGlmICh0eXBlID09PSAnPScpIHtcbiAgICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChlcXVhbHNSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhbihlcXVhbHNSZSk7XG4gICAgICAgIHNjYW5uZXIuc2NhblVudGlsKGNsb3NpbmdUYWdSZSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICd7Jykge1xuICAgICAgICB2YWx1ZSA9IHNjYW5uZXIuc2NhblVudGlsKGNsb3NpbmdDdXJseVJlKTtcbiAgICAgICAgc2Nhbm5lci5zY2FuKGN1cmx5UmUpO1xuICAgICAgICBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nVGFnUmUpO1xuICAgICAgICB0eXBlID0gJyYnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWUgPSBzY2FubmVyLnNjYW5VbnRpbChjbG9zaW5nVGFnUmUpO1xuICAgICAgfVxuXG4gICAgICAvLyBNYXRjaCB0aGUgY2xvc2luZyB0YWcuXG4gICAgICBpZiAoIXNjYW5uZXIuc2NhbihjbG9zaW5nVGFnUmUpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuY2xvc2VkIHRhZyBhdCAnICsgc2Nhbm5lci5wb3MpO1xuXG4gICAgICB0b2tlbiA9IFsgdHlwZSwgdmFsdWUsIHN0YXJ0LCBzY2FubmVyLnBvcyBdO1xuICAgICAgdG9rZW5zLnB1c2godG9rZW4pO1xuXG4gICAgICBpZiAodHlwZSA9PT0gJyMnIHx8IHR5cGUgPT09ICdeJykge1xuICAgICAgICBzZWN0aW9ucy5wdXNoKHRva2VuKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJy8nKSB7XG4gICAgICAgIC8vIENoZWNrIHNlY3Rpb24gbmVzdGluZy5cbiAgICAgICAgb3BlblNlY3Rpb24gPSBzZWN0aW9ucy5wb3AoKTtcblxuICAgICAgICBpZiAoIW9wZW5TZWN0aW9uKVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5vcGVuZWQgc2VjdGlvbiBcIicgKyB2YWx1ZSArICdcIiBhdCAnICsgc3RhcnQpO1xuXG4gICAgICAgIGlmIChvcGVuU2VjdGlvblsxXSAhPT0gdmFsdWUpXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmNsb3NlZCBzZWN0aW9uIFwiJyArIG9wZW5TZWN0aW9uWzFdICsgJ1wiIGF0ICcgKyBzdGFydCk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICduYW1lJyB8fCB0eXBlID09PSAneycgfHwgdHlwZSA9PT0gJyYnKSB7XG4gICAgICAgIG5vblNwYWNlID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJz0nKSB7XG4gICAgICAgIC8vIFNldCB0aGUgdGFncyBmb3IgdGhlIG5leHQgdGltZSBhcm91bmQuXG4gICAgICAgIGNvbXBpbGVUYWdzKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhlcmUgYXJlIG5vIG9wZW4gc2VjdGlvbnMgd2hlbiB3ZSdyZSBkb25lLlxuICAgIG9wZW5TZWN0aW9uID0gc2VjdGlvbnMucG9wKCk7XG5cbiAgICBpZiAob3BlblNlY3Rpb24pXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuY2xvc2VkIHNlY3Rpb24gXCInICsgb3BlblNlY3Rpb25bMV0gKyAnXCIgYXQgJyArIHNjYW5uZXIucG9zKTtcblxuICAgIHJldHVybiBuZXN0VG9rZW5zKHNxdWFzaFRva2Vucyh0b2tlbnMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21iaW5lcyB0aGUgdmFsdWVzIG9mIGNvbnNlY3V0aXZlIHRleHQgdG9rZW5zIGluIHRoZSBnaXZlbiBgdG9rZW5zYCBhcnJheVxuICAgKiB0byBhIHNpbmdsZSB0b2tlbi5cbiAgICovXG4gIGZ1bmN0aW9uIHNxdWFzaFRva2VucyAodG9rZW5zKSB7XG4gICAgdmFyIHNxdWFzaGVkVG9rZW5zID0gW107XG5cbiAgICB2YXIgdG9rZW4sIGxhc3RUb2tlbjtcbiAgICBmb3IgKHZhciBpID0gMCwgbnVtVG9rZW5zID0gdG9rZW5zLmxlbmd0aDsgaSA8IG51bVRva2VuczsgKytpKSB7XG4gICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcblxuICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgIGlmICh0b2tlblswXSA9PT0gJ3RleHQnICYmIGxhc3RUb2tlbiAmJiBsYXN0VG9rZW5bMF0gPT09ICd0ZXh0Jykge1xuICAgICAgICAgIGxhc3RUb2tlblsxXSArPSB0b2tlblsxXTtcbiAgICAgICAgICBsYXN0VG9rZW5bM10gPSB0b2tlblszXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzcXVhc2hlZFRva2Vucy5wdXNoKHRva2VuKTtcbiAgICAgICAgICBsYXN0VG9rZW4gPSB0b2tlbjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzcXVhc2hlZFRva2VucztcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtcyB0aGUgZ2l2ZW4gYXJyYXkgb2YgYHRva2Vuc2AgaW50byBhIG5lc3RlZCB0cmVlIHN0cnVjdHVyZSB3aGVyZVxuICAgKiB0b2tlbnMgdGhhdCByZXByZXNlbnQgYSBzZWN0aW9uIGhhdmUgdHdvIGFkZGl0aW9uYWwgaXRlbXM6IDEpIGFuIGFycmF5IG9mXG4gICAqIGFsbCB0b2tlbnMgdGhhdCBhcHBlYXIgaW4gdGhhdCBzZWN0aW9uIGFuZCAyKSB0aGUgaW5kZXggaW4gdGhlIG9yaWdpbmFsXG4gICAqIHRlbXBsYXRlIHRoYXQgcmVwcmVzZW50cyB0aGUgZW5kIG9mIHRoYXQgc2VjdGlvbi5cbiAgICovXG4gIGZ1bmN0aW9uIG5lc3RUb2tlbnMgKHRva2Vucykge1xuICAgIHZhciBuZXN0ZWRUb2tlbnMgPSBbXTtcbiAgICB2YXIgY29sbGVjdG9yID0gbmVzdGVkVG9rZW5zO1xuICAgIHZhciBzZWN0aW9ucyA9IFtdO1xuXG4gICAgdmFyIHRva2VuLCBzZWN0aW9uO1xuICAgIGZvciAodmFyIGkgPSAwLCBudW1Ub2tlbnMgPSB0b2tlbnMubGVuZ3RoOyBpIDwgbnVtVG9rZW5zOyArK2kpIHtcbiAgICAgIHRva2VuID0gdG9rZW5zW2ldO1xuXG4gICAgICBzd2l0Y2ggKHRva2VuWzBdKSB7XG4gICAgICAgIGNhc2UgJyMnOlxuICAgICAgICBjYXNlICdeJzpcbiAgICAgICAgICBjb2xsZWN0b3IucHVzaCh0b2tlbik7XG4gICAgICAgICAgc2VjdGlvbnMucHVzaCh0b2tlbik7XG4gICAgICAgICAgY29sbGVjdG9yID0gdG9rZW5bNF0gPSBbXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnLyc6XG4gICAgICAgICAgc2VjdGlvbiA9IHNlY3Rpb25zLnBvcCgpO1xuICAgICAgICAgIHNlY3Rpb25bNV0gPSB0b2tlblsyXTtcbiAgICAgICAgICBjb2xsZWN0b3IgPSBzZWN0aW9ucy5sZW5ndGggPiAwID8gc2VjdGlvbnNbc2VjdGlvbnMubGVuZ3RoIC0gMV1bNF0gOiBuZXN0ZWRUb2tlbnM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgY29sbGVjdG9yLnB1c2godG9rZW4pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBuZXN0ZWRUb2tlbnM7XG4gIH1cblxuICAvKipcbiAgICogQSBzaW1wbGUgc3RyaW5nIHNjYW5uZXIgdGhhdCBpcyB1c2VkIGJ5IHRoZSB0ZW1wbGF0ZSBwYXJzZXIgdG8gZmluZFxuICAgKiB0b2tlbnMgaW4gdGVtcGxhdGUgc3RyaW5ncy5cbiAgICovXG4gIGZ1bmN0aW9uIFNjYW5uZXIgKHN0cmluZykge1xuICAgIHRoaXMuc3RyaW5nID0gc3RyaW5nO1xuICAgIHRoaXMudGFpbCA9IHN0cmluZztcbiAgICB0aGlzLnBvcyA9IDA7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHRhaWwgaXMgZW1wdHkgKGVuZCBvZiBzdHJpbmcpLlxuICAgKi9cbiAgU2Nhbm5lci5wcm90b3R5cGUuZW9zID0gZnVuY3Rpb24gZW9zICgpIHtcbiAgICByZXR1cm4gdGhpcy50YWlsID09PSAnJztcbiAgfTtcblxuICAvKipcbiAgICogVHJpZXMgdG8gbWF0Y2ggdGhlIGdpdmVuIHJlZ3VsYXIgZXhwcmVzc2lvbiBhdCB0aGUgY3VycmVudCBwb3NpdGlvbi5cbiAgICogUmV0dXJucyB0aGUgbWF0Y2hlZCB0ZXh0IGlmIGl0IGNhbiBtYXRjaCwgdGhlIGVtcHR5IHN0cmluZyBvdGhlcndpc2UuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5zY2FuID0gZnVuY3Rpb24gc2NhbiAocmUpIHtcbiAgICB2YXIgbWF0Y2ggPSB0aGlzLnRhaWwubWF0Y2gocmUpO1xuXG4gICAgaWYgKCFtYXRjaCB8fCBtYXRjaC5pbmRleCAhPT0gMClcbiAgICAgIHJldHVybiAnJztcblxuICAgIHZhciBzdHJpbmcgPSBtYXRjaFswXTtcblxuICAgIHRoaXMudGFpbCA9IHRoaXMudGFpbC5zdWJzdHJpbmcoc3RyaW5nLmxlbmd0aCk7XG4gICAgdGhpcy5wb3MgKz0gc3RyaW5nLmxlbmd0aDtcblxuICAgIHJldHVybiBzdHJpbmc7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNraXBzIGFsbCB0ZXh0IHVudGlsIHRoZSBnaXZlbiByZWd1bGFyIGV4cHJlc3Npb24gY2FuIGJlIG1hdGNoZWQuIFJldHVybnNcbiAgICogdGhlIHNraXBwZWQgc3RyaW5nLCB3aGljaCBpcyB0aGUgZW50aXJlIHRhaWwgaWYgbm8gbWF0Y2ggY2FuIGJlIG1hZGUuXG4gICAqL1xuICBTY2FubmVyLnByb3RvdHlwZS5zY2FuVW50aWwgPSBmdW5jdGlvbiBzY2FuVW50aWwgKHJlKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy50YWlsLnNlYXJjaChyZSksIG1hdGNoO1xuXG4gICAgc3dpdGNoIChpbmRleCkge1xuICAgICAgY2FzZSAtMTpcbiAgICAgICAgbWF0Y2ggPSB0aGlzLnRhaWw7XG4gICAgICAgIHRoaXMudGFpbCA9ICcnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMDpcbiAgICAgICAgbWF0Y2ggPSAnJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBtYXRjaCA9IHRoaXMudGFpbC5zdWJzdHJpbmcoMCwgaW5kZXgpO1xuICAgICAgICB0aGlzLnRhaWwgPSB0aGlzLnRhaWwuc3Vic3RyaW5nKGluZGV4KTtcbiAgICB9XG5cbiAgICB0aGlzLnBvcyArPSBtYXRjaC5sZW5ndGg7XG5cbiAgICByZXR1cm4gbWF0Y2g7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgYSByZW5kZXJpbmcgY29udGV4dCBieSB3cmFwcGluZyBhIHZpZXcgb2JqZWN0IGFuZFxuICAgKiBtYWludGFpbmluZyBhIHJlZmVyZW5jZSB0byB0aGUgcGFyZW50IGNvbnRleHQuXG4gICAqL1xuICBmdW5jdGlvbiBDb250ZXh0ICh2aWV3LCBwYXJlbnRDb250ZXh0KSB7XG4gICAgdGhpcy52aWV3ID0gdmlldztcbiAgICB0aGlzLmNhY2hlID0geyAnLic6IHRoaXMudmlldyB9O1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50Q29udGV4dDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGNvbnRleHQgdXNpbmcgdGhlIGdpdmVuIHZpZXcgd2l0aCB0aGlzIGNvbnRleHRcbiAgICogYXMgdGhlIHBhcmVudC5cbiAgICovXG4gIENvbnRleHQucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiBwdXNoICh2aWV3KSB7XG4gICAgcmV0dXJuIG5ldyBDb250ZXh0KHZpZXcsIHRoaXMpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gbmFtZSBpbiB0aGlzIGNvbnRleHQsIHRyYXZlcnNpbmdcbiAgICogdXAgdGhlIGNvbnRleHQgaGllcmFyY2h5IGlmIHRoZSB2YWx1ZSBpcyBhYnNlbnQgaW4gdGhpcyBjb250ZXh0J3Mgdmlldy5cbiAgICovXG4gIENvbnRleHQucHJvdG90eXBlLmxvb2t1cCA9IGZ1bmN0aW9uIGxvb2t1cCAobmFtZSkge1xuICAgIHZhciBjYWNoZSA9IHRoaXMuY2FjaGU7XG5cbiAgICB2YXIgdmFsdWU7XG4gICAgaWYgKGNhY2hlLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICB2YWx1ZSA9IGNhY2hlW25hbWVdO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY29udGV4dCA9IHRoaXMsIG5hbWVzLCBpbmRleCwgbG9va3VwSGl0ID0gZmFsc2U7XG5cbiAgICAgIHdoaWxlIChjb250ZXh0KSB7XG4gICAgICAgIGlmIChuYW1lLmluZGV4T2YoJy4nKSA+IDApIHtcbiAgICAgICAgICB2YWx1ZSA9IGNvbnRleHQudmlldztcbiAgICAgICAgICBuYW1lcyA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgICBpbmRleCA9IDA7XG5cbiAgICAgICAgICAvKipcbiAgICAgICAgICAgKiBVc2luZyB0aGUgZG90IG5vdGlvbiBwYXRoIGluIGBuYW1lYCwgd2UgZGVzY2VuZCB0aHJvdWdoIHRoZVxuICAgICAgICAgICAqIG5lc3RlZCBvYmplY3RzLlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogVG8gYmUgY2VydGFpbiB0aGF0IHRoZSBsb29rdXAgaGFzIGJlZW4gc3VjY2Vzc2Z1bCwgd2UgaGF2ZSB0b1xuICAgICAgICAgICAqIGNoZWNrIGlmIHRoZSBsYXN0IG9iamVjdCBpbiB0aGUgcGF0aCBhY3R1YWxseSBoYXMgdGhlIHByb3BlcnR5XG4gICAgICAgICAgICogd2UgYXJlIGxvb2tpbmcgZm9yLiBXZSBzdG9yZSB0aGUgcmVzdWx0IGluIGBsb29rdXBIaXRgLlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogVGhpcyBpcyBzcGVjaWFsbHkgbmVjZXNzYXJ5IGZvciB3aGVuIHRoZSB2YWx1ZSBoYXMgYmVlbiBzZXQgdG9cbiAgICAgICAgICAgKiBgdW5kZWZpbmVkYCBhbmQgd2Ugd2FudCB0byBhdm9pZCBsb29raW5nIHVwIHBhcmVudCBjb250ZXh0cy5cbiAgICAgICAgICAgKiovXG4gICAgICAgICAgd2hpbGUgKHZhbHVlICE9IG51bGwgJiYgaW5kZXggPCBuYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gbmFtZXMubGVuZ3RoIC0gMSlcbiAgICAgICAgICAgICAgbG9va3VwSGl0ID0gaGFzUHJvcGVydHkodmFsdWUsIG5hbWVzW2luZGV4XSk7XG5cbiAgICAgICAgICAgIHZhbHVlID0gdmFsdWVbbmFtZXNbaW5kZXgrK11dO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IGNvbnRleHQudmlld1tuYW1lXTtcbiAgICAgICAgICBsb29rdXBIaXQgPSBoYXNQcm9wZXJ0eShjb250ZXh0LnZpZXcsIG5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxvb2t1cEhpdClcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjb250ZXh0ID0gY29udGV4dC5wYXJlbnQ7XG4gICAgICB9XG5cbiAgICAgIGNhY2hlW25hbWVdID0gdmFsdWU7XG4gICAgfVxuXG4gICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKVxuICAgICAgdmFsdWUgPSB2YWx1ZS5jYWxsKHRoaXMudmlldyk7XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIEEgV3JpdGVyIGtub3dzIGhvdyB0byB0YWtlIGEgc3RyZWFtIG9mIHRva2VucyBhbmQgcmVuZGVyIHRoZW0gdG8gYVxuICAgKiBzdHJpbmcsIGdpdmVuIGEgY29udGV4dC4gSXQgYWxzbyBtYWludGFpbnMgYSBjYWNoZSBvZiB0ZW1wbGF0ZXMgdG9cbiAgICogYXZvaWQgdGhlIG5lZWQgdG8gcGFyc2UgdGhlIHNhbWUgdGVtcGxhdGUgdHdpY2UuXG4gICAqL1xuICBmdW5jdGlvbiBXcml0ZXIgKCkge1xuICAgIHRoaXMuY2FjaGUgPSB7fTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhcnMgYWxsIGNhY2hlZCB0ZW1wbGF0ZXMgaW4gdGhpcyB3cml0ZXIuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiBjbGVhckNhY2hlICgpIHtcbiAgICB0aGlzLmNhY2hlID0ge307XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlcyBhbmQgY2FjaGVzIHRoZSBnaXZlbiBgdGVtcGxhdGVgIGFuZCByZXR1cm5zIHRoZSBhcnJheSBvZiB0b2tlbnNcbiAgICogdGhhdCBpcyBnZW5lcmF0ZWQgZnJvbSB0aGUgcGFyc2UuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24gcGFyc2UgKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgdmFyIGNhY2hlID0gdGhpcy5jYWNoZTtcbiAgICB2YXIgdG9rZW5zID0gY2FjaGVbdGVtcGxhdGVdO1xuXG4gICAgaWYgKHRva2VucyA9PSBudWxsKVxuICAgICAgdG9rZW5zID0gY2FjaGVbdGVtcGxhdGVdID0gcGFyc2VUZW1wbGF0ZSh0ZW1wbGF0ZSwgdGFncyk7XG5cbiAgICByZXR1cm4gdG9rZW5zO1xuICB9O1xuXG4gIC8qKlxuICAgKiBIaWdoLWxldmVsIG1ldGhvZCB0aGF0IGlzIHVzZWQgdG8gcmVuZGVyIHRoZSBnaXZlbiBgdGVtcGxhdGVgIHdpdGhcbiAgICogdGhlIGdpdmVuIGB2aWV3YC5cbiAgICpcbiAgICogVGhlIG9wdGlvbmFsIGBwYXJ0aWFsc2AgYXJndW1lbnQgbWF5IGJlIGFuIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZVxuICAgKiBuYW1lcyBhbmQgdGVtcGxhdGVzIG9mIHBhcnRpYWxzIHRoYXQgYXJlIHVzZWQgaW4gdGhlIHRlbXBsYXRlLiBJdCBtYXlcbiAgICogYWxzbyBiZSBhIGZ1bmN0aW9uIHRoYXQgaXMgdXNlZCB0byBsb2FkIHBhcnRpYWwgdGVtcGxhdGVzIG9uIHRoZSBmbHlcbiAgICogdGhhdCB0YWtlcyBhIHNpbmdsZSBhcmd1bWVudDogdGhlIG5hbWUgb2YgdGhlIHBhcnRpYWwuXG4gICAqL1xuICBXcml0ZXIucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlciAodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzKSB7XG4gICAgdmFyIHRva2VucyA9IHRoaXMucGFyc2UodGVtcGxhdGUpO1xuICAgIHZhciBjb250ZXh0ID0gKHZpZXcgaW5zdGFuY2VvZiBDb250ZXh0KSA/IHZpZXcgOiBuZXcgQ29udGV4dCh2aWV3KTtcbiAgICByZXR1cm4gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5zLCBjb250ZXh0LCBwYXJ0aWFscywgdGVtcGxhdGUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBMb3ctbGV2ZWwgbWV0aG9kIHRoYXQgcmVuZGVycyB0aGUgZ2l2ZW4gYXJyYXkgb2YgYHRva2Vuc2AgdXNpbmdcbiAgICogdGhlIGdpdmVuIGBjb250ZXh0YCBhbmQgYHBhcnRpYWxzYC5cbiAgICpcbiAgICogTm90ZTogVGhlIGBvcmlnaW5hbFRlbXBsYXRlYCBpcyBvbmx5IGV2ZXIgdXNlZCB0byBleHRyYWN0IHRoZSBwb3J0aW9uXG4gICAqIG9mIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZSB0aGF0IHdhcyBjb250YWluZWQgaW4gYSBoaWdoZXItb3JkZXIgc2VjdGlvbi5cbiAgICogSWYgdGhlIHRlbXBsYXRlIGRvZXNuJ3QgdXNlIGhpZ2hlci1vcmRlciBzZWN0aW9ucywgdGhpcyBhcmd1bWVudCBtYXlcbiAgICogYmUgb21pdHRlZC5cbiAgICovXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVyVG9rZW5zID0gZnVuY3Rpb24gcmVuZGVyVG9rZW5zICh0b2tlbnMsIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKSB7XG4gICAgdmFyIGJ1ZmZlciA9ICcnO1xuXG4gICAgdmFyIHRva2VuLCBzeW1ib2wsIHZhbHVlO1xuICAgIGZvciAodmFyIGkgPSAwLCBudW1Ub2tlbnMgPSB0b2tlbnMubGVuZ3RoOyBpIDwgbnVtVG9rZW5zOyArK2kpIHtcbiAgICAgIHZhbHVlID0gdW5kZWZpbmVkO1xuICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG4gICAgICBzeW1ib2wgPSB0b2tlblswXTtcblxuICAgICAgaWYgKHN5bWJvbCA9PT0gJyMnKSB2YWx1ZSA9IHRoaXMucmVuZGVyU2VjdGlvbih0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnXicpIHZhbHVlID0gdGhpcy5yZW5kZXJJbnZlcnRlZCh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgICAgZWxzZSBpZiAoc3ltYm9sID09PSAnPicpIHZhbHVlID0gdGhpcy5yZW5kZXJQYXJ0aWFsKHRva2VuLCBjb250ZXh0LCBwYXJ0aWFscywgb3JpZ2luYWxUZW1wbGF0ZSk7XG4gICAgICBlbHNlIGlmIChzeW1ib2wgPT09ICcmJykgdmFsdWUgPSB0aGlzLnVuZXNjYXBlZFZhbHVlKHRva2VuLCBjb250ZXh0KTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJ25hbWUnKSB2YWx1ZSA9IHRoaXMuZXNjYXBlZFZhbHVlKHRva2VuLCBjb250ZXh0KTtcbiAgICAgIGVsc2UgaWYgKHN5bWJvbCA9PT0gJ3RleHQnKSB2YWx1ZSA9IHRoaXMucmF3VmFsdWUodG9rZW4pO1xuXG4gICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZClcbiAgICAgICAgYnVmZmVyICs9IHZhbHVlO1xuICAgIH1cblxuICAgIHJldHVybiBidWZmZXI7XG4gIH07XG5cbiAgV3JpdGVyLnByb3RvdHlwZS5yZW5kZXJTZWN0aW9uID0gZnVuY3Rpb24gcmVuZGVyU2VjdGlvbiAodG9rZW4sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBidWZmZXIgPSAnJztcbiAgICB2YXIgdmFsdWUgPSBjb250ZXh0Lmxvb2t1cCh0b2tlblsxXSk7XG5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gcmVuZGVyIGFuIGFyYml0cmFyeSB0ZW1wbGF0ZVxuICAgIC8vIGluIHRoZSBjdXJyZW50IGNvbnRleHQgYnkgaGlnaGVyLW9yZGVyIHNlY3Rpb25zLlxuICAgIGZ1bmN0aW9uIHN1YlJlbmRlciAodGVtcGxhdGUpIHtcbiAgICAgIHJldHVybiBzZWxmLnJlbmRlcih0ZW1wbGF0ZSwgY29udGV4dCwgcGFydGlhbHMpO1xuICAgIH1cblxuICAgIGlmICghdmFsdWUpIHJldHVybjtcblxuICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgZm9yICh2YXIgaiA9IDAsIHZhbHVlTGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBqIDwgdmFsdWVMZW5ndGg7ICsraikge1xuICAgICAgICBidWZmZXIgKz0gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5bNF0sIGNvbnRleHQucHVzaCh2YWx1ZVtqXSksIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICBidWZmZXIgKz0gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5bNF0sIGNvbnRleHQucHVzaCh2YWx1ZSksIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKTtcbiAgICB9IGVsc2UgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICBpZiAodHlwZW9mIG9yaWdpbmFsVGVtcGxhdGUgIT09ICdzdHJpbmcnKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCB1c2UgaGlnaGVyLW9yZGVyIHNlY3Rpb25zIHdpdGhvdXQgdGhlIG9yaWdpbmFsIHRlbXBsYXRlJyk7XG5cbiAgICAgIC8vIEV4dHJhY3QgdGhlIHBvcnRpb24gb2YgdGhlIG9yaWdpbmFsIHRlbXBsYXRlIHRoYXQgdGhlIHNlY3Rpb24gY29udGFpbnMuXG4gICAgICB2YWx1ZSA9IHZhbHVlLmNhbGwoY29udGV4dC52aWV3LCBvcmlnaW5hbFRlbXBsYXRlLnNsaWNlKHRva2VuWzNdLCB0b2tlbls1XSksIHN1YlJlbmRlcik7XG5cbiAgICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgICBidWZmZXIgKz0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1ZmZlciArPSB0aGlzLnJlbmRlclRva2Vucyh0b2tlbls0XSwgY29udGV4dCwgcGFydGlhbHMsIG9yaWdpbmFsVGVtcGxhdGUpO1xuICAgIH1cbiAgICByZXR1cm4gYnVmZmVyO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmVuZGVySW52ZXJ0ZWQgPSBmdW5jdGlvbiByZW5kZXJJbnZlcnRlZCAodG9rZW4sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKSB7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAodG9rZW5bMV0pO1xuXG4gICAgLy8gVXNlIEphdmFTY3JpcHQncyBkZWZpbml0aW9uIG9mIGZhbHN5LiBJbmNsdWRlIGVtcHR5IGFycmF5cy5cbiAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2phbmwvbXVzdGFjaGUuanMvaXNzdWVzLzE4NlxuICAgIGlmICghdmFsdWUgfHwgKGlzQXJyYXkodmFsdWUpICYmIHZhbHVlLmxlbmd0aCA9PT0gMCkpXG4gICAgICByZXR1cm4gdGhpcy5yZW5kZXJUb2tlbnModG9rZW5bNF0sIGNvbnRleHQsIHBhcnRpYWxzLCBvcmlnaW5hbFRlbXBsYXRlKTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLnJlbmRlclBhcnRpYWwgPSBmdW5jdGlvbiByZW5kZXJQYXJ0aWFsICh0b2tlbiwgY29udGV4dCwgcGFydGlhbHMpIHtcbiAgICBpZiAoIXBhcnRpYWxzKSByZXR1cm47XG5cbiAgICB2YXIgdmFsdWUgPSBpc0Z1bmN0aW9uKHBhcnRpYWxzKSA/IHBhcnRpYWxzKHRva2VuWzFdKSA6IHBhcnRpYWxzW3Rva2VuWzFdXTtcbiAgICBpZiAodmFsdWUgIT0gbnVsbClcbiAgICAgIHJldHVybiB0aGlzLnJlbmRlclRva2Vucyh0aGlzLnBhcnNlKHZhbHVlKSwgY29udGV4dCwgcGFydGlhbHMsIHZhbHVlKTtcbiAgfTtcblxuICBXcml0ZXIucHJvdG90eXBlLnVuZXNjYXBlZFZhbHVlID0gZnVuY3Rpb24gdW5lc2NhcGVkVmFsdWUgKHRva2VuLCBjb250ZXh0KSB7XG4gICAgdmFyIHZhbHVlID0gY29udGV4dC5sb29rdXAodG9rZW5bMV0pO1xuICAgIGlmICh2YWx1ZSAhPSBudWxsKVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUuZXNjYXBlZFZhbHVlID0gZnVuY3Rpb24gZXNjYXBlZFZhbHVlICh0b2tlbiwgY29udGV4dCkge1xuICAgIHZhciB2YWx1ZSA9IGNvbnRleHQubG9va3VwKHRva2VuWzFdKTtcbiAgICBpZiAodmFsdWUgIT0gbnVsbClcbiAgICAgIHJldHVybiBtdXN0YWNoZS5lc2NhcGUodmFsdWUpO1xuICB9O1xuXG4gIFdyaXRlci5wcm90b3R5cGUucmF3VmFsdWUgPSBmdW5jdGlvbiByYXdWYWx1ZSAodG9rZW4pIHtcbiAgICByZXR1cm4gdG9rZW5bMV07XG4gIH07XG5cbiAgbXVzdGFjaGUubmFtZSA9ICdtdXN0YWNoZS5qcyc7XG4gIG11c3RhY2hlLnZlcnNpb24gPSAnMi4yLjEnO1xuICBtdXN0YWNoZS50YWdzID0gWyAne3snLCAnfX0nIF07XG5cbiAgLy8gQWxsIGhpZ2gtbGV2ZWwgbXVzdGFjaGUuKiBmdW5jdGlvbnMgdXNlIHRoaXMgd3JpdGVyLlxuICB2YXIgZGVmYXVsdFdyaXRlciA9IG5ldyBXcml0ZXIoKTtcblxuICAvKipcbiAgICogQ2xlYXJzIGFsbCBjYWNoZWQgdGVtcGxhdGVzIGluIHRoZSBkZWZhdWx0IHdyaXRlci5cbiAgICovXG4gIG11c3RhY2hlLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiBjbGVhckNhY2hlICgpIHtcbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5jbGVhckNhY2hlKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlcyBhbmQgY2FjaGVzIHRoZSBnaXZlbiB0ZW1wbGF0ZSBpbiB0aGUgZGVmYXVsdCB3cml0ZXIgYW5kIHJldHVybnMgdGhlXG4gICAqIGFycmF5IG9mIHRva2VucyBpdCBjb250YWlucy4gRG9pbmcgdGhpcyBhaGVhZCBvZiB0aW1lIGF2b2lkcyB0aGUgbmVlZCB0b1xuICAgKiBwYXJzZSB0ZW1wbGF0ZXMgb24gdGhlIGZseSBhcyB0aGV5IGFyZSByZW5kZXJlZC5cbiAgICovXG4gIG11c3RhY2hlLnBhcnNlID0gZnVuY3Rpb24gcGFyc2UgKHRlbXBsYXRlLCB0YWdzKSB7XG4gICAgcmV0dXJuIGRlZmF1bHRXcml0ZXIucGFyc2UodGVtcGxhdGUsIHRhZ3MpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZW5kZXJzIHRoZSBgdGVtcGxhdGVgIHdpdGggdGhlIGdpdmVuIGB2aWV3YCBhbmQgYHBhcnRpYWxzYCB1c2luZyB0aGVcbiAgICogZGVmYXVsdCB3cml0ZXIuXG4gICAqL1xuICBtdXN0YWNoZS5yZW5kZXIgPSBmdW5jdGlvbiByZW5kZXIgKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscykge1xuICAgIGlmICh0eXBlb2YgdGVtcGxhdGUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIHRlbXBsYXRlISBUZW1wbGF0ZSBzaG91bGQgYmUgYSBcInN0cmluZ1wiICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnYnV0IFwiJyArIHR5cGVTdHIodGVtcGxhdGUpICsgJ1wiIHdhcyBnaXZlbiBhcyB0aGUgZmlyc3QgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICdhcmd1bWVudCBmb3IgbXVzdGFjaGUjcmVuZGVyKHRlbXBsYXRlLCB2aWV3LCBwYXJ0aWFscyknKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVmYXVsdFdyaXRlci5yZW5kZXIodGVtcGxhdGUsIHZpZXcsIHBhcnRpYWxzKTtcbiAgfTtcblxuICAvLyBUaGlzIGlzIGhlcmUgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IHdpdGggMC40LnguLFxuICAvKmVzbGludC1kaXNhYmxlICovIC8vIGVzbGludCB3YW50cyBjYW1lbCBjYXNlZCBmdW5jdGlvbiBuYW1lXG4gIG11c3RhY2hlLnRvX2h0bWwgPSBmdW5jdGlvbiB0b19odG1sICh0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMsIHNlbmQpIHtcbiAgICAvKmVzbGludC1lbmFibGUqL1xuXG4gICAgdmFyIHJlc3VsdCA9IG11c3RhY2hlLnJlbmRlcih0ZW1wbGF0ZSwgdmlldywgcGFydGlhbHMpO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oc2VuZCkpIHtcbiAgICAgIHNlbmQocmVzdWx0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH07XG5cbiAgLy8gRXhwb3J0IHRoZSBlc2NhcGluZyBmdW5jdGlvbiBzbyB0aGF0IHRoZSB1c2VyIG1heSBvdmVycmlkZSBpdC5cbiAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9qYW5sL211c3RhY2hlLmpzL2lzc3Vlcy8yNDRcbiAgbXVzdGFjaGUuZXNjYXBlID0gZXNjYXBlSHRtbDtcblxuICAvLyBFeHBvcnQgdGhlc2UgbWFpbmx5IGZvciB0ZXN0aW5nLCBidXQgYWxzbyBmb3IgYWR2YW5jZWQgdXNhZ2UuXG4gIG11c3RhY2hlLlNjYW5uZXIgPSBTY2FubmVyO1xuICBtdXN0YWNoZS5Db250ZXh0ID0gQ29udGV4dDtcbiAgbXVzdGFjaGUuV3JpdGVyID0gV3JpdGVyO1xuXG59KSk7XG4iLCJ2YXIgaHRtbF9zYW5pdGl6ZSA9IHJlcXVpcmUoJy4vc2FuaXRpemVyLWJ1bmRsZS5qcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKF8pIHtcbiAgICBpZiAoIV8pIHJldHVybiAnJztcbiAgICByZXR1cm4gaHRtbF9zYW5pdGl6ZShfLCBjbGVhblVybCwgY2xlYW5JZCk7XG59O1xuXG4vLyBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD0yNTUxMDdcbmZ1bmN0aW9uIGNsZWFuVXJsKHVybCkge1xuICAgICd1c2Ugc3RyaWN0JztcbiAgICBpZiAoL15odHRwcz8vLnRlc3QodXJsLmdldFNjaGVtZSgpKSkgcmV0dXJuIHVybC50b1N0cmluZygpO1xuICAgIGlmICgvXm1haWx0bz8vLnRlc3QodXJsLmdldFNjaGVtZSgpKSkgcmV0dXJuIHVybC50b1N0cmluZygpO1xuICAgIGlmICgnZGF0YScgPT0gdXJsLmdldFNjaGVtZSgpICYmIC9eaW1hZ2UvLnRlc3QodXJsLmdldFBhdGgoKSkpIHtcbiAgICAgICAgcmV0dXJuIHVybC50b1N0cmluZygpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gY2xlYW5JZChpZCkgeyByZXR1cm4gaWQ7IH1cbiIsIlxuLy8gQ29weXJpZ2h0IChDKSAyMDEwIEdvb2dsZSBJbmMuXG4vL1xuLy8gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbi8vIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbi8vIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuLy9cbi8vICAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4vL1xuLy8gVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuLy8gZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuLy8gV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4vLyBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4vLyBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cblxuLyoqXG4gKiBAZmlsZW92ZXJ2aWV3XG4gKiBJbXBsZW1lbnRzIFJGQyAzOTg2IGZvciBwYXJzaW5nL2Zvcm1hdHRpbmcgVVJJcy5cbiAqXG4gKiBAYXV0aG9yIG1pa2VzYW11ZWxAZ21haWwuY29tXG4gKiBcXEBwcm92aWRlcyBVUklcbiAqIFxcQG92ZXJyaWRlcyB3aW5kb3dcbiAqL1xuXG52YXIgVVJJID0gKGZ1bmN0aW9uICgpIHtcblxuLyoqXG4gKiBjcmVhdGVzIGEgdXJpIGZyb20gdGhlIHN0cmluZyBmb3JtLiAgVGhlIHBhcnNlciBpcyByZWxheGVkLCBzbyBzcGVjaWFsXG4gKiBjaGFyYWN0ZXJzIHRoYXQgYXJlbid0IGVzY2FwZWQgYnV0IGRvbid0IGNhdXNlIGFtYmlndWl0aWVzIHdpbGwgbm90IGNhdXNlXG4gKiBwYXJzZSBmYWlsdXJlcy5cbiAqXG4gKiBAcmV0dXJuIHtVUkl8bnVsbH1cbiAqL1xuZnVuY3Rpb24gcGFyc2UodXJpU3RyKSB7XG4gIHZhciBtID0gKCcnICsgdXJpU3RyKS5tYXRjaChVUklfUkVfKTtcbiAgaWYgKCFtKSB7IHJldHVybiBudWxsOyB9XG4gIHJldHVybiBuZXcgVVJJKFxuICAgICAgbnVsbElmQWJzZW50KG1bMV0pLFxuICAgICAgbnVsbElmQWJzZW50KG1bMl0pLFxuICAgICAgbnVsbElmQWJzZW50KG1bM10pLFxuICAgICAgbnVsbElmQWJzZW50KG1bNF0pLFxuICAgICAgbnVsbElmQWJzZW50KG1bNV0pLFxuICAgICAgbnVsbElmQWJzZW50KG1bNl0pLFxuICAgICAgbnVsbElmQWJzZW50KG1bN10pKTtcbn1cblxuXG4vKipcbiAqIGNyZWF0ZXMgYSB1cmkgZnJvbSB0aGUgZ2l2ZW4gcGFydHMuXG4gKlxuICogQHBhcmFtIHNjaGVtZSB7c3RyaW5nfSBhbiB1bmVuY29kZWQgc2NoZW1lIHN1Y2ggYXMgXCJodHRwXCIgb3IgbnVsbFxuICogQHBhcmFtIGNyZWRlbnRpYWxzIHtzdHJpbmd9IHVuZW5jb2RlZCB1c2VyIGNyZWRlbnRpYWxzIG9yIG51bGxcbiAqIEBwYXJhbSBkb21haW4ge3N0cmluZ30gYW4gdW5lbmNvZGVkIGRvbWFpbiBuYW1lIG9yIG51bGxcbiAqIEBwYXJhbSBwb3J0IHtudW1iZXJ9IGEgcG9ydCBudW1iZXIgaW4gWzEsIDMyNzY4XS5cbiAqICAgIC0xIGluZGljYXRlcyBubyBwb3J0LCBhcyBkb2VzIG51bGwuXG4gKiBAcGFyYW0gcGF0aCB7c3RyaW5nfSBhbiB1bmVuY29kZWQgcGF0aFxuICogQHBhcmFtIHF1ZXJ5IHtBcnJheS48c3RyaW5nPnxzdHJpbmd8bnVsbH0gYSBsaXN0IG9mIHVuZW5jb2RlZCBjZ2lcbiAqICAgcGFyYW1ldGVycyB3aGVyZSBldmVuIHZhbHVlcyBhcmUga2V5cyBhbmQgb2RkcyB0aGUgY29ycmVzcG9uZGluZyB2YWx1ZXNcbiAqICAgb3IgYW4gdW5lbmNvZGVkIHF1ZXJ5LlxuICogQHBhcmFtIGZyYWdtZW50IHtzdHJpbmd9IGFuIHVuZW5jb2RlZCBmcmFnbWVudCB3aXRob3V0IHRoZSBcIiNcIiBvciBudWxsLlxuICogQHJldHVybiB7VVJJfVxuICovXG5mdW5jdGlvbiBjcmVhdGUoc2NoZW1lLCBjcmVkZW50aWFscywgZG9tYWluLCBwb3J0LCBwYXRoLCBxdWVyeSwgZnJhZ21lbnQpIHtcbiAgdmFyIHVyaSA9IG5ldyBVUkkoXG4gICAgICBlbmNvZGVJZkV4aXN0czIoc2NoZW1lLCBVUklfRElTQUxMT1dFRF9JTl9TQ0hFTUVfT1JfQ1JFREVOVElBTFNfKSxcbiAgICAgIGVuY29kZUlmRXhpc3RzMihcbiAgICAgICAgICBjcmVkZW50aWFscywgVVJJX0RJU0FMTE9XRURfSU5fU0NIRU1FX09SX0NSRURFTlRJQUxTXyksXG4gICAgICBlbmNvZGVJZkV4aXN0cyhkb21haW4pLFxuICAgICAgcG9ydCA+IDAgPyBwb3J0LnRvU3RyaW5nKCkgOiBudWxsLFxuICAgICAgZW5jb2RlSWZFeGlzdHMyKHBhdGgsIFVSSV9ESVNBTExPV0VEX0lOX1BBVEhfKSxcbiAgICAgIG51bGwsXG4gICAgICBlbmNvZGVJZkV4aXN0cyhmcmFnbWVudCkpO1xuICBpZiAocXVlcnkpIHtcbiAgICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiBxdWVyeSkge1xuICAgICAgdXJpLnNldFJhd1F1ZXJ5KHF1ZXJ5LnJlcGxhY2UoL1tePyY9MC05QS1aYS16X1xcLX4uJV0vZywgZW5jb2RlT25lKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHVyaS5zZXRBbGxQYXJhbWV0ZXJzKHF1ZXJ5KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHVyaTtcbn1cbmZ1bmN0aW9uIGVuY29kZUlmRXhpc3RzKHVuZXNjYXBlZFBhcnQpIHtcbiAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiB1bmVzY2FwZWRQYXJ0KSB7XG4gICAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudCh1bmVzY2FwZWRQYXJ0KTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn07XG4vKipcbiAqIGlmIHVuZXNjYXBlZFBhcnQgaXMgbm9uIG51bGwsIHRoZW4gZXNjYXBlcyBhbnkgY2hhcmFjdGVycyBpbiBpdCB0aGF0IGFyZW4ndFxuICogdmFsaWQgY2hhcmFjdGVycyBpbiBhIHVybCBhbmQgYWxzbyBlc2NhcGVzIGFueSBzcGVjaWFsIGNoYXJhY3RlcnMgdGhhdFxuICogYXBwZWFyIGluIGV4dHJhLlxuICpcbiAqIEBwYXJhbSB1bmVzY2FwZWRQYXJ0IHtzdHJpbmd9XG4gKiBAcGFyYW0gZXh0cmEge1JlZ0V4cH0gYSBjaGFyYWN0ZXIgc2V0IG9mIGNoYXJhY3RlcnMgaW4gW1xcMDEtXFwxNzddLlxuICogQHJldHVybiB7c3RyaW5nfG51bGx9IG51bGwgaWZmIHVuZXNjYXBlZFBhcnQgPT0gbnVsbC5cbiAqL1xuZnVuY3Rpb24gZW5jb2RlSWZFeGlzdHMyKHVuZXNjYXBlZFBhcnQsIGV4dHJhKSB7XG4gIGlmICgnc3RyaW5nJyA9PSB0eXBlb2YgdW5lc2NhcGVkUGFydCkge1xuICAgIHJldHVybiBlbmNvZGVVUkkodW5lc2NhcGVkUGFydCkucmVwbGFjZShleHRyYSwgZW5jb2RlT25lKTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn07XG4vKiogY29udmVydHMgYSBjaGFyYWN0ZXIgaW4gW1xcMDEtXFwxNzddIHRvIGl0cyB1cmwgZW5jb2RlZCBlcXVpdmFsZW50LiAqL1xuZnVuY3Rpb24gZW5jb2RlT25lKGNoKSB7XG4gIHZhciBuID0gY2guY2hhckNvZGVBdCgwKTtcbiAgcmV0dXJuICclJyArICcwMTIzNDU2Nzg5QUJDREVGJy5jaGFyQXQoKG4gPj4gNCkgJiAweGYpICtcbiAgICAgICcwMTIzNDU2Nzg5QUJDREVGJy5jaGFyQXQobiAmIDB4Zik7XG59XG5cbi8qKlxuICoge0B1cGRvY1xuICogICQgbm9ybVBhdGgoJ2Zvby8uL2JhcicpXG4gKiAgIyAnZm9vL2JhcidcbiAqICAkIG5vcm1QYXRoKCcuL2ZvbycpXG4gKiAgIyAnZm9vJ1xuICogICQgbm9ybVBhdGgoJ2Zvby8uJylcbiAqICAjICdmb28nXG4gKiAgJCBub3JtUGF0aCgnZm9vLy9iYXInKVxuICogICMgJ2Zvby9iYXInXG4gKiB9XG4gKi9cbmZ1bmN0aW9uIG5vcm1QYXRoKHBhdGgpIHtcbiAgcmV0dXJuIHBhdGgucmVwbGFjZSgvKF58XFwvKVxcLig/OlxcL3wkKS9nLCAnJDEnKS5yZXBsYWNlKC9cXC97Mix9L2csICcvJyk7XG59XG5cbnZhciBQQVJFTlRfRElSRUNUT1JZX0hBTkRMRVIgPSBuZXcgUmVnRXhwKFxuICAgICcnXG4gICAgLy8gQSBwYXRoIGJyZWFrXG4gICAgKyAnKC98XiknXG4gICAgLy8gZm9sbG93ZWQgYnkgYSBub24gLi4gcGF0aCBlbGVtZW50XG4gICAgLy8gKGNhbm5vdCBiZSAuIGJlY2F1c2Ugbm9ybVBhdGggaXMgdXNlZCBwcmlvciB0byB0aGlzIFJlZ0V4cClcbiAgICArICcoPzpbXi4vXVteL10qfFxcXFwuezIsfSg/OlteLi9dW14vXSopfFxcXFwuezMsfVteL10qKSdcbiAgICAvLyBmb2xsb3dlZCBieSAuLiBmb2xsb3dlZCBieSBhIHBhdGggYnJlYWsuXG4gICAgKyAnL1xcXFwuXFxcXC4oPzovfCQpJyk7XG5cbnZhciBQQVJFTlRfRElSRUNUT1JZX0hBTkRMRVJfUkUgPSBuZXcgUmVnRXhwKFBBUkVOVF9ESVJFQ1RPUllfSEFORExFUik7XG5cbnZhciBFWFRSQV9QQVJFTlRfUEFUSFNfUkUgPSAvXig/OlxcLlxcLlxcLykqKD86XFwuXFwuJCk/LztcblxuLyoqXG4gKiBOb3JtYWxpemVzIGl0cyBpbnB1dCBwYXRoIGFuZCBjb2xsYXBzZXMgYWxsIC4gYW5kIC4uIHNlcXVlbmNlcyBleGNlcHQgZm9yXG4gKiAuLiBzZXF1ZW5jZXMgdGhhdCB3b3VsZCB0YWtlIGl0IGFib3ZlIHRoZSByb290IG9mIHRoZSBjdXJyZW50IHBhcmVudFxuICogZGlyZWN0b3J5LlxuICoge0B1cGRvY1xuICogICQgY29sbGFwc2VfZG90cygnZm9vLy4uL2JhcicpXG4gKiAgIyAnYmFyJ1xuICogICQgY29sbGFwc2VfZG90cygnZm9vLy4vYmFyJylcbiAqICAjICdmb28vYmFyJ1xuICogICQgY29sbGFwc2VfZG90cygnZm9vLy4uL2Jhci8uLy4uLy4uL2JheicpXG4gKiAgIyAnYmF6J1xuICogICQgY29sbGFwc2VfZG90cygnLi4vZm9vJylcbiAqICAjICcuLi9mb28nXG4gKiAgJCBjb2xsYXBzZV9kb3RzKCcuLi9mb28nKS5yZXBsYWNlKEVYVFJBX1BBUkVOVF9QQVRIU19SRSwgJycpXG4gKiAgIyAnZm9vJ1xuICogfVxuICovXG5mdW5jdGlvbiBjb2xsYXBzZV9kb3RzKHBhdGgpIHtcbiAgaWYgKHBhdGggPT09IG51bGwpIHsgcmV0dXJuIG51bGw7IH1cbiAgdmFyIHAgPSBub3JtUGF0aChwYXRoKTtcbiAgLy8gT25seSAvLi4vIGxlZnQgdG8gZmxhdHRlblxuICB2YXIgciA9IFBBUkVOVF9ESVJFQ1RPUllfSEFORExFUl9SRTtcbiAgLy8gV2UgcmVwbGFjZSB3aXRoICQxIHdoaWNoIG1hdGNoZXMgYSAvIGJlZm9yZSB0aGUgLi4gYmVjYXVzZSB0aGlzXG4gIC8vIGd1YXJhbnRlZXMgdGhhdDpcbiAgLy8gKDEpIHdlIGhhdmUgYXQgbW9zdCAxIC8gYmV0d2VlbiB0aGUgYWRqYWNlbnQgcGxhY2UsXG4gIC8vICgyKSBhbHdheXMgaGF2ZSBhIHNsYXNoIGlmIHRoZXJlIGlzIGEgcHJlY2VkaW5nIHBhdGggc2VjdGlvbiwgYW5kXG4gIC8vICgzKSB3ZSBuZXZlciB0dXJuIGEgcmVsYXRpdmUgcGF0aCBpbnRvIGFuIGFic29sdXRlIHBhdGguXG4gIGZvciAodmFyIHE7IChxID0gcC5yZXBsYWNlKHIsICckMScpKSAhPSBwOyBwID0gcSkge307XG4gIHJldHVybiBwO1xufVxuXG4vKipcbiAqIHJlc29sdmVzIGEgcmVsYXRpdmUgdXJsIHN0cmluZyB0byBhIGJhc2UgdXJpLlxuICogQHJldHVybiB7VVJJfVxuICovXG5mdW5jdGlvbiByZXNvbHZlKGJhc2VVcmksIHJlbGF0aXZlVXJpKSB7XG4gIC8vIHRoZXJlIGFyZSBzZXZlcmFsIGtpbmRzIG9mIHJlbGF0aXZlIHVybHM6XG4gIC8vIDEuIC8vZm9vIC0gcmVwbGFjZXMgZXZlcnl0aGluZyBmcm9tIHRoZSBkb21haW4gb24uICBmb28gaXMgYSBkb21haW4gbmFtZVxuICAvLyAyLiBmb28gLSByZXBsYWNlcyB0aGUgbGFzdCBwYXJ0IG9mIHRoZSBwYXRoLCB0aGUgd2hvbGUgcXVlcnkgYW5kIGZyYWdtZW50XG4gIC8vIDMuIC9mb28gLSByZXBsYWNlcyB0aGUgdGhlIHBhdGgsIHRoZSBxdWVyeSBhbmQgZnJhZ21lbnRcbiAgLy8gNC4gP2ZvbyAtIHJlcGxhY2UgdGhlIHF1ZXJ5IGFuZCBmcmFnbWVudFxuICAvLyA1LiAjZm9vIC0gcmVwbGFjZSB0aGUgZnJhZ21lbnQgb25seVxuXG4gIHZhciBhYnNvbHV0ZVVyaSA9IGJhc2VVcmkuY2xvbmUoKTtcbiAgLy8gd2Ugc2F0aXNmeSB0aGVzZSBjb25kaXRpb25zIGJ5IGxvb2tpbmcgZm9yIHRoZSBmaXJzdCBwYXJ0IG9mIHJlbGF0aXZlVXJpXG4gIC8vIHRoYXQgaXMgbm90IGJsYW5rIGFuZCBhcHBseWluZyBkZWZhdWx0cyB0byB0aGUgcmVzdFxuXG4gIHZhciBvdmVycmlkZGVuID0gcmVsYXRpdmVVcmkuaGFzU2NoZW1lKCk7XG5cbiAgaWYgKG92ZXJyaWRkZW4pIHtcbiAgICBhYnNvbHV0ZVVyaS5zZXRSYXdTY2hlbWUocmVsYXRpdmVVcmkuZ2V0UmF3U2NoZW1lKCkpO1xuICB9IGVsc2Uge1xuICAgIG92ZXJyaWRkZW4gPSByZWxhdGl2ZVVyaS5oYXNDcmVkZW50aWFscygpO1xuICB9XG5cbiAgaWYgKG92ZXJyaWRkZW4pIHtcbiAgICBhYnNvbHV0ZVVyaS5zZXRSYXdDcmVkZW50aWFscyhyZWxhdGl2ZVVyaS5nZXRSYXdDcmVkZW50aWFscygpKTtcbiAgfSBlbHNlIHtcbiAgICBvdmVycmlkZGVuID0gcmVsYXRpdmVVcmkuaGFzRG9tYWluKCk7XG4gIH1cblxuICBpZiAob3ZlcnJpZGRlbikge1xuICAgIGFic29sdXRlVXJpLnNldFJhd0RvbWFpbihyZWxhdGl2ZVVyaS5nZXRSYXdEb21haW4oKSk7XG4gIH0gZWxzZSB7XG4gICAgb3ZlcnJpZGRlbiA9IHJlbGF0aXZlVXJpLmhhc1BvcnQoKTtcbiAgfVxuXG4gIHZhciByYXdQYXRoID0gcmVsYXRpdmVVcmkuZ2V0UmF3UGF0aCgpO1xuICB2YXIgc2ltcGxpZmllZFBhdGggPSBjb2xsYXBzZV9kb3RzKHJhd1BhdGgpO1xuICBpZiAob3ZlcnJpZGRlbikge1xuICAgIGFic29sdXRlVXJpLnNldFBvcnQocmVsYXRpdmVVcmkuZ2V0UG9ydCgpKTtcbiAgICBzaW1wbGlmaWVkUGF0aCA9IHNpbXBsaWZpZWRQYXRoXG4gICAgICAgICYmIHNpbXBsaWZpZWRQYXRoLnJlcGxhY2UoRVhUUkFfUEFSRU5UX1BBVEhTX1JFLCAnJyk7XG4gIH0gZWxzZSB7XG4gICAgb3ZlcnJpZGRlbiA9ICEhcmF3UGF0aDtcbiAgICBpZiAob3ZlcnJpZGRlbikge1xuICAgICAgLy8gcmVzb2x2ZSBwYXRoIHByb3Blcmx5XG4gICAgICBpZiAoc2ltcGxpZmllZFBhdGguY2hhckNvZGVBdCgwKSAhPT0gMHgyZiAvKiAvICovKSB7ICAvLyBwYXRoIGlzIHJlbGF0aXZlXG4gICAgICAgIHZhciBhYnNSYXdQYXRoID0gY29sbGFwc2VfZG90cyhhYnNvbHV0ZVVyaS5nZXRSYXdQYXRoKCkgfHwgJycpXG4gICAgICAgICAgICAucmVwbGFjZShFWFRSQV9QQVJFTlRfUEFUSFNfUkUsICcnKTtcbiAgICAgICAgdmFyIHNsYXNoID0gYWJzUmF3UGF0aC5sYXN0SW5kZXhPZignLycpICsgMTtcbiAgICAgICAgc2ltcGxpZmllZFBhdGggPSBjb2xsYXBzZV9kb3RzKFxuICAgICAgICAgICAgKHNsYXNoID8gYWJzUmF3UGF0aC5zdWJzdHJpbmcoMCwgc2xhc2gpIDogJycpXG4gICAgICAgICAgICArIGNvbGxhcHNlX2RvdHMocmF3UGF0aCkpXG4gICAgICAgICAgICAucmVwbGFjZShFWFRSQV9QQVJFTlRfUEFUSFNfUkUsICcnKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc2ltcGxpZmllZFBhdGggPSBzaW1wbGlmaWVkUGF0aFxuICAgICAgICAgICYmIHNpbXBsaWZpZWRQYXRoLnJlcGxhY2UoRVhUUkFfUEFSRU5UX1BBVEhTX1JFLCAnJyk7XG4gICAgICBpZiAoc2ltcGxpZmllZFBhdGggIT09IHJhd1BhdGgpIHtcbiAgICAgICAgYWJzb2x1dGVVcmkuc2V0UmF3UGF0aChzaW1wbGlmaWVkUGF0aCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKG92ZXJyaWRkZW4pIHtcbiAgICBhYnNvbHV0ZVVyaS5zZXRSYXdQYXRoKHNpbXBsaWZpZWRQYXRoKTtcbiAgfSBlbHNlIHtcbiAgICBvdmVycmlkZGVuID0gcmVsYXRpdmVVcmkuaGFzUXVlcnkoKTtcbiAgfVxuXG4gIGlmIChvdmVycmlkZGVuKSB7XG4gICAgYWJzb2x1dGVVcmkuc2V0UmF3UXVlcnkocmVsYXRpdmVVcmkuZ2V0UmF3UXVlcnkoKSk7XG4gIH0gZWxzZSB7XG4gICAgb3ZlcnJpZGRlbiA9IHJlbGF0aXZlVXJpLmhhc0ZyYWdtZW50KCk7XG4gIH1cblxuICBpZiAob3ZlcnJpZGRlbikge1xuICAgIGFic29sdXRlVXJpLnNldFJhd0ZyYWdtZW50KHJlbGF0aXZlVXJpLmdldFJhd0ZyYWdtZW50KCkpO1xuICB9XG5cbiAgcmV0dXJuIGFic29sdXRlVXJpO1xufVxuXG4vKipcbiAqIGEgbXV0YWJsZSBVUkkuXG4gKlxuICogVGhpcyBjbGFzcyBjb250YWlucyBzZXR0ZXJzIGFuZCBnZXR0ZXJzIGZvciB0aGUgcGFydHMgb2YgdGhlIFVSSS5cbiAqIFRoZSA8dHQ+Z2V0WFlaPC90dD4vPHR0PnNldFhZWjwvdHQ+IG1ldGhvZHMgcmV0dXJuIHRoZSBkZWNvZGVkIHBhcnQgLS0gc29cbiAqIDxjb2RlPnVyaS5wYXJzZSgnL2ZvbyUyMGJhcicpLmdldFBhdGgoKTwvY29kZT4gd2lsbCByZXR1cm4gdGhlIGRlY29kZWQgcGF0aCxcbiAqIDx0dD4vZm9vIGJhcjwvdHQ+LlxuICpcbiAqIDxwPlRoZSByYXcgdmVyc2lvbnMgb2YgZmllbGRzIGFyZSBhdmFpbGFibGUgdG9vLlxuICogPGNvZGU+dXJpLnBhcnNlKCcvZm9vJTIwYmFyJykuZ2V0UmF3UGF0aCgpPC9jb2RlPiB3aWxsIHJldHVybiB0aGUgcmF3IHBhdGgsXG4gKiA8dHQ+L2ZvbyUyMGJhcjwvdHQ+LiAgVXNlIHRoZSByYXcgc2V0dGVycyB3aXRoIGNhcmUsIHNpbmNlXG4gKiA8Y29kZT5VUkk6OnRvU3RyaW5nPC9jb2RlPiBpcyBub3QgZ3VhcmFudGVlZCB0byByZXR1cm4gYSB2YWxpZCB1cmwgaWYgYVxuICogcmF3IHNldHRlciB3YXMgdXNlZC5cbiAqXG4gKiA8cD5BbGwgc2V0dGVycyByZXR1cm4gPHR0PnRoaXM8L3R0PiBhbmQgc28gbWF5IGJlIGNoYWluZWQsIGEgbGFcbiAqIDxjb2RlPnVyaS5wYXJzZSgnL2ZvbycpLnNldEZyYWdtZW50KCdwYXJ0JykudG9TdHJpbmcoKTwvY29kZT4uXG4gKlxuICogPHA+WW91IHNob3VsZCBub3QgdXNlIHRoaXMgY29uc3RydWN0b3IgZGlyZWN0bHkgLS0gcGxlYXNlIHByZWZlciB0aGUgZmFjdG9yeVxuICogZnVuY3Rpb25zIHtAbGluayB1cmkucGFyc2V9LCB7QGxpbmsgdXJpLmNyZWF0ZX0sIHtAbGluayB1cmkucmVzb2x2ZX1cbiAqIGluc3RlYWQuPC9wPlxuICpcbiAqIDxwPlRoZSBwYXJhbWV0ZXJzIGFyZSBhbGwgcmF3IChhc3N1bWVkIHRvIGJlIHByb3Blcmx5IGVzY2FwZWQpIHBhcnRzLCBhbmRcbiAqIGFueSAoYnV0IG5vdCBhbGwpIG1heSBiZSBudWxsLiAgVW5kZWZpbmVkIGlzIG5vdCBhbGxvd2VkLjwvcD5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gVVJJKFxuICAgIHJhd1NjaGVtZSxcbiAgICByYXdDcmVkZW50aWFscywgcmF3RG9tYWluLCBwb3J0LFxuICAgIHJhd1BhdGgsIHJhd1F1ZXJ5LCByYXdGcmFnbWVudCkge1xuICB0aGlzLnNjaGVtZV8gPSByYXdTY2hlbWU7XG4gIHRoaXMuY3JlZGVudGlhbHNfID0gcmF3Q3JlZGVudGlhbHM7XG4gIHRoaXMuZG9tYWluXyA9IHJhd0RvbWFpbjtcbiAgdGhpcy5wb3J0XyA9IHBvcnQ7XG4gIHRoaXMucGF0aF8gPSByYXdQYXRoO1xuICB0aGlzLnF1ZXJ5XyA9IHJhd1F1ZXJ5O1xuICB0aGlzLmZyYWdtZW50XyA9IHJhd0ZyYWdtZW50O1xuICAvKipcbiAgICogQHR5cGUge0FycmF5fG51bGx9XG4gICAqL1xuICB0aGlzLnBhcmFtQ2FjaGVfID0gbnVsbDtcbn1cblxuLyoqIHJldHVybnMgdGhlIHN0cmluZyBmb3JtIG9mIHRoZSB1cmwuICovXG5VUkkucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb3V0ID0gW107XG4gIGlmIChudWxsICE9PSB0aGlzLnNjaGVtZV8pIHsgb3V0LnB1c2godGhpcy5zY2hlbWVfLCAnOicpOyB9XG4gIGlmIChudWxsICE9PSB0aGlzLmRvbWFpbl8pIHtcbiAgICBvdXQucHVzaCgnLy8nKTtcbiAgICBpZiAobnVsbCAhPT0gdGhpcy5jcmVkZW50aWFsc18pIHsgb3V0LnB1c2godGhpcy5jcmVkZW50aWFsc18sICdAJyk7IH1cbiAgICBvdXQucHVzaCh0aGlzLmRvbWFpbl8pO1xuICAgIGlmIChudWxsICE9PSB0aGlzLnBvcnRfKSB7IG91dC5wdXNoKCc6JywgdGhpcy5wb3J0Xy50b1N0cmluZygpKTsgfVxuICB9XG4gIGlmIChudWxsICE9PSB0aGlzLnBhdGhfKSB7IG91dC5wdXNoKHRoaXMucGF0aF8pOyB9XG4gIGlmIChudWxsICE9PSB0aGlzLnF1ZXJ5XykgeyBvdXQucHVzaCgnPycsIHRoaXMucXVlcnlfKTsgfVxuICBpZiAobnVsbCAhPT0gdGhpcy5mcmFnbWVudF8pIHsgb3V0LnB1c2goJyMnLCB0aGlzLmZyYWdtZW50Xyk7IH1cbiAgcmV0dXJuIG91dC5qb2luKCcnKTtcbn07XG5cblVSSS5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBuZXcgVVJJKHRoaXMuc2NoZW1lXywgdGhpcy5jcmVkZW50aWFsc18sIHRoaXMuZG9tYWluXywgdGhpcy5wb3J0XyxcbiAgICAgICAgICAgICAgICAgdGhpcy5wYXRoXywgdGhpcy5xdWVyeV8sIHRoaXMuZnJhZ21lbnRfKTtcbn07XG5cblVSSS5wcm90b3R5cGUuZ2V0U2NoZW1lID0gZnVuY3Rpb24gKCkge1xuICAvLyBIVE1MNSBzcGVjIGRvZXMgbm90IHJlcXVpcmUgdGhlIHNjaGVtZSB0byBiZSBsb3dlcmNhc2VkIGJ1dFxuICAvLyBhbGwgY29tbW9uIGJyb3dzZXJzIGV4Y2VwdCBTYWZhcmkgbG93ZXJjYXNlIHRoZSBzY2hlbWUuXG4gIHJldHVybiB0aGlzLnNjaGVtZV8gJiYgZGVjb2RlVVJJQ29tcG9uZW50KHRoaXMuc2NoZW1lXykudG9Mb3dlckNhc2UoKTtcbn07XG5VUkkucHJvdG90eXBlLmdldFJhd1NjaGVtZSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuc2NoZW1lXztcbn07XG5VUkkucHJvdG90eXBlLnNldFNjaGVtZSA9IGZ1bmN0aW9uIChuZXdTY2hlbWUpIHtcbiAgdGhpcy5zY2hlbWVfID0gZW5jb2RlSWZFeGlzdHMyKFxuICAgICAgbmV3U2NoZW1lLCBVUklfRElTQUxMT1dFRF9JTl9TQ0hFTUVfT1JfQ1JFREVOVElBTFNfKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuVVJJLnByb3RvdHlwZS5zZXRSYXdTY2hlbWUgPSBmdW5jdGlvbiAobmV3U2NoZW1lKSB7XG4gIHRoaXMuc2NoZW1lXyA9IG5ld1NjaGVtZSA/IG5ld1NjaGVtZSA6IG51bGw7XG4gIHJldHVybiB0aGlzO1xufTtcblVSSS5wcm90b3R5cGUuaGFzU2NoZW1lID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gbnVsbCAhPT0gdGhpcy5zY2hlbWVfO1xufTtcblxuXG5VUkkucHJvdG90eXBlLmdldENyZWRlbnRpYWxzID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5jcmVkZW50aWFsc18gJiYgZGVjb2RlVVJJQ29tcG9uZW50KHRoaXMuY3JlZGVudGlhbHNfKTtcbn07XG5VUkkucHJvdG90eXBlLmdldFJhd0NyZWRlbnRpYWxzID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5jcmVkZW50aWFsc187XG59O1xuVVJJLnByb3RvdHlwZS5zZXRDcmVkZW50aWFscyA9IGZ1bmN0aW9uIChuZXdDcmVkZW50aWFscykge1xuICB0aGlzLmNyZWRlbnRpYWxzXyA9IGVuY29kZUlmRXhpc3RzMihcbiAgICAgIG5ld0NyZWRlbnRpYWxzLCBVUklfRElTQUxMT1dFRF9JTl9TQ0hFTUVfT1JfQ1JFREVOVElBTFNfKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5VUkkucHJvdG90eXBlLnNldFJhd0NyZWRlbnRpYWxzID0gZnVuY3Rpb24gKG5ld0NyZWRlbnRpYWxzKSB7XG4gIHRoaXMuY3JlZGVudGlhbHNfID0gbmV3Q3JlZGVudGlhbHMgPyBuZXdDcmVkZW50aWFscyA6IG51bGw7XG4gIHJldHVybiB0aGlzO1xufTtcblVSSS5wcm90b3R5cGUuaGFzQ3JlZGVudGlhbHMgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBudWxsICE9PSB0aGlzLmNyZWRlbnRpYWxzXztcbn07XG5cblxuVVJJLnByb3RvdHlwZS5nZXREb21haW4gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmRvbWFpbl8gJiYgZGVjb2RlVVJJQ29tcG9uZW50KHRoaXMuZG9tYWluXyk7XG59O1xuVVJJLnByb3RvdHlwZS5nZXRSYXdEb21haW4gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmRvbWFpbl87XG59O1xuVVJJLnByb3RvdHlwZS5zZXREb21haW4gPSBmdW5jdGlvbiAobmV3RG9tYWluKSB7XG4gIHJldHVybiB0aGlzLnNldFJhd0RvbWFpbihuZXdEb21haW4gJiYgZW5jb2RlVVJJQ29tcG9uZW50KG5ld0RvbWFpbikpO1xufTtcblVSSS5wcm90b3R5cGUuc2V0UmF3RG9tYWluID0gZnVuY3Rpb24gKG5ld0RvbWFpbikge1xuICB0aGlzLmRvbWFpbl8gPSBuZXdEb21haW4gPyBuZXdEb21haW4gOiBudWxsO1xuICAvLyBNYWludGFpbiB0aGUgaW52YXJpYW50IHRoYXQgcGF0aHMgbXVzdCBzdGFydCB3aXRoIGEgc2xhc2ggd2hlbiB0aGUgVVJJXG4gIC8vIGlzIG5vdCBwYXRoLXJlbGF0aXZlLlxuICByZXR1cm4gdGhpcy5zZXRSYXdQYXRoKHRoaXMucGF0aF8pO1xufTtcblVSSS5wcm90b3R5cGUuaGFzRG9tYWluID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gbnVsbCAhPT0gdGhpcy5kb21haW5fO1xufTtcblxuXG5VUkkucHJvdG90eXBlLmdldFBvcnQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLnBvcnRfICYmIGRlY29kZVVSSUNvbXBvbmVudCh0aGlzLnBvcnRfKTtcbn07XG5VUkkucHJvdG90eXBlLnNldFBvcnQgPSBmdW5jdGlvbiAobmV3UG9ydCkge1xuICBpZiAobmV3UG9ydCkge1xuICAgIG5ld1BvcnQgPSBOdW1iZXIobmV3UG9ydCk7XG4gICAgaWYgKG5ld1BvcnQgIT09IChuZXdQb3J0ICYgMHhmZmZmKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdCYWQgcG9ydCBudW1iZXIgJyArIG5ld1BvcnQpO1xuICAgIH1cbiAgICB0aGlzLnBvcnRfID0gJycgKyBuZXdQb3J0O1xuICB9IGVsc2Uge1xuICAgIHRoaXMucG9ydF8gPSBudWxsO1xuICB9XG4gIHJldHVybiB0aGlzO1xufTtcblVSSS5wcm90b3R5cGUuaGFzUG9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIG51bGwgIT09IHRoaXMucG9ydF87XG59O1xuXG5cblVSSS5wcm90b3R5cGUuZ2V0UGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMucGF0aF8gJiYgZGVjb2RlVVJJQ29tcG9uZW50KHRoaXMucGF0aF8pO1xufTtcblVSSS5wcm90b3R5cGUuZ2V0UmF3UGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMucGF0aF87XG59O1xuVVJJLnByb3RvdHlwZS5zZXRQYXRoID0gZnVuY3Rpb24gKG5ld1BhdGgpIHtcbiAgcmV0dXJuIHRoaXMuc2V0UmF3UGF0aChlbmNvZGVJZkV4aXN0czIobmV3UGF0aCwgVVJJX0RJU0FMTE9XRURfSU5fUEFUSF8pKTtcbn07XG5VUkkucHJvdG90eXBlLnNldFJhd1BhdGggPSBmdW5jdGlvbiAobmV3UGF0aCkge1xuICBpZiAobmV3UGF0aCkge1xuICAgIG5ld1BhdGggPSBTdHJpbmcobmV3UGF0aCk7XG4gICAgdGhpcy5wYXRoXyA9IFxuICAgICAgLy8gUGF0aHMgbXVzdCBzdGFydCB3aXRoICcvJyB1bmxlc3MgdGhpcyBpcyBhIHBhdGgtcmVsYXRpdmUgVVJMLlxuICAgICAgKCF0aGlzLmRvbWFpbl8gfHwgL15cXC8vLnRlc3QobmV3UGF0aCkpID8gbmV3UGF0aCA6ICcvJyArIG5ld1BhdGg7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5wYXRoXyA9IG51bGw7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuVVJJLnByb3RvdHlwZS5oYXNQYXRoID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gbnVsbCAhPT0gdGhpcy5wYXRoXztcbn07XG5cblxuVVJJLnByb3RvdHlwZS5nZXRRdWVyeSA9IGZ1bmN0aW9uICgpIHtcbiAgLy8gRnJvbSBodHRwOi8vd3d3LnczLm9yZy9BZGRyZXNzaW5nL1VSTC80X1VSSV9SZWNvbW1lbnRhdGlvbnMuaHRtbFxuICAvLyBXaXRoaW4gdGhlIHF1ZXJ5IHN0cmluZywgdGhlIHBsdXMgc2lnbiBpcyByZXNlcnZlZCBhcyBzaG9ydGhhbmQgbm90YXRpb25cbiAgLy8gZm9yIGEgc3BhY2UuXG4gIHJldHVybiB0aGlzLnF1ZXJ5XyAmJiBkZWNvZGVVUklDb21wb25lbnQodGhpcy5xdWVyeV8pLnJlcGxhY2UoL1xcKy9nLCAnICcpO1xufTtcblVSSS5wcm90b3R5cGUuZ2V0UmF3UXVlcnkgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLnF1ZXJ5Xztcbn07XG5VUkkucHJvdG90eXBlLnNldFF1ZXJ5ID0gZnVuY3Rpb24gKG5ld1F1ZXJ5KSB7XG4gIHRoaXMucGFyYW1DYWNoZV8gPSBudWxsO1xuICB0aGlzLnF1ZXJ5XyA9IGVuY29kZUlmRXhpc3RzKG5ld1F1ZXJ5KTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuVVJJLnByb3RvdHlwZS5zZXRSYXdRdWVyeSA9IGZ1bmN0aW9uIChuZXdRdWVyeSkge1xuICB0aGlzLnBhcmFtQ2FjaGVfID0gbnVsbDtcbiAgdGhpcy5xdWVyeV8gPSBuZXdRdWVyeSA/IG5ld1F1ZXJ5IDogbnVsbDtcbiAgcmV0dXJuIHRoaXM7XG59O1xuVVJJLnByb3RvdHlwZS5oYXNRdWVyeSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIG51bGwgIT09IHRoaXMucXVlcnlfO1xufTtcblxuLyoqXG4gKiBzZXRzIHRoZSBxdWVyeSBnaXZlbiBhIGxpc3Qgb2Ygc3RyaW5ncyBvZiB0aGUgZm9ybVxuICogWyBrZXkwLCB2YWx1ZTAsIGtleTEsIHZhbHVlMSwgLi4uIF0uXG4gKlxuICogPHA+PGNvZGU+dXJpLnNldEFsbFBhcmFtZXRlcnMoWydhJywgJ2InLCAnYycsICdkJ10pLmdldFF1ZXJ5KCk8L2NvZGU+XG4gKiB3aWxsIHlpZWxkIDxjb2RlPidhPWImYz1kJzwvY29kZT4uXG4gKi9cblVSSS5wcm90b3R5cGUuc2V0QWxsUGFyYW1ldGVycyA9IGZ1bmN0aW9uIChwYXJhbXMpIHtcbiAgaWYgKHR5cGVvZiBwYXJhbXMgPT09ICdvYmplY3QnKSB7XG4gICAgaWYgKCEocGFyYW1zIGluc3RhbmNlb2YgQXJyYXkpXG4gICAgICAgICYmIChwYXJhbXMgaW5zdGFuY2VvZiBPYmplY3RcbiAgICAgICAgICAgIHx8IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChwYXJhbXMpICE9PSAnW29iamVjdCBBcnJheV0nKSkge1xuICAgICAgdmFyIG5ld1BhcmFtcyA9IFtdO1xuICAgICAgdmFyIGkgPSAtMTtcbiAgICAgIGZvciAodmFyIGsgaW4gcGFyYW1zKSB7XG4gICAgICAgIHZhciB2ID0gcGFyYW1zW2tdO1xuICAgICAgICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiB2KSB7XG4gICAgICAgICAgbmV3UGFyYW1zWysraV0gPSBrO1xuICAgICAgICAgIG5ld1BhcmFtc1srK2ldID0gdjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcGFyYW1zID0gbmV3UGFyYW1zO1xuICAgIH1cbiAgfVxuICB0aGlzLnBhcmFtQ2FjaGVfID0gbnVsbDtcbiAgdmFyIHF1ZXJ5QnVmID0gW107XG4gIHZhciBzZXBhcmF0b3IgPSAnJztcbiAgZm9yICh2YXIgaiA9IDA7IGogPCBwYXJhbXMubGVuZ3RoOykge1xuICAgIHZhciBrID0gcGFyYW1zW2orK107XG4gICAgdmFyIHYgPSBwYXJhbXNbaisrXTtcbiAgICBxdWVyeUJ1Zi5wdXNoKHNlcGFyYXRvciwgZW5jb2RlVVJJQ29tcG9uZW50KGsudG9TdHJpbmcoKSkpO1xuICAgIHNlcGFyYXRvciA9ICcmJztcbiAgICBpZiAodikge1xuICAgICAgcXVlcnlCdWYucHVzaCgnPScsIGVuY29kZVVSSUNvbXBvbmVudCh2LnRvU3RyaW5nKCkpKTtcbiAgICB9XG4gIH1cbiAgdGhpcy5xdWVyeV8gPSBxdWVyeUJ1Zi5qb2luKCcnKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuVVJJLnByb3RvdHlwZS5jaGVja1BhcmFtZXRlckNhY2hlXyA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKCF0aGlzLnBhcmFtQ2FjaGVfKSB7XG4gICAgdmFyIHEgPSB0aGlzLnF1ZXJ5XztcbiAgICBpZiAoIXEpIHtcbiAgICAgIHRoaXMucGFyYW1DYWNoZV8gPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGNnaVBhcmFtcyA9IHEuc3BsaXQoL1smXFw/XS8pO1xuICAgICAgdmFyIG91dCA9IFtdO1xuICAgICAgdmFyIGsgPSAtMTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2dpUGFyYW1zLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBtID0gY2dpUGFyYW1zW2ldLm1hdGNoKC9eKFtePV0qKSg/Oj0oLiopKT8kLyk7XG4gICAgICAgIC8vIEZyb20gaHR0cDovL3d3dy53My5vcmcvQWRkcmVzc2luZy9VUkwvNF9VUklfUmVjb21tZW50YXRpb25zLmh0bWxcbiAgICAgICAgLy8gV2l0aGluIHRoZSBxdWVyeSBzdHJpbmcsIHRoZSBwbHVzIHNpZ24gaXMgcmVzZXJ2ZWQgYXMgc2hvcnRoYW5kXG4gICAgICAgIC8vIG5vdGF0aW9uIGZvciBhIHNwYWNlLlxuICAgICAgICBvdXRbKytrXSA9IGRlY29kZVVSSUNvbXBvbmVudChtWzFdKS5yZXBsYWNlKC9cXCsvZywgJyAnKTtcbiAgICAgICAgb3V0Wysra10gPSBkZWNvZGVVUklDb21wb25lbnQobVsyXSB8fCAnJykucmVwbGFjZSgvXFwrL2csICcgJyk7XG4gICAgICB9XG4gICAgICB0aGlzLnBhcmFtQ2FjaGVfID0gb3V0O1xuICAgIH1cbiAgfVxufTtcbi8qKlxuICogc2V0cyB0aGUgdmFsdWVzIG9mIHRoZSBuYW1lZCBjZ2kgcGFyYW1ldGVycy5cbiAqXG4gKiA8cD5TbywgPGNvZGU+dXJpLnBhcnNlKCdmb28/YT1iJmM9ZCZlPWYnKS5zZXRQYXJhbWV0ZXJWYWx1ZXMoJ2MnLCBbJ25ldyddKVxuICogPC9jb2RlPiB5aWVsZHMgPHR0PmZvbz9hPWImYz1uZXcmZT1mPC90dD4uPC9wPlxuICpcbiAqIEBwYXJhbSBrZXkge3N0cmluZ31cbiAqIEBwYXJhbSB2YWx1ZXMge0FycmF5LjxzdHJpbmc+fSB0aGUgbmV3IHZhbHVlcy4gIElmIHZhbHVlcyBpcyBhIHNpbmdsZSBzdHJpbmdcbiAqICAgdGhlbiBpdCB3aWxsIGJlIHRyZWF0ZWQgYXMgdGhlIHNvbGUgdmFsdWUuXG4gKi9cblVSSS5wcm90b3R5cGUuc2V0UGFyYW1ldGVyVmFsdWVzID0gZnVuY3Rpb24gKGtleSwgdmFsdWVzKSB7XG4gIC8vIGJlIG5pY2UgYW5kIGF2b2lkIHN1YnRsZSBidWdzIHdoZXJlIFtdIG9wZXJhdG9yIG9uIHN0cmluZyBwZXJmb3JtcyBjaGFyQXRcbiAgLy8gb24gc29tZSBicm93c2VycyBhbmQgY3Jhc2hlcyBvbiBJRVxuICBpZiAodHlwZW9mIHZhbHVlcyA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWx1ZXMgPSBbIHZhbHVlcyBdO1xuICB9XG5cbiAgdGhpcy5jaGVja1BhcmFtZXRlckNhY2hlXygpO1xuICB2YXIgbmV3VmFsdWVJbmRleCA9IDA7XG4gIHZhciBwYyA9IHRoaXMucGFyYW1DYWNoZV87XG4gIHZhciBwYXJhbXMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDAsIGsgPSAwOyBpIDwgcGMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICBpZiAoa2V5ID09PSBwY1tpXSkge1xuICAgICAgaWYgKG5ld1ZhbHVlSW5kZXggPCB2YWx1ZXMubGVuZ3RoKSB7XG4gICAgICAgIHBhcmFtcy5wdXNoKGtleSwgdmFsdWVzW25ld1ZhbHVlSW5kZXgrK10pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbXMucHVzaChwY1tpXSwgcGNbaSArIDFdKTtcbiAgICB9XG4gIH1cbiAgd2hpbGUgKG5ld1ZhbHVlSW5kZXggPCB2YWx1ZXMubGVuZ3RoKSB7XG4gICAgcGFyYW1zLnB1c2goa2V5LCB2YWx1ZXNbbmV3VmFsdWVJbmRleCsrXSk7XG4gIH1cbiAgdGhpcy5zZXRBbGxQYXJhbWV0ZXJzKHBhcmFtcyk7XG4gIHJldHVybiB0aGlzO1xufTtcblVSSS5wcm90b3R5cGUucmVtb3ZlUGFyYW1ldGVyID0gZnVuY3Rpb24gKGtleSkge1xuICByZXR1cm4gdGhpcy5zZXRQYXJhbWV0ZXJWYWx1ZXMoa2V5LCBbXSk7XG59O1xuLyoqXG4gKiByZXR1cm5zIHRoZSBwYXJhbWV0ZXJzIHNwZWNpZmllZCBpbiB0aGUgcXVlcnkgcGFydCBvZiB0aGUgdXJpIGFzIGEgbGlzdCBvZlxuICoga2V5cyBhbmQgdmFsdWVzIGxpa2UgWyBrZXkwLCB2YWx1ZTAsIGtleTEsIHZhbHVlMSwgLi4uIF0uXG4gKlxuICogQHJldHVybiB7QXJyYXkuPHN0cmluZz59XG4gKi9cblVSSS5wcm90b3R5cGUuZ2V0QWxsUGFyYW1ldGVycyA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5jaGVja1BhcmFtZXRlckNhY2hlXygpO1xuICByZXR1cm4gdGhpcy5wYXJhbUNhY2hlXy5zbGljZSgwLCB0aGlzLnBhcmFtQ2FjaGVfLmxlbmd0aCk7XG59O1xuLyoqXG4gKiByZXR1cm5zIHRoZSB2YWx1ZTxiPnM8L2I+IGZvciBhIGdpdmVuIGNnaSBwYXJhbWV0ZXIgYXMgYSBsaXN0IG9mIGRlY29kZWRcbiAqIHF1ZXJ5IHBhcmFtZXRlciB2YWx1ZXMuXG4gKiBAcmV0dXJuIHtBcnJheS48c3RyaW5nPn1cbiAqL1xuVVJJLnByb3RvdHlwZS5nZXRQYXJhbWV0ZXJWYWx1ZXMgPSBmdW5jdGlvbiAocGFyYW1OYW1lVW5lc2NhcGVkKSB7XG4gIHRoaXMuY2hlY2tQYXJhbWV0ZXJDYWNoZV8oKTtcbiAgdmFyIHZhbHVlcyA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucGFyYW1DYWNoZV8ubGVuZ3RoOyBpICs9IDIpIHtcbiAgICBpZiAocGFyYW1OYW1lVW5lc2NhcGVkID09PSB0aGlzLnBhcmFtQ2FjaGVfW2ldKSB7XG4gICAgICB2YWx1ZXMucHVzaCh0aGlzLnBhcmFtQ2FjaGVfW2kgKyAxXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiB2YWx1ZXM7XG59O1xuLyoqXG4gKiByZXR1cm5zIGEgbWFwIG9mIGNnaSBwYXJhbWV0ZXIgbmFtZXMgdG8gKG5vbi1lbXB0eSkgbGlzdHMgb2YgdmFsdWVzLlxuICogQHJldHVybiB7T2JqZWN0LjxzdHJpbmcsQXJyYXkuPHN0cmluZz4+fVxuICovXG5VUkkucHJvdG90eXBlLmdldFBhcmFtZXRlck1hcCA9IGZ1bmN0aW9uIChwYXJhbU5hbWVVbmVzY2FwZWQpIHtcbiAgdGhpcy5jaGVja1BhcmFtZXRlckNhY2hlXygpO1xuICB2YXIgcGFyYW1NYXAgPSB7fTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnBhcmFtQ2FjaGVfLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgdmFyIGtleSA9IHRoaXMucGFyYW1DYWNoZV9baSsrXSxcbiAgICAgIHZhbHVlID0gdGhpcy5wYXJhbUNhY2hlX1tpKytdO1xuICAgIGlmICghKGtleSBpbiBwYXJhbU1hcCkpIHtcbiAgICAgIHBhcmFtTWFwW2tleV0gPSBbdmFsdWVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbU1hcFtrZXldLnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcGFyYW1NYXA7XG59O1xuLyoqXG4gKiByZXR1cm5zIHRoZSBmaXJzdCB2YWx1ZSBmb3IgYSBnaXZlbiBjZ2kgcGFyYW1ldGVyIG9yIG51bGwgaWYgdGhlIGdpdmVuXG4gKiBwYXJhbWV0ZXIgbmFtZSBkb2VzIG5vdCBhcHBlYXIgaW4gdGhlIHF1ZXJ5IHN0cmluZy5cbiAqIElmIHRoZSBnaXZlbiBwYXJhbWV0ZXIgbmFtZSBkb2VzIGFwcGVhciwgYnV0IGhhcyBubyAnPHR0Pj08L3R0PicgZm9sbG93aW5nXG4gKiBpdCwgdGhlbiB0aGUgZW1wdHkgc3RyaW5nIHdpbGwgYmUgcmV0dXJuZWQuXG4gKiBAcmV0dXJuIHtzdHJpbmd8bnVsbH1cbiAqL1xuVVJJLnByb3RvdHlwZS5nZXRQYXJhbWV0ZXJWYWx1ZSA9IGZ1bmN0aW9uIChwYXJhbU5hbWVVbmVzY2FwZWQpIHtcbiAgdGhpcy5jaGVja1BhcmFtZXRlckNhY2hlXygpO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucGFyYW1DYWNoZV8ubGVuZ3RoOyBpICs9IDIpIHtcbiAgICBpZiAocGFyYW1OYW1lVW5lc2NhcGVkID09PSB0aGlzLnBhcmFtQ2FjaGVfW2ldKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJhbUNhY2hlX1tpICsgMV07XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufTtcblxuVVJJLnByb3RvdHlwZS5nZXRGcmFnbWVudCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuZnJhZ21lbnRfICYmIGRlY29kZVVSSUNvbXBvbmVudCh0aGlzLmZyYWdtZW50Xyk7XG59O1xuVVJJLnByb3RvdHlwZS5nZXRSYXdGcmFnbWVudCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuZnJhZ21lbnRfO1xufTtcblVSSS5wcm90b3R5cGUuc2V0RnJhZ21lbnQgPSBmdW5jdGlvbiAobmV3RnJhZ21lbnQpIHtcbiAgdGhpcy5mcmFnbWVudF8gPSBuZXdGcmFnbWVudCA/IGVuY29kZVVSSUNvbXBvbmVudChuZXdGcmFnbWVudCkgOiBudWxsO1xuICByZXR1cm4gdGhpcztcbn07XG5VUkkucHJvdG90eXBlLnNldFJhd0ZyYWdtZW50ID0gZnVuY3Rpb24gKG5ld0ZyYWdtZW50KSB7XG4gIHRoaXMuZnJhZ21lbnRfID0gbmV3RnJhZ21lbnQgPyBuZXdGcmFnbWVudCA6IG51bGw7XG4gIHJldHVybiB0aGlzO1xufTtcblVSSS5wcm90b3R5cGUuaGFzRnJhZ21lbnQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBudWxsICE9PSB0aGlzLmZyYWdtZW50Xztcbn07XG5cbmZ1bmN0aW9uIG51bGxJZkFic2VudChtYXRjaFBhcnQpIHtcbiAgcmV0dXJuICgnc3RyaW5nJyA9PSB0eXBlb2YgbWF0Y2hQYXJ0KSAmJiAobWF0Y2hQYXJ0Lmxlbmd0aCA+IDApXG4gICAgICAgICA/IG1hdGNoUGFydFxuICAgICAgICAgOiBudWxsO1xufVxuXG5cblxuXG4vKipcbiAqIGEgcmVndWxhciBleHByZXNzaW9uIGZvciBicmVha2luZyBhIFVSSSBpbnRvIGl0cyBjb21wb25lbnQgcGFydHMuXG4gKlxuICogPHA+aHR0cDovL3d3dy5nYml2LmNvbS9wcm90b2NvbHMvdXJpL3JmYy9yZmMzOTg2Lmh0bWwjUkZDMjIzNCBzYXlzXG4gKiBBcyB0aGUgXCJmaXJzdC1tYXRjaC13aW5zXCIgYWxnb3JpdGhtIGlzIGlkZW50aWNhbCB0byB0aGUgXCJncmVlZHlcIlxuICogZGlzYW1iaWd1YXRpb24gbWV0aG9kIHVzZWQgYnkgUE9TSVggcmVndWxhciBleHByZXNzaW9ucywgaXQgaXMgbmF0dXJhbCBhbmRcbiAqIGNvbW1vbnBsYWNlIHRvIHVzZSBhIHJlZ3VsYXIgZXhwcmVzc2lvbiBmb3IgcGFyc2luZyB0aGUgcG90ZW50aWFsIGZpdmVcbiAqIGNvbXBvbmVudHMgb2YgYSBVUkkgcmVmZXJlbmNlLlxuICpcbiAqIDxwPlRoZSBmb2xsb3dpbmcgbGluZSBpcyB0aGUgcmVndWxhciBleHByZXNzaW9uIGZvciBicmVha2luZy1kb3duIGFcbiAqIHdlbGwtZm9ybWVkIFVSSSByZWZlcmVuY2UgaW50byBpdHMgY29tcG9uZW50cy5cbiAqXG4gKiA8cHJlPlxuICogXigoW146Lz8jXSspOik/KC8vKFteLz8jXSopKT8oW14/I10qKShcXD8oW14jXSopKT8oIyguKikpP1xuICogIDEyICAgICAgICAgICAgMyAgNCAgICAgICAgICA1ICAgICAgIDYgIDcgICAgICAgIDggOVxuICogPC9wcmU+XG4gKlxuICogPHA+VGhlIG51bWJlcnMgaW4gdGhlIHNlY29uZCBsaW5lIGFib3ZlIGFyZSBvbmx5IHRvIGFzc2lzdCByZWFkYWJpbGl0eTsgdGhleVxuICogaW5kaWNhdGUgdGhlIHJlZmVyZW5jZSBwb2ludHMgZm9yIGVhY2ggc3ViZXhwcmVzc2lvbiAoaS5lLiwgZWFjaCBwYWlyZWRcbiAqIHBhcmVudGhlc2lzKS4gV2UgcmVmZXIgdG8gdGhlIHZhbHVlIG1hdGNoZWQgZm9yIHN1YmV4cHJlc3Npb24gPG4+IGFzICQ8bj4uXG4gKiBGb3IgZXhhbXBsZSwgbWF0Y2hpbmcgdGhlIGFib3ZlIGV4cHJlc3Npb24gdG9cbiAqIDxwcmU+XG4gKiAgICAgaHR0cDovL3d3dy5pY3MudWNpLmVkdS9wdWIvaWV0Zi91cmkvI1JlbGF0ZWRcbiAqIDwvcHJlPlxuICogcmVzdWx0cyBpbiB0aGUgZm9sbG93aW5nIHN1YmV4cHJlc3Npb24gbWF0Y2hlczpcbiAqIDxwcmU+XG4gKiAgICAkMSA9IGh0dHA6XG4gKiAgICAkMiA9IGh0dHBcbiAqICAgICQzID0gLy93d3cuaWNzLnVjaS5lZHVcbiAqICAgICQ0ID0gd3d3Lmljcy51Y2kuZWR1XG4gKiAgICAkNSA9IC9wdWIvaWV0Zi91cmkvXG4gKiAgICAkNiA9IDx1bmRlZmluZWQ+XG4gKiAgICAkNyA9IDx1bmRlZmluZWQ+XG4gKiAgICAkOCA9ICNSZWxhdGVkXG4gKiAgICAkOSA9IFJlbGF0ZWRcbiAqIDwvcHJlPlxuICogd2hlcmUgPHVuZGVmaW5lZD4gaW5kaWNhdGVzIHRoYXQgdGhlIGNvbXBvbmVudCBpcyBub3QgcHJlc2VudCwgYXMgaXMgdGhlXG4gKiBjYXNlIGZvciB0aGUgcXVlcnkgY29tcG9uZW50IGluIHRoZSBhYm92ZSBleGFtcGxlLiBUaGVyZWZvcmUsIHdlIGNhblxuICogZGV0ZXJtaW5lIHRoZSB2YWx1ZSBvZiB0aGUgZml2ZSBjb21wb25lbnRzIGFzXG4gKiA8cHJlPlxuICogICAgc2NoZW1lICAgID0gJDJcbiAqICAgIGF1dGhvcml0eSA9ICQ0XG4gKiAgICBwYXRoICAgICAgPSAkNVxuICogICAgcXVlcnkgICAgID0gJDdcbiAqICAgIGZyYWdtZW50ICA9ICQ5XG4gKiA8L3ByZT5cbiAqXG4gKiA8cD5tc2FtdWVsOiBJIGhhdmUgbW9kaWZpZWQgdGhlIHJlZ3VsYXIgZXhwcmVzc2lvbiBzbGlnaHRseSB0byBleHBvc2UgdGhlXG4gKiBjcmVkZW50aWFscywgZG9tYWluLCBhbmQgcG9ydCBzZXBhcmF0ZWx5IGZyb20gdGhlIGF1dGhvcml0eS5cbiAqIFRoZSBtb2RpZmllZCB2ZXJzaW9uIHlpZWxkc1xuICogPHByZT5cbiAqICAgICQxID0gaHR0cCAgICAgICAgICAgICAgc2NoZW1lXG4gKiAgICAkMiA9IDx1bmRlZmluZWQ+ICAgICAgIGNyZWRlbnRpYWxzIC1cXFxuICogICAgJDMgPSB3d3cuaWNzLnVjaS5lZHUgICBkb21haW4gICAgICAgfCBhdXRob3JpdHlcbiAqICAgICQ0ID0gPHVuZGVmaW5lZD4gICAgICAgcG9ydCAgICAgICAgLS9cbiAqICAgICQ1ID0gL3B1Yi9pZXRmL3VyaS8gICAgcGF0aFxuICogICAgJDYgPSA8dW5kZWZpbmVkPiAgICAgICBxdWVyeSB3aXRob3V0ID9cbiAqICAgICQ3ID0gUmVsYXRlZCAgICAgICAgICAgZnJhZ21lbnQgd2l0aG91dCAjXG4gKiA8L3ByZT5cbiAqL1xudmFyIFVSSV9SRV8gPSBuZXcgUmVnRXhwKFxuICAgICAgXCJeXCIgK1xuICAgICAgXCIoPzpcIiArXG4gICAgICAgIFwiKFteOi8/I10rKVwiICsgICAgICAgICAvLyBzY2hlbWVcbiAgICAgIFwiOik/XCIgK1xuICAgICAgXCIoPzovL1wiICtcbiAgICAgICAgXCIoPzooW14vPyNdKilAKT9cIiArICAgIC8vIGNyZWRlbnRpYWxzXG4gICAgICAgIFwiKFteLz8jOkBdKilcIiArICAgICAgICAvLyBkb21haW5cbiAgICAgICAgXCIoPzo6KFswLTldKykpP1wiICsgICAgIC8vIHBvcnRcbiAgICAgIFwiKT9cIiArXG4gICAgICBcIihbXj8jXSspP1wiICsgICAgICAgICAgICAvLyBwYXRoXG4gICAgICBcIig/OlxcXFw/KFteI10qKSk/XCIgKyAgICAgIC8vIHF1ZXJ5XG4gICAgICBcIig/OiMoLiopKT9cIiArICAgICAgICAgICAvLyBmcmFnbWVudFxuICAgICAgXCIkXCJcbiAgICAgICk7XG5cbnZhciBVUklfRElTQUxMT1dFRF9JTl9TQ0hFTUVfT1JfQ1JFREVOVElBTFNfID0gL1sjXFwvXFw/QF0vZztcbnZhciBVUklfRElTQUxMT1dFRF9JTl9QQVRIXyA9IC9bXFwjXFw/XS9nO1xuXG5VUkkucGFyc2UgPSBwYXJzZTtcblVSSS5jcmVhdGUgPSBjcmVhdGU7XG5VUkkucmVzb2x2ZSA9IHJlc29sdmU7XG5VUkkuY29sbGFwc2VfZG90cyA9IGNvbGxhcHNlX2RvdHM7ICAvLyBWaXNpYmxlIGZvciB0ZXN0aW5nLlxuXG4vLyBsaWdodHdlaWdodCBzdHJpbmctYmFzZWQgYXBpIGZvciBsb2FkTW9kdWxlTWFrZXJcblVSSS51dGlscyA9IHtcbiAgbWltZVR5cGVPZjogZnVuY3Rpb24gKHVyaSkge1xuICAgIHZhciB1cmlPYmogPSBwYXJzZSh1cmkpO1xuICAgIGlmICgvXFwuaHRtbCQvLnRlc3QodXJpT2JqLmdldFBhdGgoKSkpIHtcbiAgICAgIHJldHVybiAndGV4dC9odG1sJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JztcbiAgICB9XG4gIH0sXG4gIHJlc29sdmU6IGZ1bmN0aW9uIChiYXNlLCB1cmkpIHtcbiAgICBpZiAoYmFzZSkge1xuICAgICAgcmV0dXJuIHJlc29sdmUocGFyc2UoYmFzZSksIHBhcnNlKHVyaSkpLnRvU3RyaW5nKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAnJyArIHVyaTtcbiAgICB9XG4gIH1cbn07XG5cblxucmV0dXJuIFVSSTtcbn0pKCk7XG5cbi8vIENvcHlyaWdodCBHb29nbGUgSW5jLlxuLy8gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbmNlIFZlcnNpb24gMi4wXG4vLyBBdXRvZ2VuZXJhdGVkIGF0IE1vbiBGZWIgMjUgMTM6MDU6NDIgRVNUIDIwMTNcbi8vIEBvdmVycmlkZXMgd2luZG93XG4vLyBAcHJvdmlkZXMgaHRtbDRcbnZhciBodG1sNCA9IHt9O1xuaHRtbDQuYXR5cGUgPSB7XG4gICdOT05FJzogMCxcbiAgJ1VSSSc6IDEsXG4gICdVUklfRlJBR01FTlQnOiAxMSxcbiAgJ1NDUklQVCc6IDIsXG4gICdTVFlMRSc6IDMsXG4gICdIVE1MJzogMTIsXG4gICdJRCc6IDQsXG4gICdJRFJFRic6IDUsXG4gICdJRFJFRlMnOiA2LFxuICAnR0xPQkFMX05BTUUnOiA3LFxuICAnTE9DQUxfTkFNRSc6IDgsXG4gICdDTEFTU0VTJzogOSxcbiAgJ0ZSQU1FX1RBUkdFVCc6IDEwLFxuICAnTUVESUFfUVVFUlknOiAxM1xufTtcbmh0bWw0WyAnYXR5cGUnIF0gPSBodG1sNC5hdHlwZTtcbmh0bWw0LkFUVFJJQlMgPSB7XG4gICcqOjpjbGFzcyc6IDksXG4gICcqOjpkaXInOiAwLFxuICAnKjo6ZHJhZ2dhYmxlJzogMCxcbiAgJyo6OmhpZGRlbic6IDAsXG4gICcqOjppZCc6IDQsXG4gICcqOjppbmVydCc6IDAsXG4gICcqOjppdGVtcHJvcCc6IDAsXG4gICcqOjppdGVtcmVmJzogNixcbiAgJyo6Oml0ZW1zY29wZSc6IDAsXG4gICcqOjpsYW5nJzogMCxcbiAgJyo6Om9uYmx1cic6IDIsXG4gICcqOjpvbmNoYW5nZSc6IDIsXG4gICcqOjpvbmNsaWNrJzogMixcbiAgJyo6Om9uZGJsY2xpY2snOiAyLFxuICAnKjo6b25mb2N1cyc6IDIsXG4gICcqOjpvbmtleWRvd24nOiAyLFxuICAnKjo6b25rZXlwcmVzcyc6IDIsXG4gICcqOjpvbmtleXVwJzogMixcbiAgJyo6Om9ubG9hZCc6IDIsXG4gICcqOjpvbm1vdXNlZG93bic6IDIsXG4gICcqOjpvbm1vdXNlbW92ZSc6IDIsXG4gICcqOjpvbm1vdXNlb3V0JzogMixcbiAgJyo6Om9ubW91c2VvdmVyJzogMixcbiAgJyo6Om9ubW91c2V1cCc6IDIsXG4gICcqOjpvbnJlc2V0JzogMixcbiAgJyo6Om9uc2Nyb2xsJzogMixcbiAgJyo6Om9uc2VsZWN0JzogMixcbiAgJyo6Om9uc3VibWl0JzogMixcbiAgJyo6Om9udW5sb2FkJzogMixcbiAgJyo6OnNwZWxsY2hlY2snOiAwLFxuICAnKjo6c3R5bGUnOiAzLFxuICAnKjo6dGl0bGUnOiAwLFxuICAnKjo6dHJhbnNsYXRlJzogMCxcbiAgJ2E6OmFjY2Vzc2tleSc6IDAsXG4gICdhOjpjb29yZHMnOiAwLFxuICAnYTo6aHJlZic6IDEsXG4gICdhOjpocmVmbGFuZyc6IDAsXG4gICdhOjpuYW1lJzogNyxcbiAgJ2E6Om9uYmx1cic6IDIsXG4gICdhOjpvbmZvY3VzJzogMixcbiAgJ2E6OnNoYXBlJzogMCxcbiAgJ2E6OnRhYmluZGV4JzogMCxcbiAgJ2E6OnRhcmdldCc6IDEwLFxuICAnYTo6dHlwZSc6IDAsXG4gICdhcmVhOjphY2Nlc3NrZXknOiAwLFxuICAnYXJlYTo6YWx0JzogMCxcbiAgJ2FyZWE6OmNvb3Jkcyc6IDAsXG4gICdhcmVhOjpocmVmJzogMSxcbiAgJ2FyZWE6Om5vaHJlZic6IDAsXG4gICdhcmVhOjpvbmJsdXInOiAyLFxuICAnYXJlYTo6b25mb2N1cyc6IDIsXG4gICdhcmVhOjpzaGFwZSc6IDAsXG4gICdhcmVhOjp0YWJpbmRleCc6IDAsXG4gICdhcmVhOjp0YXJnZXQnOiAxMCxcbiAgJ2F1ZGlvOjpjb250cm9scyc6IDAsXG4gICdhdWRpbzo6bG9vcCc6IDAsXG4gICdhdWRpbzo6bWVkaWFncm91cCc6IDUsXG4gICdhdWRpbzo6bXV0ZWQnOiAwLFxuICAnYXVkaW86OnByZWxvYWQnOiAwLFxuICAnYmRvOjpkaXInOiAwLFxuICAnYmxvY2txdW90ZTo6Y2l0ZSc6IDEsXG4gICdicjo6Y2xlYXInOiAwLFxuICAnYnV0dG9uOjphY2Nlc3NrZXknOiAwLFxuICAnYnV0dG9uOjpkaXNhYmxlZCc6IDAsXG4gICdidXR0b246Om5hbWUnOiA4LFxuICAnYnV0dG9uOjpvbmJsdXInOiAyLFxuICAnYnV0dG9uOjpvbmZvY3VzJzogMixcbiAgJ2J1dHRvbjo6dGFiaW5kZXgnOiAwLFxuICAnYnV0dG9uOjp0eXBlJzogMCxcbiAgJ2J1dHRvbjo6dmFsdWUnOiAwLFxuICAnY2FudmFzOjpoZWlnaHQnOiAwLFxuICAnY2FudmFzOjp3aWR0aCc6IDAsXG4gICdjYXB0aW9uOjphbGlnbic6IDAsXG4gICdjb2w6OmFsaWduJzogMCxcbiAgJ2NvbDo6Y2hhcic6IDAsXG4gICdjb2w6OmNoYXJvZmYnOiAwLFxuICAnY29sOjpzcGFuJzogMCxcbiAgJ2NvbDo6dmFsaWduJzogMCxcbiAgJ2NvbDo6d2lkdGgnOiAwLFxuICAnY29sZ3JvdXA6OmFsaWduJzogMCxcbiAgJ2NvbGdyb3VwOjpjaGFyJzogMCxcbiAgJ2NvbGdyb3VwOjpjaGFyb2ZmJzogMCxcbiAgJ2NvbGdyb3VwOjpzcGFuJzogMCxcbiAgJ2NvbGdyb3VwOjp2YWxpZ24nOiAwLFxuICAnY29sZ3JvdXA6OndpZHRoJzogMCxcbiAgJ2NvbW1hbmQ6OmNoZWNrZWQnOiAwLFxuICAnY29tbWFuZDo6Y29tbWFuZCc6IDUsXG4gICdjb21tYW5kOjpkaXNhYmxlZCc6IDAsXG4gICdjb21tYW5kOjppY29uJzogMSxcbiAgJ2NvbW1hbmQ6OmxhYmVsJzogMCxcbiAgJ2NvbW1hbmQ6OnJhZGlvZ3JvdXAnOiAwLFxuICAnY29tbWFuZDo6dHlwZSc6IDAsXG4gICdkYXRhOjp2YWx1ZSc6IDAsXG4gICdkZWw6OmNpdGUnOiAxLFxuICAnZGVsOjpkYXRldGltZSc6IDAsXG4gICdkZXRhaWxzOjpvcGVuJzogMCxcbiAgJ2Rpcjo6Y29tcGFjdCc6IDAsXG4gICdkaXY6OmFsaWduJzogMCxcbiAgJ2RsOjpjb21wYWN0JzogMCxcbiAgJ2ZpZWxkc2V0OjpkaXNhYmxlZCc6IDAsXG4gICdmb250Ojpjb2xvcic6IDAsXG4gICdmb250OjpmYWNlJzogMCxcbiAgJ2ZvbnQ6OnNpemUnOiAwLFxuICAnZm9ybTo6YWNjZXB0JzogMCxcbiAgJ2Zvcm06OmFjdGlvbic6IDEsXG4gICdmb3JtOjphdXRvY29tcGxldGUnOiAwLFxuICAnZm9ybTo6ZW5jdHlwZSc6IDAsXG4gICdmb3JtOjptZXRob2QnOiAwLFxuICAnZm9ybTo6bmFtZSc6IDcsXG4gICdmb3JtOjpub3ZhbGlkYXRlJzogMCxcbiAgJ2Zvcm06Om9ucmVzZXQnOiAyLFxuICAnZm9ybTo6b25zdWJtaXQnOiAyLFxuICAnZm9ybTo6dGFyZ2V0JzogMTAsXG4gICdoMTo6YWxpZ24nOiAwLFxuICAnaDI6OmFsaWduJzogMCxcbiAgJ2gzOjphbGlnbic6IDAsXG4gICdoNDo6YWxpZ24nOiAwLFxuICAnaDU6OmFsaWduJzogMCxcbiAgJ2g2OjphbGlnbic6IDAsXG4gICdocjo6YWxpZ24nOiAwLFxuICAnaHI6Om5vc2hhZGUnOiAwLFxuICAnaHI6OnNpemUnOiAwLFxuICAnaHI6OndpZHRoJzogMCxcbiAgJ2lmcmFtZTo6YWxpZ24nOiAwLFxuICAnaWZyYW1lOjpmcmFtZWJvcmRlcic6IDAsXG4gICdpZnJhbWU6OmhlaWdodCc6IDAsXG4gICdpZnJhbWU6Om1hcmdpbmhlaWdodCc6IDAsXG4gICdpZnJhbWU6Om1hcmdpbndpZHRoJzogMCxcbiAgJ2lmcmFtZTo6d2lkdGgnOiAwLFxuICAnaW1nOjphbGlnbic6IDAsXG4gICdpbWc6OmFsdCc6IDAsXG4gICdpbWc6OmJvcmRlcic6IDAsXG4gICdpbWc6OmhlaWdodCc6IDAsXG4gICdpbWc6OmhzcGFjZSc6IDAsXG4gICdpbWc6OmlzbWFwJzogMCxcbiAgJ2ltZzo6bmFtZSc6IDcsXG4gICdpbWc6OnNyYyc6IDEsXG4gICdpbWc6OnVzZW1hcCc6IDExLFxuICAnaW1nOjp2c3BhY2UnOiAwLFxuICAnaW1nOjp3aWR0aCc6IDAsXG4gICdpbnB1dDo6YWNjZXB0JzogMCxcbiAgJ2lucHV0OjphY2Nlc3NrZXknOiAwLFxuICAnaW5wdXQ6OmFsaWduJzogMCxcbiAgJ2lucHV0OjphbHQnOiAwLFxuICAnaW5wdXQ6OmF1dG9jb21wbGV0ZSc6IDAsXG4gICdpbnB1dDo6Y2hlY2tlZCc6IDAsXG4gICdpbnB1dDo6ZGlzYWJsZWQnOiAwLFxuICAnaW5wdXQ6OmlucHV0bW9kZSc6IDAsXG4gICdpbnB1dDo6aXNtYXAnOiAwLFxuICAnaW5wdXQ6Omxpc3QnOiA1LFxuICAnaW5wdXQ6Om1heCc6IDAsXG4gICdpbnB1dDo6bWF4bGVuZ3RoJzogMCxcbiAgJ2lucHV0OjptaW4nOiAwLFxuICAnaW5wdXQ6Om11bHRpcGxlJzogMCxcbiAgJ2lucHV0OjpuYW1lJzogOCxcbiAgJ2lucHV0OjpvbmJsdXInOiAyLFxuICAnaW5wdXQ6Om9uY2hhbmdlJzogMixcbiAgJ2lucHV0OjpvbmZvY3VzJzogMixcbiAgJ2lucHV0OjpvbnNlbGVjdCc6IDIsXG4gICdpbnB1dDo6cGxhY2Vob2xkZXInOiAwLFxuICAnaW5wdXQ6OnJlYWRvbmx5JzogMCxcbiAgJ2lucHV0OjpyZXF1aXJlZCc6IDAsXG4gICdpbnB1dDo6c2l6ZSc6IDAsXG4gICdpbnB1dDo6c3JjJzogMSxcbiAgJ2lucHV0OjpzdGVwJzogMCxcbiAgJ2lucHV0Ojp0YWJpbmRleCc6IDAsXG4gICdpbnB1dDo6dHlwZSc6IDAsXG4gICdpbnB1dDo6dXNlbWFwJzogMTEsXG4gICdpbnB1dDo6dmFsdWUnOiAwLFxuICAnaW5zOjpjaXRlJzogMSxcbiAgJ2luczo6ZGF0ZXRpbWUnOiAwLFxuICAnbGFiZWw6OmFjY2Vzc2tleSc6IDAsXG4gICdsYWJlbDo6Zm9yJzogNSxcbiAgJ2xhYmVsOjpvbmJsdXInOiAyLFxuICAnbGFiZWw6Om9uZm9jdXMnOiAyLFxuICAnbGVnZW5kOjphY2Nlc3NrZXknOiAwLFxuICAnbGVnZW5kOjphbGlnbic6IDAsXG4gICdsaTo6dHlwZSc6IDAsXG4gICdsaTo6dmFsdWUnOiAwLFxuICAnbWFwOjpuYW1lJzogNyxcbiAgJ21lbnU6OmNvbXBhY3QnOiAwLFxuICAnbWVudTo6bGFiZWwnOiAwLFxuICAnbWVudTo6dHlwZSc6IDAsXG4gICdtZXRlcjo6aGlnaCc6IDAsXG4gICdtZXRlcjo6bG93JzogMCxcbiAgJ21ldGVyOjptYXgnOiAwLFxuICAnbWV0ZXI6Om1pbic6IDAsXG4gICdtZXRlcjo6dmFsdWUnOiAwLFxuICAnb2w6OmNvbXBhY3QnOiAwLFxuICAnb2w6OnJldmVyc2VkJzogMCxcbiAgJ29sOjpzdGFydCc6IDAsXG4gICdvbDo6dHlwZSc6IDAsXG4gICdvcHRncm91cDo6ZGlzYWJsZWQnOiAwLFxuICAnb3B0Z3JvdXA6OmxhYmVsJzogMCxcbiAgJ29wdGlvbjo6ZGlzYWJsZWQnOiAwLFxuICAnb3B0aW9uOjpsYWJlbCc6IDAsXG4gICdvcHRpb246OnNlbGVjdGVkJzogMCxcbiAgJ29wdGlvbjo6dmFsdWUnOiAwLFxuICAnb3V0cHV0Ojpmb3InOiA2LFxuICAnb3V0cHV0OjpuYW1lJzogOCxcbiAgJ3A6OmFsaWduJzogMCxcbiAgJ3ByZTo6d2lkdGgnOiAwLFxuICAncHJvZ3Jlc3M6Om1heCc6IDAsXG4gICdwcm9ncmVzczo6bWluJzogMCxcbiAgJ3Byb2dyZXNzOjp2YWx1ZSc6IDAsXG4gICdxOjpjaXRlJzogMSxcbiAgJ3NlbGVjdDo6YXV0b2NvbXBsZXRlJzogMCxcbiAgJ3NlbGVjdDo6ZGlzYWJsZWQnOiAwLFxuICAnc2VsZWN0OjptdWx0aXBsZSc6IDAsXG4gICdzZWxlY3Q6Om5hbWUnOiA4LFxuICAnc2VsZWN0OjpvbmJsdXInOiAyLFxuICAnc2VsZWN0OjpvbmNoYW5nZSc6IDIsXG4gICdzZWxlY3Q6Om9uZm9jdXMnOiAyLFxuICAnc2VsZWN0OjpyZXF1aXJlZCc6IDAsXG4gICdzZWxlY3Q6OnNpemUnOiAwLFxuICAnc2VsZWN0Ojp0YWJpbmRleCc6IDAsXG4gICdzb3VyY2U6OnR5cGUnOiAwLFxuICAndGFibGU6OmFsaWduJzogMCxcbiAgJ3RhYmxlOjpiZ2NvbG9yJzogMCxcbiAgJ3RhYmxlOjpib3JkZXInOiAwLFxuICAndGFibGU6OmNlbGxwYWRkaW5nJzogMCxcbiAgJ3RhYmxlOjpjZWxsc3BhY2luZyc6IDAsXG4gICd0YWJsZTo6ZnJhbWUnOiAwLFxuICAndGFibGU6OnJ1bGVzJzogMCxcbiAgJ3RhYmxlOjpzdW1tYXJ5JzogMCxcbiAgJ3RhYmxlOjp3aWR0aCc6IDAsXG4gICd0Ym9keTo6YWxpZ24nOiAwLFxuICAndGJvZHk6OmNoYXInOiAwLFxuICAndGJvZHk6OmNoYXJvZmYnOiAwLFxuICAndGJvZHk6OnZhbGlnbic6IDAsXG4gICd0ZDo6YWJicic6IDAsXG4gICd0ZDo6YWxpZ24nOiAwLFxuICAndGQ6OmF4aXMnOiAwLFxuICAndGQ6OmJnY29sb3InOiAwLFxuICAndGQ6OmNoYXInOiAwLFxuICAndGQ6OmNoYXJvZmYnOiAwLFxuICAndGQ6OmNvbHNwYW4nOiAwLFxuICAndGQ6OmhlYWRlcnMnOiA2LFxuICAndGQ6OmhlaWdodCc6IDAsXG4gICd0ZDo6bm93cmFwJzogMCxcbiAgJ3RkOjpyb3dzcGFuJzogMCxcbiAgJ3RkOjpzY29wZSc6IDAsXG4gICd0ZDo6dmFsaWduJzogMCxcbiAgJ3RkOjp3aWR0aCc6IDAsXG4gICd0ZXh0YXJlYTo6YWNjZXNza2V5JzogMCxcbiAgJ3RleHRhcmVhOjphdXRvY29tcGxldGUnOiAwLFxuICAndGV4dGFyZWE6OmNvbHMnOiAwLFxuICAndGV4dGFyZWE6OmRpc2FibGVkJzogMCxcbiAgJ3RleHRhcmVhOjppbnB1dG1vZGUnOiAwLFxuICAndGV4dGFyZWE6Om5hbWUnOiA4LFxuICAndGV4dGFyZWE6Om9uYmx1cic6IDIsXG4gICd0ZXh0YXJlYTo6b25jaGFuZ2UnOiAyLFxuICAndGV4dGFyZWE6Om9uZm9jdXMnOiAyLFxuICAndGV4dGFyZWE6Om9uc2VsZWN0JzogMixcbiAgJ3RleHRhcmVhOjpwbGFjZWhvbGRlcic6IDAsXG4gICd0ZXh0YXJlYTo6cmVhZG9ubHknOiAwLFxuICAndGV4dGFyZWE6OnJlcXVpcmVkJzogMCxcbiAgJ3RleHRhcmVhOjpyb3dzJzogMCxcbiAgJ3RleHRhcmVhOjp0YWJpbmRleCc6IDAsXG4gICd0ZXh0YXJlYTo6d3JhcCc6IDAsXG4gICd0Zm9vdDo6YWxpZ24nOiAwLFxuICAndGZvb3Q6OmNoYXInOiAwLFxuICAndGZvb3Q6OmNoYXJvZmYnOiAwLFxuICAndGZvb3Q6OnZhbGlnbic6IDAsXG4gICd0aDo6YWJicic6IDAsXG4gICd0aDo6YWxpZ24nOiAwLFxuICAndGg6OmF4aXMnOiAwLFxuICAndGg6OmJnY29sb3InOiAwLFxuICAndGg6OmNoYXInOiAwLFxuICAndGg6OmNoYXJvZmYnOiAwLFxuICAndGg6OmNvbHNwYW4nOiAwLFxuICAndGg6OmhlYWRlcnMnOiA2LFxuICAndGg6OmhlaWdodCc6IDAsXG4gICd0aDo6bm93cmFwJzogMCxcbiAgJ3RoOjpyb3dzcGFuJzogMCxcbiAgJ3RoOjpzY29wZSc6IDAsXG4gICd0aDo6dmFsaWduJzogMCxcbiAgJ3RoOjp3aWR0aCc6IDAsXG4gICd0aGVhZDo6YWxpZ24nOiAwLFxuICAndGhlYWQ6OmNoYXInOiAwLFxuICAndGhlYWQ6OmNoYXJvZmYnOiAwLFxuICAndGhlYWQ6OnZhbGlnbic6IDAsXG4gICd0cjo6YWxpZ24nOiAwLFxuICAndHI6OmJnY29sb3InOiAwLFxuICAndHI6OmNoYXInOiAwLFxuICAndHI6OmNoYXJvZmYnOiAwLFxuICAndHI6OnZhbGlnbic6IDAsXG4gICd0cmFjazo6ZGVmYXVsdCc6IDAsXG4gICd0cmFjazo6a2luZCc6IDAsXG4gICd0cmFjazo6bGFiZWwnOiAwLFxuICAndHJhY2s6OnNyY2xhbmcnOiAwLFxuICAndWw6OmNvbXBhY3QnOiAwLFxuICAndWw6OnR5cGUnOiAwLFxuICAndmlkZW86OmNvbnRyb2xzJzogMCxcbiAgJ3ZpZGVvOjpoZWlnaHQnOiAwLFxuICAndmlkZW86Omxvb3AnOiAwLFxuICAndmlkZW86Om1lZGlhZ3JvdXAnOiA1LFxuICAndmlkZW86Om11dGVkJzogMCxcbiAgJ3ZpZGVvOjpwb3N0ZXInOiAxLFxuICAndmlkZW86OnByZWxvYWQnOiAwLFxuICAndmlkZW86OndpZHRoJzogMFxufTtcbmh0bWw0WyAnQVRUUklCUycgXSA9IGh0bWw0LkFUVFJJQlM7XG5odG1sNC5lZmxhZ3MgPSB7XG4gICdPUFRJT05BTF9FTkRUQUcnOiAxLFxuICAnRU1QVFknOiAyLFxuICAnQ0RBVEEnOiA0LFxuICAnUkNEQVRBJzogOCxcbiAgJ1VOU0FGRSc6IDE2LFxuICAnRk9MREFCTEUnOiAzMixcbiAgJ1NDUklQVCc6IDY0LFxuICAnU1RZTEUnOiAxMjgsXG4gICdWSVJUVUFMSVpFRCc6IDI1NlxufTtcbmh0bWw0WyAnZWZsYWdzJyBdID0gaHRtbDQuZWZsYWdzO1xuLy8gdGhlc2UgYXJlIGJpdG1hc2tzIG9mIHRoZSBlZmxhZ3MgYWJvdmUuXG5odG1sNC5FTEVNRU5UUyA9IHtcbiAgJ2EnOiAwLFxuICAnYWJicic6IDAsXG4gICdhY3JvbnltJzogMCxcbiAgJ2FkZHJlc3MnOiAwLFxuICAnYXBwbGV0JzogMjcyLFxuICAnYXJlYSc6IDIsXG4gICdhcnRpY2xlJzogMCxcbiAgJ2FzaWRlJzogMCxcbiAgJ2F1ZGlvJzogMCxcbiAgJ2InOiAwLFxuICAnYmFzZSc6IDI3NCxcbiAgJ2Jhc2Vmb250JzogMjc0LFxuICAnYmRpJzogMCxcbiAgJ2Jkbyc6IDAsXG4gICdiaWcnOiAwLFxuICAnYmxvY2txdW90ZSc6IDAsXG4gICdib2R5JzogMzA1LFxuICAnYnInOiAyLFxuICAnYnV0dG9uJzogMCxcbiAgJ2NhbnZhcyc6IDAsXG4gICdjYXB0aW9uJzogMCxcbiAgJ2NlbnRlcic6IDAsXG4gICdjaXRlJzogMCxcbiAgJ2NvZGUnOiAwLFxuICAnY29sJzogMixcbiAgJ2NvbGdyb3VwJzogMSxcbiAgJ2NvbW1hbmQnOiAyLFxuICAnZGF0YSc6IDAsXG4gICdkYXRhbGlzdCc6IDAsXG4gICdkZCc6IDEsXG4gICdkZWwnOiAwLFxuICAnZGV0YWlscyc6IDAsXG4gICdkZm4nOiAwLFxuICAnZGlhbG9nJzogMjcyLFxuICAnZGlyJzogMCxcbiAgJ2Rpdic6IDAsXG4gICdkbCc6IDAsXG4gICdkdCc6IDEsXG4gICdlbSc6IDAsXG4gICdmaWVsZHNldCc6IDAsXG4gICdmaWdjYXB0aW9uJzogMCxcbiAgJ2ZpZ3VyZSc6IDAsXG4gICdmb250JzogMCxcbiAgJ2Zvb3Rlcic6IDAsXG4gICdmb3JtJzogMCxcbiAgJ2ZyYW1lJzogMjc0LFxuICAnZnJhbWVzZXQnOiAyNzIsXG4gICdoMSc6IDAsXG4gICdoMic6IDAsXG4gICdoMyc6IDAsXG4gICdoNCc6IDAsXG4gICdoNSc6IDAsXG4gICdoNic6IDAsXG4gICdoZWFkJzogMzA1LFxuICAnaGVhZGVyJzogMCxcbiAgJ2hncm91cCc6IDAsXG4gICdocic6IDIsXG4gICdodG1sJzogMzA1LFxuICAnaSc6IDAsXG4gICdpZnJhbWUnOiAxNixcbiAgJ2ltZyc6IDIsXG4gICdpbnB1dCc6IDIsXG4gICdpbnMnOiAwLFxuICAnaXNpbmRleCc6IDI3NCxcbiAgJ2tiZCc6IDAsXG4gICdrZXlnZW4nOiAyNzQsXG4gICdsYWJlbCc6IDAsXG4gICdsZWdlbmQnOiAwLFxuICAnbGknOiAxLFxuICAnbGluayc6IDI3NCxcbiAgJ21hcCc6IDAsXG4gICdtYXJrJzogMCxcbiAgJ21lbnUnOiAwLFxuICAnbWV0YSc6IDI3NCxcbiAgJ21ldGVyJzogMCxcbiAgJ25hdic6IDAsXG4gICdub2JyJzogMCxcbiAgJ25vZW1iZWQnOiAyNzYsXG4gICdub2ZyYW1lcyc6IDI3NixcbiAgJ25vc2NyaXB0JzogMjc2LFxuICAnb2JqZWN0JzogMjcyLFxuICAnb2wnOiAwLFxuICAnb3B0Z3JvdXAnOiAwLFxuICAnb3B0aW9uJzogMSxcbiAgJ291dHB1dCc6IDAsXG4gICdwJzogMSxcbiAgJ3BhcmFtJzogMjc0LFxuICAncHJlJzogMCxcbiAgJ3Byb2dyZXNzJzogMCxcbiAgJ3EnOiAwLFxuICAncyc6IDAsXG4gICdzYW1wJzogMCxcbiAgJ3NjcmlwdCc6IDg0LFxuICAnc2VjdGlvbic6IDAsXG4gICdzZWxlY3QnOiAwLFxuICAnc21hbGwnOiAwLFxuICAnc291cmNlJzogMixcbiAgJ3NwYW4nOiAwLFxuICAnc3RyaWtlJzogMCxcbiAgJ3N0cm9uZyc6IDAsXG4gICdzdHlsZSc6IDE0OCxcbiAgJ3N1Yic6IDAsXG4gICdzdW1tYXJ5JzogMCxcbiAgJ3N1cCc6IDAsXG4gICd0YWJsZSc6IDAsXG4gICd0Ym9keSc6IDEsXG4gICd0ZCc6IDEsXG4gICd0ZXh0YXJlYSc6IDgsXG4gICd0Zm9vdCc6IDEsXG4gICd0aCc6IDEsXG4gICd0aGVhZCc6IDEsXG4gICd0aW1lJzogMCxcbiAgJ3RpdGxlJzogMjgwLFxuICAndHInOiAxLFxuICAndHJhY2snOiAyLFxuICAndHQnOiAwLFxuICAndSc6IDAsXG4gICd1bCc6IDAsXG4gICd2YXInOiAwLFxuICAndmlkZW8nOiAwLFxuICAnd2JyJzogMlxufTtcbmh0bWw0WyAnRUxFTUVOVFMnIF0gPSBodG1sNC5FTEVNRU5UUztcbmh0bWw0LkVMRU1FTlRfRE9NX0lOVEVSRkFDRVMgPSB7XG4gICdhJzogJ0hUTUxBbmNob3JFbGVtZW50JyxcbiAgJ2FiYnInOiAnSFRNTEVsZW1lbnQnLFxuICAnYWNyb255bSc6ICdIVE1MRWxlbWVudCcsXG4gICdhZGRyZXNzJzogJ0hUTUxFbGVtZW50JyxcbiAgJ2FwcGxldCc6ICdIVE1MQXBwbGV0RWxlbWVudCcsXG4gICdhcmVhJzogJ0hUTUxBcmVhRWxlbWVudCcsXG4gICdhcnRpY2xlJzogJ0hUTUxFbGVtZW50JyxcbiAgJ2FzaWRlJzogJ0hUTUxFbGVtZW50JyxcbiAgJ2F1ZGlvJzogJ0hUTUxBdWRpb0VsZW1lbnQnLFxuICAnYic6ICdIVE1MRWxlbWVudCcsXG4gICdiYXNlJzogJ0hUTUxCYXNlRWxlbWVudCcsXG4gICdiYXNlZm9udCc6ICdIVE1MQmFzZUZvbnRFbGVtZW50JyxcbiAgJ2JkaSc6ICdIVE1MRWxlbWVudCcsXG4gICdiZG8nOiAnSFRNTEVsZW1lbnQnLFxuICAnYmlnJzogJ0hUTUxFbGVtZW50JyxcbiAgJ2Jsb2NrcXVvdGUnOiAnSFRNTFF1b3RlRWxlbWVudCcsXG4gICdib2R5JzogJ0hUTUxCb2R5RWxlbWVudCcsXG4gICdicic6ICdIVE1MQlJFbGVtZW50JyxcbiAgJ2J1dHRvbic6ICdIVE1MQnV0dG9uRWxlbWVudCcsXG4gICdjYW52YXMnOiAnSFRNTENhbnZhc0VsZW1lbnQnLFxuICAnY2FwdGlvbic6ICdIVE1MVGFibGVDYXB0aW9uRWxlbWVudCcsXG4gICdjZW50ZXInOiAnSFRNTEVsZW1lbnQnLFxuICAnY2l0ZSc6ICdIVE1MRWxlbWVudCcsXG4gICdjb2RlJzogJ0hUTUxFbGVtZW50JyxcbiAgJ2NvbCc6ICdIVE1MVGFibGVDb2xFbGVtZW50JyxcbiAgJ2NvbGdyb3VwJzogJ0hUTUxUYWJsZUNvbEVsZW1lbnQnLFxuICAnY29tbWFuZCc6ICdIVE1MQ29tbWFuZEVsZW1lbnQnLFxuICAnZGF0YSc6ICdIVE1MRWxlbWVudCcsXG4gICdkYXRhbGlzdCc6ICdIVE1MRGF0YUxpc3RFbGVtZW50JyxcbiAgJ2RkJzogJ0hUTUxFbGVtZW50JyxcbiAgJ2RlbCc6ICdIVE1MTW9kRWxlbWVudCcsXG4gICdkZXRhaWxzJzogJ0hUTUxEZXRhaWxzRWxlbWVudCcsXG4gICdkZm4nOiAnSFRNTEVsZW1lbnQnLFxuICAnZGlhbG9nJzogJ0hUTUxEaWFsb2dFbGVtZW50JyxcbiAgJ2Rpcic6ICdIVE1MRGlyZWN0b3J5RWxlbWVudCcsXG4gICdkaXYnOiAnSFRNTERpdkVsZW1lbnQnLFxuICAnZGwnOiAnSFRNTERMaXN0RWxlbWVudCcsXG4gICdkdCc6ICdIVE1MRWxlbWVudCcsXG4gICdlbSc6ICdIVE1MRWxlbWVudCcsXG4gICdmaWVsZHNldCc6ICdIVE1MRmllbGRTZXRFbGVtZW50JyxcbiAgJ2ZpZ2NhcHRpb24nOiAnSFRNTEVsZW1lbnQnLFxuICAnZmlndXJlJzogJ0hUTUxFbGVtZW50JyxcbiAgJ2ZvbnQnOiAnSFRNTEZvbnRFbGVtZW50JyxcbiAgJ2Zvb3Rlcic6ICdIVE1MRWxlbWVudCcsXG4gICdmb3JtJzogJ0hUTUxGb3JtRWxlbWVudCcsXG4gICdmcmFtZSc6ICdIVE1MRnJhbWVFbGVtZW50JyxcbiAgJ2ZyYW1lc2V0JzogJ0hUTUxGcmFtZVNldEVsZW1lbnQnLFxuICAnaDEnOiAnSFRNTEhlYWRpbmdFbGVtZW50JyxcbiAgJ2gyJzogJ0hUTUxIZWFkaW5nRWxlbWVudCcsXG4gICdoMyc6ICdIVE1MSGVhZGluZ0VsZW1lbnQnLFxuICAnaDQnOiAnSFRNTEhlYWRpbmdFbGVtZW50JyxcbiAgJ2g1JzogJ0hUTUxIZWFkaW5nRWxlbWVudCcsXG4gICdoNic6ICdIVE1MSGVhZGluZ0VsZW1lbnQnLFxuICAnaGVhZCc6ICdIVE1MSGVhZEVsZW1lbnQnLFxuICAnaGVhZGVyJzogJ0hUTUxFbGVtZW50JyxcbiAgJ2hncm91cCc6ICdIVE1MRWxlbWVudCcsXG4gICdocic6ICdIVE1MSFJFbGVtZW50JyxcbiAgJ2h0bWwnOiAnSFRNTEh0bWxFbGVtZW50JyxcbiAgJ2knOiAnSFRNTEVsZW1lbnQnLFxuICAnaWZyYW1lJzogJ0hUTUxJRnJhbWVFbGVtZW50JyxcbiAgJ2ltZyc6ICdIVE1MSW1hZ2VFbGVtZW50JyxcbiAgJ2lucHV0JzogJ0hUTUxJbnB1dEVsZW1lbnQnLFxuICAnaW5zJzogJ0hUTUxNb2RFbGVtZW50JyxcbiAgJ2lzaW5kZXgnOiAnSFRNTFVua25vd25FbGVtZW50JyxcbiAgJ2tiZCc6ICdIVE1MRWxlbWVudCcsXG4gICdrZXlnZW4nOiAnSFRNTEtleWdlbkVsZW1lbnQnLFxuICAnbGFiZWwnOiAnSFRNTExhYmVsRWxlbWVudCcsXG4gICdsZWdlbmQnOiAnSFRNTExlZ2VuZEVsZW1lbnQnLFxuICAnbGknOiAnSFRNTExJRWxlbWVudCcsXG4gICdsaW5rJzogJ0hUTUxMaW5rRWxlbWVudCcsXG4gICdtYXAnOiAnSFRNTE1hcEVsZW1lbnQnLFxuICAnbWFyayc6ICdIVE1MRWxlbWVudCcsXG4gICdtZW51JzogJ0hUTUxNZW51RWxlbWVudCcsXG4gICdtZXRhJzogJ0hUTUxNZXRhRWxlbWVudCcsXG4gICdtZXRlcic6ICdIVE1MTWV0ZXJFbGVtZW50JyxcbiAgJ25hdic6ICdIVE1MRWxlbWVudCcsXG4gICdub2JyJzogJ0hUTUxFbGVtZW50JyxcbiAgJ25vZW1iZWQnOiAnSFRNTEVsZW1lbnQnLFxuICAnbm9mcmFtZXMnOiAnSFRNTEVsZW1lbnQnLFxuICAnbm9zY3JpcHQnOiAnSFRNTEVsZW1lbnQnLFxuICAnb2JqZWN0JzogJ0hUTUxPYmplY3RFbGVtZW50JyxcbiAgJ29sJzogJ0hUTUxPTGlzdEVsZW1lbnQnLFxuICAnb3B0Z3JvdXAnOiAnSFRNTE9wdEdyb3VwRWxlbWVudCcsXG4gICdvcHRpb24nOiAnSFRNTE9wdGlvbkVsZW1lbnQnLFxuICAnb3V0cHV0JzogJ0hUTUxPdXRwdXRFbGVtZW50JyxcbiAgJ3AnOiAnSFRNTFBhcmFncmFwaEVsZW1lbnQnLFxuICAncGFyYW0nOiAnSFRNTFBhcmFtRWxlbWVudCcsXG4gICdwcmUnOiAnSFRNTFByZUVsZW1lbnQnLFxuICAncHJvZ3Jlc3MnOiAnSFRNTFByb2dyZXNzRWxlbWVudCcsXG4gICdxJzogJ0hUTUxRdW90ZUVsZW1lbnQnLFxuICAncyc6ICdIVE1MRWxlbWVudCcsXG4gICdzYW1wJzogJ0hUTUxFbGVtZW50JyxcbiAgJ3NjcmlwdCc6ICdIVE1MU2NyaXB0RWxlbWVudCcsXG4gICdzZWN0aW9uJzogJ0hUTUxFbGVtZW50JyxcbiAgJ3NlbGVjdCc6ICdIVE1MU2VsZWN0RWxlbWVudCcsXG4gICdzbWFsbCc6ICdIVE1MRWxlbWVudCcsXG4gICdzb3VyY2UnOiAnSFRNTFNvdXJjZUVsZW1lbnQnLFxuICAnc3Bhbic6ICdIVE1MU3BhbkVsZW1lbnQnLFxuICAnc3RyaWtlJzogJ0hUTUxFbGVtZW50JyxcbiAgJ3N0cm9uZyc6ICdIVE1MRWxlbWVudCcsXG4gICdzdHlsZSc6ICdIVE1MU3R5bGVFbGVtZW50JyxcbiAgJ3N1Yic6ICdIVE1MRWxlbWVudCcsXG4gICdzdW1tYXJ5JzogJ0hUTUxFbGVtZW50JyxcbiAgJ3N1cCc6ICdIVE1MRWxlbWVudCcsXG4gICd0YWJsZSc6ICdIVE1MVGFibGVFbGVtZW50JyxcbiAgJ3Rib2R5JzogJ0hUTUxUYWJsZVNlY3Rpb25FbGVtZW50JyxcbiAgJ3RkJzogJ0hUTUxUYWJsZURhdGFDZWxsRWxlbWVudCcsXG4gICd0ZXh0YXJlYSc6ICdIVE1MVGV4dEFyZWFFbGVtZW50JyxcbiAgJ3Rmb290JzogJ0hUTUxUYWJsZVNlY3Rpb25FbGVtZW50JyxcbiAgJ3RoJzogJ0hUTUxUYWJsZUhlYWRlckNlbGxFbGVtZW50JyxcbiAgJ3RoZWFkJzogJ0hUTUxUYWJsZVNlY3Rpb25FbGVtZW50JyxcbiAgJ3RpbWUnOiAnSFRNTFRpbWVFbGVtZW50JyxcbiAgJ3RpdGxlJzogJ0hUTUxUaXRsZUVsZW1lbnQnLFxuICAndHInOiAnSFRNTFRhYmxlUm93RWxlbWVudCcsXG4gICd0cmFjayc6ICdIVE1MVHJhY2tFbGVtZW50JyxcbiAgJ3R0JzogJ0hUTUxFbGVtZW50JyxcbiAgJ3UnOiAnSFRNTEVsZW1lbnQnLFxuICAndWwnOiAnSFRNTFVMaXN0RWxlbWVudCcsXG4gICd2YXInOiAnSFRNTEVsZW1lbnQnLFxuICAndmlkZW8nOiAnSFRNTFZpZGVvRWxlbWVudCcsXG4gICd3YnInOiAnSFRNTEVsZW1lbnQnXG59O1xuaHRtbDRbICdFTEVNRU5UX0RPTV9JTlRFUkZBQ0VTJyBdID0gaHRtbDQuRUxFTUVOVF9ET01fSU5URVJGQUNFUztcbmh0bWw0LnVlZmZlY3RzID0ge1xuICAnTk9UX0xPQURFRCc6IDAsXG4gICdTQU1FX0RPQ1VNRU5UJzogMSxcbiAgJ05FV19ET0NVTUVOVCc6IDJcbn07XG5odG1sNFsgJ3VlZmZlY3RzJyBdID0gaHRtbDQudWVmZmVjdHM7XG5odG1sNC5VUklFRkZFQ1RTID0ge1xuICAnYTo6aHJlZic6IDIsXG4gICdhcmVhOjpocmVmJzogMixcbiAgJ2Jsb2NrcXVvdGU6OmNpdGUnOiAwLFxuICAnY29tbWFuZDo6aWNvbic6IDEsXG4gICdkZWw6OmNpdGUnOiAwLFxuICAnZm9ybTo6YWN0aW9uJzogMixcbiAgJ2ltZzo6c3JjJzogMSxcbiAgJ2lucHV0OjpzcmMnOiAxLFxuICAnaW5zOjpjaXRlJzogMCxcbiAgJ3E6OmNpdGUnOiAwLFxuICAndmlkZW86OnBvc3Rlcic6IDFcbn07XG5odG1sNFsgJ1VSSUVGRkVDVFMnIF0gPSBodG1sNC5VUklFRkZFQ1RTO1xuaHRtbDQubHR5cGVzID0ge1xuICAnVU5TQU5EQk9YRUQnOiAyLFxuICAnU0FOREJPWEVEJzogMSxcbiAgJ0RBVEEnOiAwXG59O1xuaHRtbDRbICdsdHlwZXMnIF0gPSBodG1sNC5sdHlwZXM7XG5odG1sNC5MT0FERVJUWVBFUyA9IHtcbiAgJ2E6OmhyZWYnOiAyLFxuICAnYXJlYTo6aHJlZic6IDIsXG4gICdibG9ja3F1b3RlOjpjaXRlJzogMixcbiAgJ2NvbW1hbmQ6Omljb24nOiAxLFxuICAnZGVsOjpjaXRlJzogMixcbiAgJ2Zvcm06OmFjdGlvbic6IDIsXG4gICdpbWc6OnNyYyc6IDEsXG4gICdpbnB1dDo6c3JjJzogMSxcbiAgJ2luczo6Y2l0ZSc6IDIsXG4gICdxOjpjaXRlJzogMixcbiAgJ3ZpZGVvOjpwb3N0ZXInOiAxXG59O1xuaHRtbDRbICdMT0FERVJUWVBFUycgXSA9IGh0bWw0LkxPQURFUlRZUEVTO1xuXG4vLyBDb3B5cmlnaHQgKEMpIDIwMDYgR29vZ2xlIEluYy5cbi8vXG4vLyBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuLy8geW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuLy8gWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4vL1xuLy8gICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbi8vXG4vLyBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4vLyBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4vLyBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbi8vIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbi8vIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuXG4vKipcbiAqIEBmaWxlb3ZlcnZpZXdcbiAqIEFuIEhUTUwgc2FuaXRpemVyIHRoYXQgY2FuIHNhdGlzZnkgYSB2YXJpZXR5IG9mIHNlY3VyaXR5IHBvbGljaWVzLlxuICpcbiAqIDxwPlxuICogVGhlIEhUTUwgc2FuaXRpemVyIGlzIGJ1aWx0IGFyb3VuZCBhIFNBWCBwYXJzZXIgYW5kIEhUTUwgZWxlbWVudCBhbmRcbiAqIGF0dHJpYnV0ZXMgc2NoZW1hcy5cbiAqXG4gKiBJZiB0aGUgY3NzcGFyc2VyIGlzIGxvYWRlZCwgaW5saW5lIHN0eWxlcyBhcmUgc2FuaXRpemVkIHVzaW5nIHRoZVxuICogY3NzIHByb3BlcnR5IGFuZCB2YWx1ZSBzY2hlbWFzLiAgRWxzZSB0aGV5IGFyZSByZW1vdmUgZHVyaW5nXG4gKiBzYW5pdGl6YXRpb24uXG4gKlxuICogSWYgaXQgZXhpc3RzLCB1c2VzIHBhcnNlQ3NzRGVjbGFyYXRpb25zLCBzYW5pdGl6ZUNzc1Byb3BlcnR5LCAgY3NzU2NoZW1hXG4gKlxuICogQGF1dGhvciBtaWtlc2FtdWVsQGdtYWlsLmNvbVxuICogQGF1dGhvciBqYXN2aXJAZ21haWwuY29tXG4gKiBcXEByZXF1aXJlcyBodG1sNCwgVVJJXG4gKiBcXEBvdmVycmlkZXMgd2luZG93XG4gKiBcXEBwcm92aWRlcyBodG1sLCBodG1sX3Nhbml0aXplXG4gKi9cblxuLy8gVGhlIFR1cmtpc2ggaSBzZWVtcyB0byBiZSBhIG5vbi1pc3N1ZSwgYnV0IGFib3J0IGluIGNhc2UgaXQgaXMuXG5pZiAoJ0knLnRvTG93ZXJDYXNlKCkgIT09ICdpJykgeyB0aHJvdyAnSS9pIHByb2JsZW0nOyB9XG5cbi8qKlxuICogXFxAbmFtZXNwYWNlXG4gKi9cbnZhciBodG1sID0gKGZ1bmN0aW9uKGh0bWw0KSB7XG5cbiAgLy8gRm9yIGNsb3N1cmUgY29tcGlsZXJcbiAgdmFyIHBhcnNlQ3NzRGVjbGFyYXRpb25zLCBzYW5pdGl6ZUNzc1Byb3BlcnR5LCBjc3NTY2hlbWE7XG4gIGlmICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHdpbmRvdykge1xuICAgIHBhcnNlQ3NzRGVjbGFyYXRpb25zID0gd2luZG93WydwYXJzZUNzc0RlY2xhcmF0aW9ucyddO1xuICAgIHNhbml0aXplQ3NzUHJvcGVydHkgPSB3aW5kb3dbJ3Nhbml0aXplQ3NzUHJvcGVydHknXTtcbiAgICBjc3NTY2hlbWEgPSB3aW5kb3dbJ2Nzc1NjaGVtYSddO1xuICB9XG5cbiAgLy8gVGhlIGtleXMgb2YgdGhpcyBvYmplY3QgbXVzdCBiZSAncXVvdGVkJyBvciBKU0NvbXBpbGVyIHdpbGwgbWFuZ2xlIHRoZW0hXG4gIC8vIFRoaXMgaXMgYSBwYXJ0aWFsIGxpc3QgLS0gbG9va3VwRW50aXR5KCkgdXNlcyB0aGUgaG9zdCBicm93c2VyJ3MgcGFyc2VyXG4gIC8vICh3aGVuIGF2YWlsYWJsZSkgdG8gaW1wbGVtZW50IGZ1bGwgZW50aXR5IGxvb2t1cC5cbiAgLy8gTm90ZSB0aGF0IGVudGl0aWVzIGFyZSBpbiBnZW5lcmFsIGNhc2Utc2Vuc2l0aXZlOyB0aGUgdXBwZXJjYXNlIG9uZXMgYXJlXG4gIC8vIGV4cGxpY2l0bHkgZGVmaW5lZCBieSBIVE1MNSAocHJlc3VtYWJseSBhcyBjb21wYXRpYmlsaXR5KS5cbiAgdmFyIEVOVElUSUVTID0ge1xuICAgICdsdCc6ICc8JyxcbiAgICAnTFQnOiAnPCcsXG4gICAgJ2d0JzogJz4nLFxuICAgICdHVCc6ICc+JyxcbiAgICAnYW1wJzogJyYnLFxuICAgICdBTVAnOiAnJicsXG4gICAgJ3F1b3QnOiAnXCInLFxuICAgICdhcG9zJzogJ1xcJycsXG4gICAgJ25ic3AnOiAnXFx1MDBBMCdcbiAgfTtcblxuICAvLyBQYXR0ZXJucyBmb3IgdHlwZXMgb2YgZW50aXR5L2NoYXJhY3RlciByZWZlcmVuY2UgbmFtZXMuXG4gIHZhciBkZWNpbWFsRXNjYXBlUmUgPSAvXiMoXFxkKykkLztcbiAgdmFyIGhleEVzY2FwZVJlID0gL14jeChbMC05QS1GYS1mXSspJC87XG4gIC8vIGNvbnRhaW5zIGV2ZXJ5IGVudGl0eSBwZXIgaHR0cDovL3d3dy53My5vcmcvVFIvMjAxMS9XRC1odG1sNS0yMDExMDExMy9uYW1lZC1jaGFyYWN0ZXItcmVmZXJlbmNlcy5odG1sXG4gIHZhciBzYWZlRW50aXR5TmFtZVJlID0gL15bQS1aYS16XVtBLXphLXowLTldKyQvO1xuICAvLyBVc2VkIGFzIGEgaG9vayB0byBpbnZva2UgdGhlIGJyb3dzZXIncyBlbnRpdHkgcGFyc2luZy4gPHRleHRhcmVhPiBpcyB1c2VkXG4gIC8vIGJlY2F1c2UgaXRzIGNvbnRlbnQgaXMgcGFyc2VkIGZvciBlbnRpdGllcyBidXQgbm90IHRhZ3MuXG4gIC8vIFRPRE8oa3ByZWlkKTogVGhpcyByZXRyaWV2YWwgaXMgYSBrbHVkZ2UgYW5kIGxlYWRzIHRvIHNpbGVudCBsb3NzIG9mXG4gIC8vIGZ1bmN0aW9uYWxpdHkgaWYgdGhlIGRvY3VtZW50IGlzbid0IGF2YWlsYWJsZS5cbiAgdmFyIGVudGl0eUxvb2t1cEVsZW1lbnQgPVxuICAgICAgKCd1bmRlZmluZWQnICE9PSB0eXBlb2Ygd2luZG93ICYmIHdpbmRvd1snZG9jdW1lbnQnXSlcbiAgICAgICAgICA/IHdpbmRvd1snZG9jdW1lbnQnXS5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpIDogbnVsbDtcbiAgLyoqXG4gICAqIERlY29kZXMgYW4gSFRNTCBlbnRpdHkuXG4gICAqXG4gICAqIHtcXEB1cGRvY1xuICAgKiAkIGxvb2t1cEVudGl0eSgnbHQnKVxuICAgKiAjICc8J1xuICAgKiAkIGxvb2t1cEVudGl0eSgnR1QnKVxuICAgKiAjICc+J1xuICAgKiAkIGxvb2t1cEVudGl0eSgnYW1wJylcbiAgICogIyAnJidcbiAgICogJCBsb29rdXBFbnRpdHkoJ25ic3AnKVxuICAgKiAjICdcXHhBMCdcbiAgICogJCBsb29rdXBFbnRpdHkoJ2Fwb3MnKVxuICAgKiAjIFwiJ1wiXG4gICAqICQgbG9va3VwRW50aXR5KCdxdW90JylcbiAgICogIyAnXCInXG4gICAqICQgbG9va3VwRW50aXR5KCcjeGEnKVxuICAgKiAjICdcXG4nXG4gICAqICQgbG9va3VwRW50aXR5KCcjMTAnKVxuICAgKiAjICdcXG4nXG4gICAqICQgbG9va3VwRW50aXR5KCcjeDBhJylcbiAgICogIyAnXFxuJ1xuICAgKiAkIGxvb2t1cEVudGl0eSgnIzAxMCcpXG4gICAqICMgJ1xcbidcbiAgICogJCBsb29rdXBFbnRpdHkoJyN4MDBBJylcbiAgICogIyAnXFxuJ1xuICAgKiAkIGxvb2t1cEVudGl0eSgnUGknKSAgICAgIC8vIEtub3duIGZhaWx1cmVcbiAgICogIyAnXFx1MDNBMCdcbiAgICogJCBsb29rdXBFbnRpdHkoJ3BpJykgICAgICAvLyBLbm93biBmYWlsdXJlXG4gICAqICMgJ1xcdTAzQzAnXG4gICAqIH1cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgdGhlIGNvbnRlbnQgYmV0d2VlbiB0aGUgJyYnIGFuZCB0aGUgJzsnLlxuICAgKiBAcmV0dXJuIHtzdHJpbmd9IGEgc2luZ2xlIHVuaWNvZGUgY29kZS1wb2ludCBhcyBhIHN0cmluZy5cbiAgICovXG4gIGZ1bmN0aW9uIGxvb2t1cEVudGl0eShuYW1lKSB7XG4gICAgLy8gVE9ETzogZW50aXR5IGxvb2t1cCBhcyBzcGVjaWZpZWQgYnkgSFRNTDUgYWN0dWFsbHkgZGVwZW5kcyBvbiB0aGVcbiAgICAvLyBwcmVzZW5jZSBvZiB0aGUgXCI7XCIuXG4gICAgaWYgKEVOVElUSUVTLmhhc093blByb3BlcnR5KG5hbWUpKSB7IHJldHVybiBFTlRJVElFU1tuYW1lXTsgfVxuICAgIHZhciBtID0gbmFtZS5tYXRjaChkZWNpbWFsRXNjYXBlUmUpO1xuICAgIGlmIChtKSB7XG4gICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJzZUludChtWzFdLCAxMCkpO1xuICAgIH0gZWxzZSBpZiAoISEobSA9IG5hbWUubWF0Y2goaGV4RXNjYXBlUmUpKSkge1xuICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUocGFyc2VJbnQobVsxXSwgMTYpKTtcbiAgICB9IGVsc2UgaWYgKGVudGl0eUxvb2t1cEVsZW1lbnQgJiYgc2FmZUVudGl0eU5hbWVSZS50ZXN0KG5hbWUpKSB7XG4gICAgICBlbnRpdHlMb29rdXBFbGVtZW50LmlubmVySFRNTCA9ICcmJyArIG5hbWUgKyAnOyc7XG4gICAgICB2YXIgdGV4dCA9IGVudGl0eUxvb2t1cEVsZW1lbnQudGV4dENvbnRlbnQ7XG4gICAgICBFTlRJVElFU1tuYW1lXSA9IHRleHQ7XG4gICAgICByZXR1cm4gdGV4dDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICcmJyArIG5hbWUgKyAnOyc7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVjb2RlT25lRW50aXR5KF8sIG5hbWUpIHtcbiAgICByZXR1cm4gbG9va3VwRW50aXR5KG5hbWUpO1xuICB9XG5cbiAgdmFyIG51bFJlID0gL1xcMC9nO1xuICBmdW5jdGlvbiBzdHJpcE5VTHMocykge1xuICAgIHJldHVybiBzLnJlcGxhY2UobnVsUmUsICcnKTtcbiAgfVxuXG4gIHZhciBFTlRJVFlfUkVfMSA9IC8mKCNbMC05XSt8I1t4WF1bMC05QS1GYS1mXSt8XFx3Kyk7L2c7XG4gIHZhciBFTlRJVFlfUkVfMiA9IC9eKCNbMC05XSt8I1t4WF1bMC05QS1GYS1mXSt8XFx3Kyk7LztcbiAgLyoqXG4gICAqIFRoZSBwbGFpbiB0ZXh0IG9mIGEgY2h1bmsgb2YgSFRNTCBDREFUQSB3aGljaCBwb3NzaWJseSBjb250YWluaW5nLlxuICAgKlxuICAgKiB7XFxAdXBkb2NcbiAgICogJCB1bmVzY2FwZUVudGl0aWVzKCcnKVxuICAgKiAjICcnXG4gICAqICQgdW5lc2NhcGVFbnRpdGllcygnaGVsbG8gV29ybGQhJylcbiAgICogIyAnaGVsbG8gV29ybGQhJ1xuICAgKiAkIHVuZXNjYXBlRW50aXRpZXMoJzEgJmx0OyAyICZhbXA7JkFNUDsgNCAmZ3Q7IDMmIzEwOycpXG4gICAqICMgJzEgPCAyICYmIDQgPiAzXFxuJ1xuICAgKiAkIHVuZXNjYXBlRW50aXRpZXMoJyZsdDsmbHQgPC0gdW5maW5pc2hlZCBlbnRpdHkmZ3Q7JylcbiAgICogIyAnPCZsdCA8LSB1bmZpbmlzaGVkIGVudGl0eT4nXG4gICAqICQgdW5lc2NhcGVFbnRpdGllcygnL2Zvbz9iYXI9YmF6JmNvcHk9dHJ1ZScpICAvLyAmIG9mdGVuIHVuZXNjYXBlZCBpbiBVUkxTXG4gICAqICMgJy9mb28/YmFyPWJheiZjb3B5PXRydWUnXG4gICAqICQgdW5lc2NhcGVFbnRpdGllcygncGk9JnBpOyYjeDNjMDssIFBpPSZQaTtcXHUwM0EwJykgLy8gRklYTUU6IGtub3duIGZhaWx1cmVcbiAgICogIyAncGk9XFx1MDNDMFxcdTAzYzAsIFBpPVxcdTAzQTBcXHUwM0EwJ1xuICAgKiB9XG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBzIGEgY2h1bmsgb2YgSFRNTCBDREFUQS4gIEl0IG11c3Qgbm90IHN0YXJ0IG9yIGVuZCBpbnNpZGVcbiAgICogICAgIGFuIEhUTUwgZW50aXR5LlxuICAgKi9cbiAgZnVuY3Rpb24gdW5lc2NhcGVFbnRpdGllcyhzKSB7XG4gICAgcmV0dXJuIHMucmVwbGFjZShFTlRJVFlfUkVfMSwgZGVjb2RlT25lRW50aXR5KTtcbiAgfVxuXG4gIHZhciBhbXBSZSA9IC8mL2c7XG4gIHZhciBsb29zZUFtcFJlID0gLyYoW15hLXojXXwjKD86W14wLTl4XXx4KD86W14wLTlhLWZdfCQpfCQpfCQpL2dpO1xuICB2YXIgbHRSZSA9IC9bPF0vZztcbiAgdmFyIGd0UmUgPSAvPi9nO1xuICB2YXIgcXVvdFJlID0gL1xcXCIvZztcblxuICAvKipcbiAgICogRXNjYXBlcyBIVE1MIHNwZWNpYWwgY2hhcmFjdGVycyBpbiBhdHRyaWJ1dGUgdmFsdWVzLlxuICAgKlxuICAgKiB7XFxAdXBkb2NcbiAgICogJCBlc2NhcGVBdHRyaWIoJycpXG4gICAqICMgJydcbiAgICogJCBlc2NhcGVBdHRyaWIoJ1wiPDwmPT0mPj5cIicpICAvLyBEbyBub3QganVzdCBlc2NhcGUgdGhlIGZpcnN0IG9jY3VycmVuY2UuXG4gICAqICMgJyYjMzQ7Jmx0OyZsdDsmYW1wOyYjNjE7JiM2MTsmYW1wOyZndDsmZ3Q7JiMzNDsnXG4gICAqICQgZXNjYXBlQXR0cmliKCdIZWxsbyA8V29ybGQ+IScpXG4gICAqICMgJ0hlbGxvICZsdDtXb3JsZCZndDshJ1xuICAgKiB9XG4gICAqL1xuICBmdW5jdGlvbiBlc2NhcGVBdHRyaWIocykge1xuICAgIHJldHVybiAoJycgKyBzKS5yZXBsYWNlKGFtcFJlLCAnJmFtcDsnKS5yZXBsYWNlKGx0UmUsICcmbHQ7JylcbiAgICAgICAgLnJlcGxhY2UoZ3RSZSwgJyZndDsnKS5yZXBsYWNlKHF1b3RSZSwgJyYjMzQ7Jyk7XG4gIH1cblxuICAvKipcbiAgICogRXNjYXBlIGVudGl0aWVzIGluIFJDREFUQSB0aGF0IGNhbiBiZSBlc2NhcGVkIHdpdGhvdXQgY2hhbmdpbmcgdGhlIG1lYW5pbmcuXG4gICAqIHtcXEB1cGRvY1xuICAgKiAkIG5vcm1hbGl6ZVJDRGF0YSgnMSA8IDIgJiZhbXA7IDMgPiA0ICZhbXA7JiA1ICZsdDsgNyY4JylcbiAgICogIyAnMSAmbHQ7IDIgJmFtcDsmYW1wOyAzICZndDsgNCAmYW1wOyZhbXA7IDUgJmx0OyA3JmFtcDs4J1xuICAgKiB9XG4gICAqL1xuICBmdW5jdGlvbiBub3JtYWxpemVSQ0RhdGEocmNkYXRhKSB7XG4gICAgcmV0dXJuIHJjZGF0YVxuICAgICAgICAucmVwbGFjZShsb29zZUFtcFJlLCAnJmFtcDskMScpXG4gICAgICAgIC5yZXBsYWNlKGx0UmUsICcmbHQ7JylcbiAgICAgICAgLnJlcGxhY2UoZ3RSZSwgJyZndDsnKTtcbiAgfVxuXG4gIC8vIFRPRE8oZmVsaXg4YSk6IHZhbGlkYXRlIHNhbml0aXplciByZWdleHMgYWdhaW5zdCB0aGUgSFRNTDUgZ3JhbW1hciBhdFxuICAvLyBodHRwOi8vd3d3LndoYXR3Zy5vcmcvc3BlY3Mvd2ViLWFwcHMvY3VycmVudC13b3JrL211bHRpcGFnZS9zeW50YXguaHRtbFxuICAvLyBodHRwOi8vd3d3LndoYXR3Zy5vcmcvc3BlY3Mvd2ViLWFwcHMvY3VycmVudC13b3JrL211bHRpcGFnZS9wYXJzaW5nLmh0bWxcbiAgLy8gaHR0cDovL3d3dy53aGF0d2cub3JnL3NwZWNzL3dlYi1hcHBzL2N1cnJlbnQtd29yay9tdWx0aXBhZ2UvdG9rZW5pemF0aW9uLmh0bWxcbiAgLy8gaHR0cDovL3d3dy53aGF0d2cub3JnL3NwZWNzL3dlYi1hcHBzL2N1cnJlbnQtd29yay9tdWx0aXBhZ2UvdHJlZS1jb25zdHJ1Y3Rpb24uaHRtbFxuXG4gIC8vIFdlIGluaXRpYWxseSBzcGxpdCBpbnB1dCBzbyB0aGF0IHBvdGVudGlhbGx5IG1lYW5pbmdmdWwgY2hhcmFjdGVyc1xuICAvLyBsaWtlICc8JyBhbmQgJz4nIGFyZSBzZXBhcmF0ZSB0b2tlbnMsIHVzaW5nIGEgZmFzdCBkdW1iIHByb2Nlc3MgdGhhdFxuICAvLyBpZ25vcmVzIHF1b3RpbmcuICBUaGVuIHdlIHdhbGsgdGhhdCB0b2tlbiBzdHJlYW0sIGFuZCB3aGVuIHdlIHNlZSBhXG4gIC8vICc8JyB0aGF0J3MgdGhlIHN0YXJ0IG9mIGEgdGFnLCB3ZSB1c2UgQVRUUl9SRSB0byBleHRyYWN0IHRhZ1xuICAvLyBhdHRyaWJ1dGVzIGZyb20gdGhlIG5leHQgdG9rZW4uICBUaGF0IHRva2VuIHdpbGwgbmV2ZXIgaGF2ZSBhICc+J1xuICAvLyBjaGFyYWN0ZXIuICBIb3dldmVyLCBpdCBtaWdodCBoYXZlIGFuIHVuYmFsYW5jZWQgcXVvdGUgY2hhcmFjdGVyLCBhbmRcbiAgLy8gd2hlbiB3ZSBzZWUgdGhhdCwgd2UgY29tYmluZSBhZGRpdGlvbmFsIHRva2VucyB0byBiYWxhbmNlIHRoZSBxdW90ZS5cblxuICB2YXIgQVRUUl9SRSA9IG5ldyBSZWdFeHAoXG4gICAgJ15cXFxccyonICtcbiAgICAnKFstLjpcXFxcd10rKScgKyAgICAgICAgICAgICAvLyAxID0gQXR0cmlidXRlIG5hbWVcbiAgICAnKD86JyArIChcbiAgICAgICdcXFxccyooPSlcXFxccyonICsgICAgICAgICAgIC8vIDIgPSBJcyB0aGVyZSBhIHZhbHVlP1xuICAgICAgJygnICsgKCAgICAgICAgICAgICAgICAgICAvLyAzID0gQXR0cmlidXRlIHZhbHVlXG4gICAgICAgIC8vIFRPRE8oZmVsaXg4YSk6IG1heWJlIHVzZSBiYWNrcmVmIHRvIG1hdGNoIHF1b3Rlc1xuICAgICAgICAnKFxcXCIpW15cXFwiXSooXFxcInwkKScgKyAgICAvLyA0LCA1ID0gRG91YmxlLXF1b3RlZCBzdHJpbmdcbiAgICAgICAgJ3wnICtcbiAgICAgICAgJyhcXCcpW15cXCddKihcXCd8JCknICsgICAgLy8gNiwgNyA9IFNpbmdsZS1xdW90ZWQgc3RyaW5nXG4gICAgICAgICd8JyArXG4gICAgICAgIC8vIFBvc2l0aXZlIGxvb2thaGVhZCB0byBwcmV2ZW50IGludGVycHJldGF0aW9uIG9mXG4gICAgICAgIC8vIDxmb28gYT0gYj1jPiBhcyA8Zm9vIGE9J2I9Yyc+XG4gICAgICAgIC8vIFRPRE8oZmVsaXg4YSk6IG1pZ2h0IGJlIGFibGUgdG8gZHJvcCB0aGlzIGNhc2VcbiAgICAgICAgJyg/PVthLXpdWy1cXFxcd10qXFxcXHMqPSknICtcbiAgICAgICAgJ3wnICtcbiAgICAgICAgLy8gVW5xdW90ZWQgdmFsdWUgdGhhdCBpc24ndCBhbiBhdHRyaWJ1dGUgbmFtZVxuICAgICAgICAvLyAoc2luY2Ugd2UgZGlkbid0IG1hdGNoIHRoZSBwb3NpdGl2ZSBsb29rYWhlYWQgYWJvdmUpXG4gICAgICAgICdbXlxcXCJcXCdcXFxcc10qJyApICtcbiAgICAgICcpJyApICtcbiAgICAnKT8nLFxuICAgICdpJyk7XG5cbiAgLy8gZmFsc2Ugb24gSUU8PTgsIHRydWUgb24gbW9zdCBvdGhlciBicm93c2Vyc1xuICB2YXIgc3BsaXRXaWxsQ2FwdHVyZSA9ICgnYSxiJy5zcGxpdCgvKCwpLykubGVuZ3RoID09PSAzKTtcblxuICAvLyBiaXRtYXNrIGZvciB0YWdzIHdpdGggc3BlY2lhbCBwYXJzaW5nLCBsaWtlIDxzY3JpcHQ+IGFuZCA8dGV4dGFyZWE+XG4gIHZhciBFRkxBR1NfVEVYVCA9IGh0bWw0LmVmbGFnc1snQ0RBVEEnXSB8IGh0bWw0LmVmbGFnc1snUkNEQVRBJ107XG5cbiAgLyoqXG4gICAqIEdpdmVuIGEgU0FYLWxpa2UgZXZlbnQgaGFuZGxlciwgcHJvZHVjZSBhIGZ1bmN0aW9uIHRoYXQgZmVlZHMgdGhvc2VcbiAgICogZXZlbnRzIGFuZCBhIHBhcmFtZXRlciB0byB0aGUgZXZlbnQgaGFuZGxlci5cbiAgICpcbiAgICogVGhlIGV2ZW50IGhhbmRsZXIgaGFzIHRoZSBmb3JtOntAY29kZVxuICAgKiB7XG4gICAqICAgLy8gTmFtZSBpcyBhbiB1cHBlci1jYXNlIEhUTUwgdGFnIG5hbWUuICBBdHRyaWJzIGlzIGFuIGFycmF5IG9mXG4gICAqICAgLy8gYWx0ZXJuYXRpbmcgdXBwZXItY2FzZSBhdHRyaWJ1dGUgbmFtZXMsIGFuZCBhdHRyaWJ1dGUgdmFsdWVzLiAgVGhlXG4gICAqICAgLy8gYXR0cmlicyBhcnJheSBpcyByZXVzZWQgYnkgdGhlIHBhcnNlci4gIFBhcmFtIGlzIHRoZSB2YWx1ZSBwYXNzZWQgdG9cbiAgICogICAvLyB0aGUgc2F4UGFyc2VyLlxuICAgKiAgIHN0YXJ0VGFnOiBmdW5jdGlvbiAobmFtZSwgYXR0cmlicywgcGFyYW0pIHsgLi4uIH0sXG4gICAqICAgZW5kVGFnOiAgIGZ1bmN0aW9uIChuYW1lLCBwYXJhbSkgeyAuLi4gfSxcbiAgICogICBwY2RhdGE6ICAgZnVuY3Rpb24gKHRleHQsIHBhcmFtKSB7IC4uLiB9LFxuICAgKiAgIHJjZGF0YTogICBmdW5jdGlvbiAodGV4dCwgcGFyYW0pIHsgLi4uIH0sXG4gICAqICAgY2RhdGE6ICAgIGZ1bmN0aW9uICh0ZXh0LCBwYXJhbSkgeyAuLi4gfSxcbiAgICogICBzdGFydERvYzogZnVuY3Rpb24gKHBhcmFtKSB7IC4uLiB9LFxuICAgKiAgIGVuZERvYzogICBmdW5jdGlvbiAocGFyYW0pIHsgLi4uIH1cbiAgICogfX1cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IGhhbmRsZXIgYSByZWNvcmQgY29udGFpbmluZyBldmVudCBoYW5kbGVycy5cbiAgICogQHJldHVybiB7ZnVuY3Rpb24oc3RyaW5nLCBPYmplY3QpfSBBIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYSBjaHVuayBvZiBIVE1MXG4gICAqICAgICBhbmQgYSBwYXJhbWV0ZXIuICBUaGUgcGFyYW1ldGVyIGlzIHBhc3NlZCBvbiB0byB0aGUgaGFuZGxlciBtZXRob2RzLlxuICAgKi9cbiAgZnVuY3Rpb24gbWFrZVNheFBhcnNlcihoYW5kbGVyKSB7XG4gICAgLy8gQWNjZXB0IHF1b3RlZCBvciB1bnF1b3RlZCBrZXlzIChDbG9zdXJlIGNvbXBhdClcbiAgICB2YXIgaGNvcHkgPSB7XG4gICAgICBjZGF0YTogaGFuZGxlci5jZGF0YSB8fCBoYW5kbGVyWydjZGF0YSddLFxuICAgICAgY29tbWVudDogaGFuZGxlci5jb21tZW50IHx8IGhhbmRsZXJbJ2NvbW1lbnQnXSxcbiAgICAgIGVuZERvYzogaGFuZGxlci5lbmREb2MgfHwgaGFuZGxlclsnZW5kRG9jJ10sXG4gICAgICBlbmRUYWc6IGhhbmRsZXIuZW5kVGFnIHx8IGhhbmRsZXJbJ2VuZFRhZyddLFxuICAgICAgcGNkYXRhOiBoYW5kbGVyLnBjZGF0YSB8fCBoYW5kbGVyWydwY2RhdGEnXSxcbiAgICAgIHJjZGF0YTogaGFuZGxlci5yY2RhdGEgfHwgaGFuZGxlclsncmNkYXRhJ10sXG4gICAgICBzdGFydERvYzogaGFuZGxlci5zdGFydERvYyB8fCBoYW5kbGVyWydzdGFydERvYyddLFxuICAgICAgc3RhcnRUYWc6IGhhbmRsZXIuc3RhcnRUYWcgfHwgaGFuZGxlclsnc3RhcnRUYWcnXVxuICAgIH07XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGh0bWxUZXh0LCBwYXJhbSkge1xuICAgICAgcmV0dXJuIHBhcnNlKGh0bWxUZXh0LCBoY29weSwgcGFyYW0pO1xuICAgIH07XG4gIH1cblxuICAvLyBQYXJzaW5nIHN0cmF0ZWd5IGlzIHRvIHNwbGl0IGlucHV0IGludG8gcGFydHMgdGhhdCBtaWdodCBiZSBsZXhpY2FsbHlcbiAgLy8gbWVhbmluZ2Z1bCAoZXZlcnkgXCI+XCIgYmVjb21lcyBhIHNlcGFyYXRlIHBhcnQpLCBhbmQgdGhlbiByZWNvbWJpbmVcbiAgLy8gcGFydHMgaWYgd2UgZGlzY292ZXIgdGhleSdyZSBpbiBhIGRpZmZlcmVudCBjb250ZXh0LlxuXG4gIC8vIFRPRE8oZmVsaXg4YSk6IFNpZ25pZmljYW50IHBlcmZvcm1hbmNlIHJlZ3Jlc3Npb25zIGZyb20gLWxlZ2FjeSxcbiAgLy8gdGVzdGVkIG9uXG4gIC8vICAgIENocm9tZSAxOC4wXG4gIC8vICAgIEZpcmVmb3ggMTEuMFxuICAvLyAgICBJRSA2LCA3LCA4LCA5XG4gIC8vICAgIE9wZXJhIDExLjYxXG4gIC8vICAgIFNhZmFyaSA1LjEuM1xuICAvLyBNYW55IG9mIHRoZXNlIGFyZSB1bnVzdWFsIHBhdHRlcm5zIHRoYXQgYXJlIGxpbmVhcmx5IHNsb3dlciBhbmQgc3RpbGxcbiAgLy8gcHJldHR5IGZhc3QgKGVnIDFtcyB0byA1bXMpLCBzbyBub3QgbmVjZXNzYXJpbHkgd29ydGggZml4aW5nLlxuXG4gIC8vIFRPRE8oZmVsaXg4YSk6IFwiPHNjcmlwdD4gJiYgJiYgJiYgLi4uIDxcXC9zY3JpcHQ+XCIgaXMgc2xvd2VyIG9uIGFsbFxuICAvLyBicm93c2Vycy4gIFRoZSBob3RzcG90IGlzIGh0bWxTcGxpdC5cblxuICAvLyBUT0RPKGZlbGl4OGEpOiBcIjxwIHRpdGxlPSc+Pj4+Li4uJz48XFwvcD5cIiBpcyBzbG93ZXIgb24gYWxsIGJyb3dzZXJzLlxuICAvLyBUaGlzIGlzIHBhcnRseSBodG1sU3BsaXQsIGJ1dCB0aGUgaG90c3BvdCBpcyBwYXJzZVRhZ0FuZEF0dHJzLlxuXG4gIC8vIFRPRE8oZmVsaXg4YSk6IFwiPGE+PFxcL2E+PGE+PFxcL2E+Li4uXCIgaXMgc2xvd2VyIG9uIElFOS5cbiAgLy8gXCI8YT4xPFxcL2E+PGE+MTxcXC9hPi4uLlwiIGlzIGZhc3RlciwgXCI8YT48XFwvYT4yPGE+PFxcL2E+Mi4uLlwiIGlzIGZhc3Rlci5cblxuICAvLyBUT0RPKGZlbGl4OGEpOiBcIjxwPHA8cC4uLlwiIGlzIHNsb3dlciBvbiBJRVs2LThdXG5cbiAgdmFyIGNvbnRpbnVhdGlvbk1hcmtlciA9IHt9O1xuICBmdW5jdGlvbiBwYXJzZShodG1sVGV4dCwgaGFuZGxlciwgcGFyYW0pIHtcbiAgICB2YXIgbSwgcCwgdGFnTmFtZTtcbiAgICB2YXIgcGFydHMgPSBodG1sU3BsaXQoaHRtbFRleHQpO1xuICAgIHZhciBzdGF0ZSA9IHtcbiAgICAgIG5vTW9yZUdUOiBmYWxzZSxcbiAgICAgIG5vTW9yZUVuZENvbW1lbnRzOiBmYWxzZVxuICAgIH07XG4gICAgcGFyc2VDUFMoaGFuZGxlciwgcGFydHMsIDAsIHN0YXRlLCBwYXJhbSk7XG4gIH1cblxuICBmdW5jdGlvbiBjb250aW51YXRpb25NYWtlcihoLCBwYXJ0cywgaW5pdGlhbCwgc3RhdGUsIHBhcmFtKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIHBhcnNlQ1BTKGgsIHBhcnRzLCBpbml0aWFsLCBzdGF0ZSwgcGFyYW0pO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBwYXJzZUNQUyhoLCBwYXJ0cywgaW5pdGlhbCwgc3RhdGUsIHBhcmFtKSB7XG4gICAgdHJ5IHtcbiAgICAgIGlmIChoLnN0YXJ0RG9jICYmIGluaXRpYWwgPT0gMCkgeyBoLnN0YXJ0RG9jKHBhcmFtKTsgfVxuICAgICAgdmFyIG0sIHAsIHRhZ05hbWU7XG4gICAgICBmb3IgKHZhciBwb3MgPSBpbml0aWFsLCBlbmQgPSBwYXJ0cy5sZW5ndGg7IHBvcyA8IGVuZDspIHtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSBwYXJ0c1twb3MrK107XG4gICAgICAgIHZhciBuZXh0ID0gcGFydHNbcG9zXTtcbiAgICAgICAgc3dpdGNoIChjdXJyZW50KSB7XG4gICAgICAgIGNhc2UgJyYnOlxuICAgICAgICAgIGlmIChFTlRJVFlfUkVfMi50ZXN0KG5leHQpKSB7XG4gICAgICAgICAgICBpZiAoaC5wY2RhdGEpIHtcbiAgICAgICAgICAgICAgaC5wY2RhdGEoJyYnICsgbmV4dCwgcGFyYW0sIGNvbnRpbnVhdGlvbk1hcmtlcixcbiAgICAgICAgICAgICAgICBjb250aW51YXRpb25NYWtlcihoLCBwYXJ0cywgcG9zLCBzdGF0ZSwgcGFyYW0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaC5wY2RhdGEpIHsgaC5wY2RhdGEoXCImYW1wO1wiLCBwYXJhbSwgY29udGludWF0aW9uTWFya2VyLFxuICAgICAgICAgICAgICAgIGNvbnRpbnVhdGlvbk1ha2VyKGgsIHBhcnRzLCBwb3MsIHN0YXRlLCBwYXJhbSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnPFxcLyc6XG4gICAgICAgICAgaWYgKG0gPSAvXihbLVxcdzpdKylbXlxcJ1xcXCJdKi8uZXhlYyhuZXh0KSkge1xuICAgICAgICAgICAgaWYgKG1bMF0ubGVuZ3RoID09PSBuZXh0Lmxlbmd0aCAmJiBwYXJ0c1twb3MgKyAxXSA9PT0gJz4nKSB7XG4gICAgICAgICAgICAgIC8vIGZhc3QgY2FzZSwgbm8gYXR0cmlidXRlIHBhcnNpbmcgbmVlZGVkXG4gICAgICAgICAgICAgIHBvcyArPSAyO1xuICAgICAgICAgICAgICB0YWdOYW1lID0gbVsxXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICBpZiAoaC5lbmRUYWcpIHtcbiAgICAgICAgICAgICAgICBoLmVuZFRhZyh0YWdOYW1lLCBwYXJhbSwgY29udGludWF0aW9uTWFya2VyLFxuICAgICAgICAgICAgICAgICAgY29udGludWF0aW9uTWFrZXIoaCwgcGFydHMsIHBvcywgc3RhdGUsIHBhcmFtKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIHNsb3cgY2FzZSwgbmVlZCB0byBwYXJzZSBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgIC8vIFRPRE8oZmVsaXg4YSk6IGRvIHdlIHJlYWxseSBjYXJlIGFib3V0IG1pc3BhcnNpbmcgdGhpcz9cbiAgICAgICAgICAgICAgcG9zID0gcGFyc2VFbmRUYWcoXG4gICAgICAgICAgICAgICAgcGFydHMsIHBvcywgaCwgcGFyYW0sIGNvbnRpbnVhdGlvbk1hcmtlciwgc3RhdGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaC5wY2RhdGEpIHtcbiAgICAgICAgICAgICAgaC5wY2RhdGEoJyZsdDsvJywgcGFyYW0sIGNvbnRpbnVhdGlvbk1hcmtlcixcbiAgICAgICAgICAgICAgICBjb250aW51YXRpb25NYWtlcihoLCBwYXJ0cywgcG9zLCBzdGF0ZSwgcGFyYW0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJzwnOlxuICAgICAgICAgIGlmIChtID0gL14oWy1cXHc6XSspXFxzKlxcLz8vLmV4ZWMobmV4dCkpIHtcbiAgICAgICAgICAgIGlmIChtWzBdLmxlbmd0aCA9PT0gbmV4dC5sZW5ndGggJiYgcGFydHNbcG9zICsgMV0gPT09ICc+Jykge1xuICAgICAgICAgICAgICAvLyBmYXN0IGNhc2UsIG5vIGF0dHJpYnV0ZSBwYXJzaW5nIG5lZWRlZFxuICAgICAgICAgICAgICBwb3MgKz0gMjtcbiAgICAgICAgICAgICAgdGFnTmFtZSA9IG1bMV0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgaWYgKGguc3RhcnRUYWcpIHtcbiAgICAgICAgICAgICAgICBoLnN0YXJ0VGFnKHRhZ05hbWUsIFtdLCBwYXJhbSwgY29udGludWF0aW9uTWFya2VyLFxuICAgICAgICAgICAgICAgICAgY29udGludWF0aW9uTWFrZXIoaCwgcGFydHMsIHBvcywgc3RhdGUsIHBhcmFtKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gdGFncyBsaWtlIDxzY3JpcHQ+IGFuZCA8dGV4dGFyZWE+IGhhdmUgc3BlY2lhbCBwYXJzaW5nXG4gICAgICAgICAgICAgIHZhciBlZmxhZ3MgPSBodG1sNC5FTEVNRU5UU1t0YWdOYW1lXTtcbiAgICAgICAgICAgICAgaWYgKGVmbGFncyAmIEVGTEFHU19URVhUKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRhZyA9IHsgbmFtZTogdGFnTmFtZSwgbmV4dDogcG9zLCBlZmxhZ3M6IGVmbGFncyB9O1xuICAgICAgICAgICAgICAgIHBvcyA9IHBhcnNlVGV4dChcbiAgICAgICAgICAgICAgICAgIHBhcnRzLCB0YWcsIGgsIHBhcmFtLCBjb250aW51YXRpb25NYXJrZXIsIHN0YXRlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gc2xvdyBjYXNlLCBuZWVkIHRvIHBhcnNlIGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgcG9zID0gcGFyc2VTdGFydFRhZyhcbiAgICAgICAgICAgICAgICBwYXJ0cywgcG9zLCBoLCBwYXJhbSwgY29udGludWF0aW9uTWFya2VyLCBzdGF0ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChoLnBjZGF0YSkge1xuICAgICAgICAgICAgICBoLnBjZGF0YSgnJmx0OycsIHBhcmFtLCBjb250aW51YXRpb25NYXJrZXIsXG4gICAgICAgICAgICAgICAgY29udGludWF0aW9uTWFrZXIoaCwgcGFydHMsIHBvcywgc3RhdGUsIHBhcmFtKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICc8XFwhLS0nOlxuICAgICAgICAgIC8vIFRoZSBwYXRob2xvZ2ljYWwgY2FzZSBpcyBuIGNvcGllcyBvZiAnPFxcIS0tJyB3aXRob3V0ICctLT4nLCBhbmRcbiAgICAgICAgICAvLyByZXBlYXRlZCBmYWlsdXJlIHRvIGZpbmQgJy0tPicgaXMgcXVhZHJhdGljLiAgV2UgYXZvaWQgdGhhdCBieVxuICAgICAgICAgIC8vIHJlbWVtYmVyaW5nIHdoZW4gc2VhcmNoIGZvciAnLS0+JyBmYWlscy5cbiAgICAgICAgICBpZiAoIXN0YXRlLm5vTW9yZUVuZENvbW1lbnRzKSB7XG4gICAgICAgICAgICAvLyBBIGNvbW1lbnQgPFxcIS0teC0tPiBpcyBzcGxpdCBpbnRvIHRocmVlIHRva2VuczpcbiAgICAgICAgICAgIC8vICAgJzxcXCEtLScsICd4LS0nLCAnPidcbiAgICAgICAgICAgIC8vIFdlIHdhbnQgdG8gZmluZCB0aGUgbmV4dCAnPicgdG9rZW4gdGhhdCBoYXMgYSBwcmVjZWRpbmcgJy0tJy5cbiAgICAgICAgICAgIC8vIHBvcyBpcyBhdCB0aGUgJ3gtLScuXG4gICAgICAgICAgICBmb3IgKHAgPSBwb3MgKyAxOyBwIDwgZW5kOyBwKyspIHtcbiAgICAgICAgICAgICAgaWYgKHBhcnRzW3BdID09PSAnPicgJiYgLy0tJC8udGVzdChwYXJ0c1twIC0gMV0pKSB7IGJyZWFrOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocCA8IGVuZCkge1xuICAgICAgICAgICAgICBpZiAoaC5jb21tZW50KSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvbW1lbnQgPSBwYXJ0cy5zbGljZShwb3MsIHApLmpvaW4oJycpO1xuICAgICAgICAgICAgICAgIGguY29tbWVudChcbiAgICAgICAgICAgICAgICAgIGNvbW1lbnQuc3Vic3RyKDAsIGNvbW1lbnQubGVuZ3RoIC0gMiksIHBhcmFtLFxuICAgICAgICAgICAgICAgICAgY29udGludWF0aW9uTWFya2VyLFxuICAgICAgICAgICAgICAgICAgY29udGludWF0aW9uTWFrZXIoaCwgcGFydHMsIHAgKyAxLCBzdGF0ZSwgcGFyYW0pKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBwb3MgPSBwICsgMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHN0YXRlLm5vTW9yZUVuZENvbW1lbnRzID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHN0YXRlLm5vTW9yZUVuZENvbW1lbnRzKSB7XG4gICAgICAgICAgICBpZiAoaC5wY2RhdGEpIHtcbiAgICAgICAgICAgICAgaC5wY2RhdGEoJyZsdDshLS0nLCBwYXJhbSwgY29udGludWF0aW9uTWFya2VyLFxuICAgICAgICAgICAgICAgIGNvbnRpbnVhdGlvbk1ha2VyKGgsIHBhcnRzLCBwb3MsIHN0YXRlLCBwYXJhbSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnPFxcISc6XG4gICAgICAgICAgaWYgKCEvXlxcdy8udGVzdChuZXh0KSkge1xuICAgICAgICAgICAgaWYgKGgucGNkYXRhKSB7XG4gICAgICAgICAgICAgIGgucGNkYXRhKCcmbHQ7IScsIHBhcmFtLCBjb250aW51YXRpb25NYXJrZXIsXG4gICAgICAgICAgICAgICAgY29udGludWF0aW9uTWFrZXIoaCwgcGFydHMsIHBvcywgc3RhdGUsIHBhcmFtKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHNpbWlsYXIgdG8gbm9Nb3JlRW5kQ29tbWVudCBsb2dpY1xuICAgICAgICAgICAgaWYgKCFzdGF0ZS5ub01vcmVHVCkge1xuICAgICAgICAgICAgICBmb3IgKHAgPSBwb3MgKyAxOyBwIDwgZW5kOyBwKyspIHtcbiAgICAgICAgICAgICAgICBpZiAocGFydHNbcF0gPT09ICc+JykgeyBicmVhazsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChwIDwgZW5kKSB7XG4gICAgICAgICAgICAgICAgcG9zID0gcCArIDE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3RhdGUubm9Nb3JlR1QgPSB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3RhdGUubm9Nb3JlR1QpIHtcbiAgICAgICAgICAgICAgaWYgKGgucGNkYXRhKSB7XG4gICAgICAgICAgICAgICAgaC5wY2RhdGEoJyZsdDshJywgcGFyYW0sIGNvbnRpbnVhdGlvbk1hcmtlcixcbiAgICAgICAgICAgICAgICAgIGNvbnRpbnVhdGlvbk1ha2VyKGgsIHBhcnRzLCBwb3MsIHN0YXRlLCBwYXJhbSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICc8Pyc6XG4gICAgICAgICAgLy8gc2ltaWxhciB0byBub01vcmVFbmRDb21tZW50IGxvZ2ljXG4gICAgICAgICAgaWYgKCFzdGF0ZS5ub01vcmVHVCkge1xuICAgICAgICAgICAgZm9yIChwID0gcG9zICsgMTsgcCA8IGVuZDsgcCsrKSB7XG4gICAgICAgICAgICAgIGlmIChwYXJ0c1twXSA9PT0gJz4nKSB7IGJyZWFrOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocCA8IGVuZCkge1xuICAgICAgICAgICAgICBwb3MgPSBwICsgMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHN0YXRlLm5vTW9yZUdUID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHN0YXRlLm5vTW9yZUdUKSB7XG4gICAgICAgICAgICBpZiAoaC5wY2RhdGEpIHtcbiAgICAgICAgICAgICAgaC5wY2RhdGEoJyZsdDs/JywgcGFyYW0sIGNvbnRpbnVhdGlvbk1hcmtlcixcbiAgICAgICAgICAgICAgICBjb250aW51YXRpb25NYWtlcihoLCBwYXJ0cywgcG9zLCBzdGF0ZSwgcGFyYW0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJz4nOlxuICAgICAgICAgIGlmIChoLnBjZGF0YSkge1xuICAgICAgICAgICAgaC5wY2RhdGEoXCImZ3Q7XCIsIHBhcmFtLCBjb250aW51YXRpb25NYXJrZXIsXG4gICAgICAgICAgICAgIGNvbnRpbnVhdGlvbk1ha2VyKGgsIHBhcnRzLCBwb3MsIHN0YXRlLCBwYXJhbSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnJzpcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBpZiAoaC5wY2RhdGEpIHtcbiAgICAgICAgICAgIGgucGNkYXRhKGN1cnJlbnQsIHBhcmFtLCBjb250aW51YXRpb25NYXJrZXIsXG4gICAgICAgICAgICAgIGNvbnRpbnVhdGlvbk1ha2VyKGgsIHBhcnRzLCBwb3MsIHN0YXRlLCBwYXJhbSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGguZW5kRG9jKSB7IGguZW5kRG9jKHBhcmFtKTsgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlICE9PSBjb250aW51YXRpb25NYXJrZXIpIHsgdGhyb3cgZTsgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFNwbGl0IHN0ciBpbnRvIHBhcnRzIGZvciB0aGUgaHRtbCBwYXJzZXIuXG4gIGZ1bmN0aW9uIGh0bWxTcGxpdChzdHIpIHtcbiAgICAvLyBjYW4ndCBob2lzdCB0aGlzIG91dCBvZiB0aGUgZnVuY3Rpb24gYmVjYXVzZSBvZiB0aGUgcmUuZXhlYyBsb29wLlxuICAgIHZhciByZSA9IC8oPFxcL3w8XFwhLS18PFshP118WyY8Pl0pL2c7XG4gICAgc3RyICs9ICcnO1xuICAgIGlmIChzcGxpdFdpbGxDYXB0dXJlKSB7XG4gICAgICByZXR1cm4gc3RyLnNwbGl0KHJlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHBhcnRzID0gW107XG4gICAgICB2YXIgbGFzdFBvcyA9IDA7XG4gICAgICB2YXIgbTtcbiAgICAgIHdoaWxlICgobSA9IHJlLmV4ZWMoc3RyKSkgIT09IG51bGwpIHtcbiAgICAgICAgcGFydHMucHVzaChzdHIuc3Vic3RyaW5nKGxhc3RQb3MsIG0uaW5kZXgpKTtcbiAgICAgICAgcGFydHMucHVzaChtWzBdKTtcbiAgICAgICAgbGFzdFBvcyA9IG0uaW5kZXggKyBtWzBdLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHBhcnRzLnB1c2goc3RyLnN1YnN0cmluZyhsYXN0UG9zKSk7XG4gICAgICByZXR1cm4gcGFydHM7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcGFyc2VFbmRUYWcocGFydHMsIHBvcywgaCwgcGFyYW0sIGNvbnRpbnVhdGlvbk1hcmtlciwgc3RhdGUpIHtcbiAgICB2YXIgdGFnID0gcGFyc2VUYWdBbmRBdHRycyhwYXJ0cywgcG9zKTtcbiAgICAvLyBkcm9wIHVuY2xvc2VkIHRhZ3NcbiAgICBpZiAoIXRhZykgeyByZXR1cm4gcGFydHMubGVuZ3RoOyB9XG4gICAgaWYgKGguZW5kVGFnKSB7XG4gICAgICBoLmVuZFRhZyh0YWcubmFtZSwgcGFyYW0sIGNvbnRpbnVhdGlvbk1hcmtlcixcbiAgICAgICAgY29udGludWF0aW9uTWFrZXIoaCwgcGFydHMsIHBvcywgc3RhdGUsIHBhcmFtKSk7XG4gICAgfVxuICAgIHJldHVybiB0YWcubmV4dDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlU3RhcnRUYWcocGFydHMsIHBvcywgaCwgcGFyYW0sIGNvbnRpbnVhdGlvbk1hcmtlciwgc3RhdGUpIHtcbiAgICB2YXIgdGFnID0gcGFyc2VUYWdBbmRBdHRycyhwYXJ0cywgcG9zKTtcbiAgICAvLyBkcm9wIHVuY2xvc2VkIHRhZ3NcbiAgICBpZiAoIXRhZykgeyByZXR1cm4gcGFydHMubGVuZ3RoOyB9XG4gICAgaWYgKGguc3RhcnRUYWcpIHtcbiAgICAgIGguc3RhcnRUYWcodGFnLm5hbWUsIHRhZy5hdHRycywgcGFyYW0sIGNvbnRpbnVhdGlvbk1hcmtlcixcbiAgICAgICAgY29udGludWF0aW9uTWFrZXIoaCwgcGFydHMsIHRhZy5uZXh0LCBzdGF0ZSwgcGFyYW0pKTtcbiAgICB9XG4gICAgLy8gdGFncyBsaWtlIDxzY3JpcHQ+IGFuZCA8dGV4dGFyZWE+IGhhdmUgc3BlY2lhbCBwYXJzaW5nXG4gICAgaWYgKHRhZy5lZmxhZ3MgJiBFRkxBR1NfVEVYVCkge1xuICAgICAgcmV0dXJuIHBhcnNlVGV4dChwYXJ0cywgdGFnLCBoLCBwYXJhbSwgY29udGludWF0aW9uTWFya2VyLCBzdGF0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0YWcubmV4dDtcbiAgICB9XG4gIH1cblxuICB2YXIgZW5kVGFnUmUgPSB7fTtcblxuICAvLyBUYWdzIGxpa2UgPHNjcmlwdD4gYW5kIDx0ZXh0YXJlYT4gYXJlIGZsYWdnZWQgYXMgQ0RBVEEgb3IgUkNEQVRBLFxuICAvLyB3aGljaCBtZWFucyBldmVyeXRoaW5nIGlzIHRleHQgdW50aWwgd2Ugc2VlIHRoZSBjb3JyZWN0IGNsb3NpbmcgdGFnLlxuICBmdW5jdGlvbiBwYXJzZVRleHQocGFydHMsIHRhZywgaCwgcGFyYW0sIGNvbnRpbnVhdGlvbk1hcmtlciwgc3RhdGUpIHtcbiAgICB2YXIgZW5kID0gcGFydHMubGVuZ3RoO1xuICAgIGlmICghZW5kVGFnUmUuaGFzT3duUHJvcGVydHkodGFnLm5hbWUpKSB7XG4gICAgICBlbmRUYWdSZVt0YWcubmFtZV0gPSBuZXcgUmVnRXhwKCdeJyArIHRhZy5uYW1lICsgJyg/OltcXFxcc1xcXFwvXXwkKScsICdpJyk7XG4gICAgfVxuICAgIHZhciByZSA9IGVuZFRhZ1JlW3RhZy5uYW1lXTtcbiAgICB2YXIgZmlyc3QgPSB0YWcubmV4dDtcbiAgICB2YXIgcCA9IHRhZy5uZXh0ICsgMTtcbiAgICBmb3IgKDsgcCA8IGVuZDsgcCsrKSB7XG4gICAgICBpZiAocGFydHNbcCAtIDFdID09PSAnPFxcLycgJiYgcmUudGVzdChwYXJ0c1twXSkpIHsgYnJlYWs7IH1cbiAgICB9XG4gICAgaWYgKHAgPCBlbmQpIHsgcCAtPSAxOyB9XG4gICAgdmFyIGJ1ZiA9IHBhcnRzLnNsaWNlKGZpcnN0LCBwKS5qb2luKCcnKTtcbiAgICBpZiAodGFnLmVmbGFncyAmIGh0bWw0LmVmbGFnc1snQ0RBVEEnXSkge1xuICAgICAgaWYgKGguY2RhdGEpIHtcbiAgICAgICAgaC5jZGF0YShidWYsIHBhcmFtLCBjb250aW51YXRpb25NYXJrZXIsXG4gICAgICAgICAgY29udGludWF0aW9uTWFrZXIoaCwgcGFydHMsIHAsIHN0YXRlLCBwYXJhbSkpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGFnLmVmbGFncyAmIGh0bWw0LmVmbGFnc1snUkNEQVRBJ10pIHtcbiAgICAgIGlmIChoLnJjZGF0YSkge1xuICAgICAgICBoLnJjZGF0YShub3JtYWxpemVSQ0RhdGEoYnVmKSwgcGFyYW0sIGNvbnRpbnVhdGlvbk1hcmtlcixcbiAgICAgICAgICBjb250aW51YXRpb25NYWtlcihoLCBwYXJ0cywgcCwgc3RhdGUsIHBhcmFtKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignYnVnJyk7XG4gICAgfVxuICAgIHJldHVybiBwO1xuICB9XG5cbiAgLy8gYXQgdGhpcyBwb2ludCwgcGFydHNbcG9zLTFdIGlzIGVpdGhlciBcIjxcIiBvciBcIjxcXC9cIi5cbiAgZnVuY3Rpb24gcGFyc2VUYWdBbmRBdHRycyhwYXJ0cywgcG9zKSB7XG4gICAgdmFyIG0gPSAvXihbLVxcdzpdKykvLmV4ZWMocGFydHNbcG9zXSk7XG4gICAgdmFyIHRhZyA9IHt9O1xuICAgIHRhZy5uYW1lID0gbVsxXS50b0xvd2VyQ2FzZSgpO1xuICAgIHRhZy5lZmxhZ3MgPSBodG1sNC5FTEVNRU5UU1t0YWcubmFtZV07XG4gICAgdmFyIGJ1ZiA9IHBhcnRzW3Bvc10uc3Vic3RyKG1bMF0ubGVuZ3RoKTtcbiAgICAvLyBGaW5kIHRoZSBuZXh0ICc+Jy4gIFdlIG9wdGltaXN0aWNhbGx5IGFzc3VtZSB0aGlzICc+JyBpcyBub3QgaW4gYVxuICAgIC8vIHF1b3RlZCBjb250ZXh0LCBhbmQgZnVydGhlciBkb3duIHdlIGZpeCB0aGluZ3MgdXAgaWYgaXQgdHVybnMgb3V0IHRvXG4gICAgLy8gYmUgcXVvdGVkLlxuICAgIHZhciBwID0gcG9zICsgMTtcbiAgICB2YXIgZW5kID0gcGFydHMubGVuZ3RoO1xuICAgIGZvciAoOyBwIDwgZW5kOyBwKyspIHtcbiAgICAgIGlmIChwYXJ0c1twXSA9PT0gJz4nKSB7IGJyZWFrOyB9XG4gICAgICBidWYgKz0gcGFydHNbcF07XG4gICAgfVxuICAgIGlmIChlbmQgPD0gcCkgeyByZXR1cm4gdm9pZCAwOyB9XG4gICAgdmFyIGF0dHJzID0gW107XG4gICAgd2hpbGUgKGJ1ZiAhPT0gJycpIHtcbiAgICAgIG0gPSBBVFRSX1JFLmV4ZWMoYnVmKTtcbiAgICAgIGlmICghbSkge1xuICAgICAgICAvLyBObyBhdHRyaWJ1dGUgZm91bmQ6IHNraXAgZ2FyYmFnZVxuICAgICAgICBidWYgPSBidWYucmVwbGFjZSgvXltcXHNcXFNdW15hLXpcXHNdKi8sICcnKTtcblxuICAgICAgfSBlbHNlIGlmICgobVs0XSAmJiAhbVs1XSkgfHwgKG1bNl0gJiYgIW1bN10pKSB7XG4gICAgICAgIC8vIFVudGVybWluYXRlZCBxdW90ZTogc2x1cnAgdG8gdGhlIG5leHQgdW5xdW90ZWQgJz4nXG4gICAgICAgIHZhciBxdW90ZSA9IG1bNF0gfHwgbVs2XTtcbiAgICAgICAgdmFyIHNhd1F1b3RlID0gZmFsc2U7XG4gICAgICAgIHZhciBhYnVmID0gW2J1ZiwgcGFydHNbcCsrXV07XG4gICAgICAgIGZvciAoOyBwIDwgZW5kOyBwKyspIHtcbiAgICAgICAgICBpZiAoc2F3UXVvdGUpIHtcbiAgICAgICAgICAgIGlmIChwYXJ0c1twXSA9PT0gJz4nKSB7IGJyZWFrOyB9XG4gICAgICAgICAgfSBlbHNlIGlmICgwIDw9IHBhcnRzW3BdLmluZGV4T2YocXVvdGUpKSB7XG4gICAgICAgICAgICBzYXdRdW90ZSA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGFidWYucHVzaChwYXJ0c1twXSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gU2x1cnAgZmFpbGVkOiBsb3NlIHRoZSBnYXJiYWdlXG4gICAgICAgIGlmIChlbmQgPD0gcCkgeyBicmVhazsgfVxuICAgICAgICAvLyBPdGhlcndpc2UgcmV0cnkgYXR0cmlidXRlIHBhcnNpbmdcbiAgICAgICAgYnVmID0gYWJ1Zi5qb2luKCcnKTtcbiAgICAgICAgY29udGludWU7XG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdlIGhhdmUgYW4gYXR0cmlidXRlXG4gICAgICAgIHZhciBhTmFtZSA9IG1bMV0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgdmFyIGFWYWx1ZSA9IG1bMl0gPyBkZWNvZGVWYWx1ZShtWzNdKSA6ICcnO1xuICAgICAgICBhdHRycy5wdXNoKGFOYW1lLCBhVmFsdWUpO1xuICAgICAgICBidWYgPSBidWYuc3Vic3RyKG1bMF0ubGVuZ3RoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGFnLmF0dHJzID0gYXR0cnM7XG4gICAgdGFnLm5leHQgPSBwICsgMTtcbiAgICByZXR1cm4gdGFnO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVjb2RlVmFsdWUodikge1xuICAgIHZhciBxID0gdi5jaGFyQ29kZUF0KDApO1xuICAgIGlmIChxID09PSAweDIyIHx8IHEgPT09IDB4MjcpIHsgLy8gXCIgb3IgJ1xuICAgICAgdiA9IHYuc3Vic3RyKDEsIHYubGVuZ3RoIC0gMik7XG4gICAgfVxuICAgIHJldHVybiB1bmVzY2FwZUVudGl0aWVzKHN0cmlwTlVMcyh2KSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgc3RyaXBzIHVuc2FmZSB0YWdzIGFuZCBhdHRyaWJ1dGVzIGZyb20gaHRtbC5cbiAgICogQHBhcmFtIHtmdW5jdGlvbihzdHJpbmcsIEFycmF5LjxzdHJpbmc+KTogP0FycmF5LjxzdHJpbmc+fSB0YWdQb2xpY3lcbiAgICogICAgIEEgZnVuY3Rpb24gdGhhdCB0YWtlcyAodGFnTmFtZSwgYXR0cmlic1tdKSwgd2hlcmUgdGFnTmFtZSBpcyBhIGtleSBpblxuICAgKiAgICAgaHRtbDQuRUxFTUVOVFMgYW5kIGF0dHJpYnMgaXMgYW4gYXJyYXkgb2YgYWx0ZXJuYXRpbmcgYXR0cmlidXRlIG5hbWVzXG4gICAqICAgICBhbmQgdmFsdWVzLiAgSXQgc2hvdWxkIHJldHVybiBhIHJlY29yZCAoYXMgZm9sbG93cyksIG9yIG51bGwgdG8gZGVsZXRlXG4gICAqICAgICB0aGUgZWxlbWVudC4gIEl0J3Mgb2theSBmb3IgdGFnUG9saWN5IHRvIG1vZGlmeSB0aGUgYXR0cmlicyBhcnJheSxcbiAgICogICAgIGJ1dCB0aGUgc2FtZSBhcnJheSBpcyByZXVzZWQsIHNvIGl0IHNob3VsZCBub3QgYmUgaGVsZCBiZXR3ZWVuIGNhbGxzLlxuICAgKiAgICAgUmVjb3JkIGtleXM6XG4gICAqICAgICAgICBhdHRyaWJzOiAocmVxdWlyZWQpIFNhbml0aXplZCBhdHRyaWJ1dGVzIGFycmF5LlxuICAgKiAgICAgICAgdGFnTmFtZTogUmVwbGFjZW1lbnQgdGFnIG5hbWUuXG4gICAqIEByZXR1cm4ge2Z1bmN0aW9uKHN0cmluZywgQXJyYXkpfSBBIGZ1bmN0aW9uIHRoYXQgc2FuaXRpemVzIGEgc3RyaW5nIG9mXG4gICAqICAgICBIVE1MIGFuZCBhcHBlbmRzIHJlc3VsdCBzdHJpbmdzIHRvIHRoZSBzZWNvbmQgYXJndW1lbnQsIGFuIGFycmF5LlxuICAgKi9cbiAgZnVuY3Rpb24gbWFrZUh0bWxTYW5pdGl6ZXIodGFnUG9saWN5KSB7XG4gICAgdmFyIHN0YWNrO1xuICAgIHZhciBpZ25vcmluZztcbiAgICB2YXIgZW1pdCA9IGZ1bmN0aW9uICh0ZXh0LCBvdXQpIHtcbiAgICAgIGlmICghaWdub3JpbmcpIHsgb3V0LnB1c2godGV4dCk7IH1cbiAgICB9O1xuICAgIHJldHVybiBtYWtlU2F4UGFyc2VyKHtcbiAgICAgICdzdGFydERvYyc6IGZ1bmN0aW9uKF8pIHtcbiAgICAgICAgc3RhY2sgPSBbXTtcbiAgICAgICAgaWdub3JpbmcgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgICAnc3RhcnRUYWcnOiBmdW5jdGlvbih0YWdOYW1lT3JpZywgYXR0cmlicywgb3V0KSB7XG4gICAgICAgIGlmIChpZ25vcmluZykgeyByZXR1cm47IH1cbiAgICAgICAgaWYgKCFodG1sNC5FTEVNRU5UUy5oYXNPd25Qcm9wZXJ0eSh0YWdOYW1lT3JpZykpIHsgcmV0dXJuOyB9XG4gICAgICAgIHZhciBlZmxhZ3NPcmlnID0gaHRtbDQuRUxFTUVOVFNbdGFnTmFtZU9yaWddO1xuICAgICAgICBpZiAoZWZsYWdzT3JpZyAmIGh0bWw0LmVmbGFnc1snRk9MREFCTEUnXSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBkZWNpc2lvbiA9IHRhZ1BvbGljeSh0YWdOYW1lT3JpZywgYXR0cmlicyk7XG4gICAgICAgIGlmICghZGVjaXNpb24pIHtcbiAgICAgICAgICBpZ25vcmluZyA9ICEoZWZsYWdzT3JpZyAmIGh0bWw0LmVmbGFnc1snRU1QVFknXSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkZWNpc2lvbiAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3RhZ1BvbGljeSBkaWQgbm90IHJldHVybiBvYmplY3QgKG9sZCBBUEk/KScpO1xuICAgICAgICB9XG4gICAgICAgIGlmICgnYXR0cmlicycgaW4gZGVjaXNpb24pIHtcbiAgICAgICAgICBhdHRyaWJzID0gZGVjaXNpb25bJ2F0dHJpYnMnXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3RhZ1BvbGljeSBnYXZlIG5vIGF0dHJpYnMnKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZWZsYWdzUmVwO1xuICAgICAgICB2YXIgdGFnTmFtZVJlcDtcbiAgICAgICAgaWYgKCd0YWdOYW1lJyBpbiBkZWNpc2lvbikge1xuICAgICAgICAgIHRhZ05hbWVSZXAgPSBkZWNpc2lvblsndGFnTmFtZSddO1xuICAgICAgICAgIGVmbGFnc1JlcCA9IGh0bWw0LkVMRU1FTlRTW3RhZ05hbWVSZXBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRhZ05hbWVSZXAgPSB0YWdOYW1lT3JpZztcbiAgICAgICAgICBlZmxhZ3NSZXAgPSBlZmxhZ3NPcmlnO1xuICAgICAgICB9XG4gICAgICAgIC8vIFRPRE8obWlrZXNhbXVlbCk6IHJlbHlpbmcgb24gdGFnUG9saWN5IG5vdCB0byBpbnNlcnQgdW5zYWZlXG4gICAgICAgIC8vIGF0dHJpYnV0ZSBuYW1lcy5cblxuICAgICAgICAvLyBJZiB0aGlzIGlzIGFuIG9wdGlvbmFsLWVuZC10YWcgZWxlbWVudCBhbmQgZWl0aGVyIHRoaXMgZWxlbWVudCBvciBpdHNcbiAgICAgICAgLy8gcHJldmlvdXMgbGlrZSBzaWJsaW5nIHdhcyByZXdyaXR0ZW4sIHRoZW4gaW5zZXJ0IGEgY2xvc2UgdGFnIHRvXG4gICAgICAgIC8vIHByZXNlcnZlIHN0cnVjdHVyZS5cbiAgICAgICAgaWYgKGVmbGFnc09yaWcgJiBodG1sNC5lZmxhZ3NbJ09QVElPTkFMX0VORFRBRyddKSB7XG4gICAgICAgICAgdmFyIG9uU3RhY2sgPSBzdGFja1tzdGFjay5sZW5ndGggLSAxXTtcbiAgICAgICAgICBpZiAob25TdGFjayAmJiBvblN0YWNrLm9yaWcgPT09IHRhZ05hbWVPcmlnICYmXG4gICAgICAgICAgICAgIChvblN0YWNrLnJlcCAhPT0gdGFnTmFtZVJlcCB8fCB0YWdOYW1lT3JpZyAhPT0gdGFnTmFtZVJlcCkpIHtcbiAgICAgICAgICAgICAgICBvdXQucHVzaCgnPFxcLycsIG9uU3RhY2sucmVwLCAnPicpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghKGVmbGFnc09yaWcgJiBodG1sNC5lZmxhZ3NbJ0VNUFRZJ10pKSB7XG4gICAgICAgICAgc3RhY2sucHVzaCh7b3JpZzogdGFnTmFtZU9yaWcsIHJlcDogdGFnTmFtZVJlcH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgb3V0LnB1c2goJzwnLCB0YWdOYW1lUmVwKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBhdHRyaWJzLmxlbmd0aDsgaSA8IG47IGkgKz0gMikge1xuICAgICAgICAgIHZhciBhdHRyaWJOYW1lID0gYXR0cmlic1tpXSxcbiAgICAgICAgICAgICAgdmFsdWUgPSBhdHRyaWJzW2kgKyAxXTtcbiAgICAgICAgICBpZiAodmFsdWUgIT09IG51bGwgJiYgdmFsdWUgIT09IHZvaWQgMCkge1xuICAgICAgICAgICAgb3V0LnB1c2goJyAnLCBhdHRyaWJOYW1lLCAnPVwiJywgZXNjYXBlQXR0cmliKHZhbHVlKSwgJ1wiJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG91dC5wdXNoKCc+Jyk7XG5cbiAgICAgICAgaWYgKChlZmxhZ3NPcmlnICYgaHRtbDQuZWZsYWdzWydFTVBUWSddKVxuICAgICAgICAgICAgJiYgIShlZmxhZ3NSZXAgJiBodG1sNC5lZmxhZ3NbJ0VNUFRZJ10pKSB7XG4gICAgICAgICAgLy8gcmVwbGFjZW1lbnQgaXMgbm9uLWVtcHR5LCBzeW50aGVzaXplIGVuZCB0YWdcbiAgICAgICAgICBvdXQucHVzaCgnPFxcLycsIHRhZ05hbWVSZXAsICc+Jyk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAnZW5kVGFnJzogZnVuY3Rpb24odGFnTmFtZSwgb3V0KSB7XG4gICAgICAgIGlmIChpZ25vcmluZykge1xuICAgICAgICAgIGlnbm9yaW5nID0gZmFsc2U7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaHRtbDQuRUxFTUVOVFMuaGFzT3duUHJvcGVydHkodGFnTmFtZSkpIHsgcmV0dXJuOyB9XG4gICAgICAgIHZhciBlZmxhZ3MgPSBodG1sNC5FTEVNRU5UU1t0YWdOYW1lXTtcbiAgICAgICAgaWYgKCEoZWZsYWdzICYgKGh0bWw0LmVmbGFnc1snRU1QVFknXSB8IGh0bWw0LmVmbGFnc1snRk9MREFCTEUnXSkpKSB7XG4gICAgICAgICAgdmFyIGluZGV4O1xuICAgICAgICAgIGlmIChlZmxhZ3MgJiBodG1sNC5lZmxhZ3NbJ09QVElPTkFMX0VORFRBRyddKSB7XG4gICAgICAgICAgICBmb3IgKGluZGV4ID0gc3RhY2subGVuZ3RoOyAtLWluZGV4ID49IDA7KSB7XG4gICAgICAgICAgICAgIHZhciBzdGFja0VsT3JpZ1RhZyA9IHN0YWNrW2luZGV4XS5vcmlnO1xuICAgICAgICAgICAgICBpZiAoc3RhY2tFbE9yaWdUYWcgPT09IHRhZ05hbWUpIHsgYnJlYWs7IH1cbiAgICAgICAgICAgICAgaWYgKCEoaHRtbDQuRUxFTUVOVFNbc3RhY2tFbE9yaWdUYWddICZcbiAgICAgICAgICAgICAgICAgICAgaHRtbDQuZWZsYWdzWydPUFRJT05BTF9FTkRUQUcnXSkpIHtcbiAgICAgICAgICAgICAgICAvLyBEb24ndCBwb3Agbm9uIG9wdGlvbmFsIGVuZCB0YWdzIGxvb2tpbmcgZm9yIGEgbWF0Y2guXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAoaW5kZXggPSBzdGFjay5sZW5ndGg7IC0taW5kZXggPj0gMDspIHtcbiAgICAgICAgICAgICAgaWYgKHN0YWNrW2luZGV4XS5vcmlnID09PSB0YWdOYW1lKSB7IGJyZWFrOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpbmRleCA8IDApIHsgcmV0dXJuOyB9ICAvLyBOb3Qgb3BlbmVkLlxuICAgICAgICAgIGZvciAodmFyIGkgPSBzdGFjay5sZW5ndGg7IC0taSA+IGluZGV4Oykge1xuICAgICAgICAgICAgdmFyIHN0YWNrRWxSZXBUYWcgPSBzdGFja1tpXS5yZXA7XG4gICAgICAgICAgICBpZiAoIShodG1sNC5FTEVNRU5UU1tzdGFja0VsUmVwVGFnXSAmXG4gICAgICAgICAgICAgICAgICBodG1sNC5lZmxhZ3NbJ09QVElPTkFMX0VORFRBRyddKSkge1xuICAgICAgICAgICAgICBvdXQucHVzaCgnPFxcLycsIHN0YWNrRWxSZXBUYWcsICc+Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpbmRleCA8IHN0YWNrLmxlbmd0aCkge1xuICAgICAgICAgICAgdGFnTmFtZSA9IHN0YWNrW2luZGV4XS5yZXA7XG4gICAgICAgICAgfVxuICAgICAgICAgIHN0YWNrLmxlbmd0aCA9IGluZGV4O1xuICAgICAgICAgIG91dC5wdXNoKCc8XFwvJywgdGFnTmFtZSwgJz4nKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgICdwY2RhdGEnOiBlbWl0LFxuICAgICAgJ3JjZGF0YSc6IGVtaXQsXG4gICAgICAnY2RhdGEnOiBlbWl0LFxuICAgICAgJ2VuZERvYyc6IGZ1bmN0aW9uKG91dCkge1xuICAgICAgICBmb3IgKDsgc3RhY2subGVuZ3RoOyBzdGFjay5sZW5ndGgtLSkge1xuICAgICAgICAgIG91dC5wdXNoKCc8XFwvJywgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0ucmVwLCAnPicpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICB2YXIgQUxMT1dFRF9VUklfU0NIRU1FUyA9IC9eKD86aHR0cHM/fG1haWx0b3xkYXRhKSQvaTtcblxuICBmdW5jdGlvbiBzYWZlVXJpKHVyaSwgZWZmZWN0LCBsdHlwZSwgaGludHMsIG5haXZlVXJpUmV3cml0ZXIpIHtcbiAgICBpZiAoIW5haXZlVXJpUmV3cml0ZXIpIHsgcmV0dXJuIG51bGw7IH1cbiAgICB0cnkge1xuICAgICAgdmFyIHBhcnNlZCA9IFVSSS5wYXJzZSgnJyArIHVyaSk7XG4gICAgICBpZiAocGFyc2VkKSB7XG4gICAgICAgIGlmICghcGFyc2VkLmhhc1NjaGVtZSgpIHx8XG4gICAgICAgICAgICBBTExPV0VEX1VSSV9TQ0hFTUVTLnRlc3QocGFyc2VkLmdldFNjaGVtZSgpKSkge1xuICAgICAgICAgIHZhciBzYWZlID0gbmFpdmVVcmlSZXdyaXRlcihwYXJzZWQsIGVmZmVjdCwgbHR5cGUsIGhpbnRzKTtcbiAgICAgICAgICByZXR1cm4gc2FmZSA/IHNhZmUudG9TdHJpbmcoKSA6IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBmdW5jdGlvbiBsb2cobG9nZ2VyLCB0YWdOYW1lLCBhdHRyaWJOYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICBpZiAoIWF0dHJpYk5hbWUpIHtcbiAgICAgIGxvZ2dlcih0YWdOYW1lICsgXCIgcmVtb3ZlZFwiLCB7XG4gICAgICAgIGNoYW5nZTogXCJyZW1vdmVkXCIsXG4gICAgICAgIHRhZ05hbWU6IHRhZ05hbWVcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAob2xkVmFsdWUgIT09IG5ld1ZhbHVlKSB7XG4gICAgICB2YXIgY2hhbmdlZCA9IFwiY2hhbmdlZFwiO1xuICAgICAgaWYgKG9sZFZhbHVlICYmICFuZXdWYWx1ZSkge1xuICAgICAgICBjaGFuZ2VkID0gXCJyZW1vdmVkXCI7XG4gICAgICB9IGVsc2UgaWYgKCFvbGRWYWx1ZSAmJiBuZXdWYWx1ZSkgIHtcbiAgICAgICAgY2hhbmdlZCA9IFwiYWRkZWRcIjtcbiAgICAgIH1cbiAgICAgIGxvZ2dlcih0YWdOYW1lICsgXCIuXCIgKyBhdHRyaWJOYW1lICsgXCIgXCIgKyBjaGFuZ2VkLCB7XG4gICAgICAgIGNoYW5nZTogY2hhbmdlZCxcbiAgICAgICAgdGFnTmFtZTogdGFnTmFtZSxcbiAgICAgICAgYXR0cmliTmFtZTogYXR0cmliTmFtZSxcbiAgICAgICAgb2xkVmFsdWU6IG9sZFZhbHVlLFxuICAgICAgICBuZXdWYWx1ZTogbmV3VmFsdWVcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGxvb2t1cEF0dHJpYnV0ZShtYXAsIHRhZ05hbWUsIGF0dHJpYk5hbWUpIHtcbiAgICB2YXIgYXR0cmliS2V5O1xuICAgIGF0dHJpYktleSA9IHRhZ05hbWUgKyAnOjonICsgYXR0cmliTmFtZTtcbiAgICBpZiAobWFwLmhhc093blByb3BlcnR5KGF0dHJpYktleSkpIHtcbiAgICAgIHJldHVybiBtYXBbYXR0cmliS2V5XTtcbiAgICB9XG4gICAgYXR0cmliS2V5ID0gJyo6OicgKyBhdHRyaWJOYW1lO1xuICAgIGlmIChtYXAuaGFzT3duUHJvcGVydHkoYXR0cmliS2V5KSkge1xuICAgICAgcmV0dXJuIG1hcFthdHRyaWJLZXldO1xuICAgIH1cbiAgICByZXR1cm4gdm9pZCAwO1xuICB9XG4gIGZ1bmN0aW9uIGdldEF0dHJpYnV0ZVR5cGUodGFnTmFtZSwgYXR0cmliTmFtZSkge1xuICAgIHJldHVybiBsb29rdXBBdHRyaWJ1dGUoaHRtbDQuQVRUUklCUywgdGFnTmFtZSwgYXR0cmliTmFtZSk7XG4gIH1cbiAgZnVuY3Rpb24gZ2V0TG9hZGVyVHlwZSh0YWdOYW1lLCBhdHRyaWJOYW1lKSB7XG4gICAgcmV0dXJuIGxvb2t1cEF0dHJpYnV0ZShodG1sNC5MT0FERVJUWVBFUywgdGFnTmFtZSwgYXR0cmliTmFtZSk7XG4gIH1cbiAgZnVuY3Rpb24gZ2V0VXJpRWZmZWN0KHRhZ05hbWUsIGF0dHJpYk5hbWUpIHtcbiAgICByZXR1cm4gbG9va3VwQXR0cmlidXRlKGh0bWw0LlVSSUVGRkVDVFMsIHRhZ05hbWUsIGF0dHJpYk5hbWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNhbml0aXplcyBhdHRyaWJ1dGVzIG9uIGFuIEhUTUwgdGFnLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdGFnTmFtZSBBbiBIVE1MIHRhZyBuYW1lIGluIGxvd2VyY2FzZS5cbiAgICogQHBhcmFtIHtBcnJheS48P3N0cmluZz59IGF0dHJpYnMgQW4gYXJyYXkgb2YgYWx0ZXJuYXRpbmcgbmFtZXMgYW5kIHZhbHVlcy5cbiAgICogQHBhcmFtIHs/ZnVuY3Rpb24oP3N0cmluZyk6ID9zdHJpbmd9IG9wdF9uYWl2ZVVyaVJld3JpdGVyIEEgdHJhbnNmb3JtIHRvXG4gICAqICAgICBhcHBseSB0byBVUkkgYXR0cmlidXRlczsgaXQgY2FuIHJldHVybiBhIG5ldyBzdHJpbmcgdmFsdWUsIG9yIG51bGwgdG9cbiAgICogICAgIGRlbGV0ZSB0aGUgYXR0cmlidXRlLiAgSWYgdW5zcGVjaWZpZWQsIFVSSSBhdHRyaWJ1dGVzIGFyZSBkZWxldGVkLlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9uKD9zdHJpbmcpOiA/c3RyaW5nfSBvcHRfbm1Ub2tlblBvbGljeSBBIHRyYW5zZm9ybSB0byBhcHBseVxuICAgKiAgICAgdG8gYXR0cmlidXRlcyBjb250YWluaW5nIEhUTUwgbmFtZXMsIGVsZW1lbnQgSURzLCBhbmQgc3BhY2Utc2VwYXJhdGVkXG4gICAqICAgICBsaXN0cyBvZiBjbGFzc2VzOyBpdCBjYW4gcmV0dXJuIGEgbmV3IHN0cmluZyB2YWx1ZSwgb3IgbnVsbCB0byBkZWxldGVcbiAgICogICAgIHRoZSBhdHRyaWJ1dGUuICBJZiB1bnNwZWNpZmllZCwgdGhlc2UgYXR0cmlidXRlcyBhcmUga2VwdCB1bmNoYW5nZWQuXG4gICAqIEByZXR1cm4ge0FycmF5Ljw/c3RyaW5nPn0gVGhlIHNhbml0aXplZCBhdHRyaWJ1dGVzIGFzIGEgbGlzdCBvZiBhbHRlcm5hdGluZ1xuICAgKiAgICAgbmFtZXMgYW5kIHZhbHVlcywgd2hlcmUgYSBudWxsIHZhbHVlIG1lYW5zIHRvIG9taXQgdGhlIGF0dHJpYnV0ZS5cbiAgICovXG4gIGZ1bmN0aW9uIHNhbml0aXplQXR0cmlicyh0YWdOYW1lLCBhdHRyaWJzLFxuICAgIG9wdF9uYWl2ZVVyaVJld3JpdGVyLCBvcHRfbm1Ub2tlblBvbGljeSwgb3B0X2xvZ2dlcikge1xuICAgIC8vIFRPRE8oZmVsaXg4YSk6IGl0J3Mgb2Jub3hpb3VzIHRoYXQgZG9tYWRvIGR1cGxpY2F0ZXMgbXVjaCBvZiB0aGlzXG4gICAgLy8gVE9ETyhmZWxpeDhhKTogbWF5YmUgY29uc2lzdGVudGx5IGVuZm9yY2UgY29uc3RyYWludHMgbGlrZSB0YXJnZXQ9XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhdHRyaWJzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICB2YXIgYXR0cmliTmFtZSA9IGF0dHJpYnNbaV07XG4gICAgICB2YXIgdmFsdWUgPSBhdHRyaWJzW2kgKyAxXTtcbiAgICAgIHZhciBvbGRWYWx1ZSA9IHZhbHVlO1xuICAgICAgdmFyIGF0eXBlID0gbnVsbCwgYXR0cmliS2V5O1xuICAgICAgaWYgKChhdHRyaWJLZXkgPSB0YWdOYW1lICsgJzo6JyArIGF0dHJpYk5hbWUsXG4gICAgICAgICAgIGh0bWw0LkFUVFJJQlMuaGFzT3duUHJvcGVydHkoYXR0cmliS2V5KSkgfHxcbiAgICAgICAgICAoYXR0cmliS2V5ID0gJyo6OicgKyBhdHRyaWJOYW1lLFxuICAgICAgICAgICBodG1sNC5BVFRSSUJTLmhhc093blByb3BlcnR5KGF0dHJpYktleSkpKSB7XG4gICAgICAgIGF0eXBlID0gaHRtbDQuQVRUUklCU1thdHRyaWJLZXldO1xuICAgICAgfVxuICAgICAgaWYgKGF0eXBlICE9PSBudWxsKSB7XG4gICAgICAgIHN3aXRjaCAoYXR5cGUpIHtcbiAgICAgICAgICBjYXNlIGh0bWw0LmF0eXBlWydOT05FJ106IGJyZWFrO1xuICAgICAgICAgIGNhc2UgaHRtbDQuYXR5cGVbJ1NDUklQVCddOlxuICAgICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICAgICAgaWYgKG9wdF9sb2dnZXIpIHtcbiAgICAgICAgICAgICAgbG9nKG9wdF9sb2dnZXIsIHRhZ05hbWUsIGF0dHJpYk5hbWUsIG9sZFZhbHVlLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIGh0bWw0LmF0eXBlWydTVFlMRSddOlxuICAgICAgICAgICAgaWYgKCd1bmRlZmluZWQnID09PSB0eXBlb2YgcGFyc2VDc3NEZWNsYXJhdGlvbnMpIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICAgICAgICBpZiAob3B0X2xvZ2dlcikge1xuICAgICAgICAgICAgICAgIGxvZyhvcHRfbG9nZ2VyLCB0YWdOYW1lLCBhdHRyaWJOYW1lLCBvbGRWYWx1ZSwgdmFsdWUpO1xuXHQgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHNhbml0aXplZERlY2xhcmF0aW9ucyA9IFtdO1xuICAgICAgICAgICAgcGFyc2VDc3NEZWNsYXJhdGlvbnMoXG4gICAgICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgZGVjbGFyYXRpb246IGZ1bmN0aW9uIChwcm9wZXJ0eSwgdG9rZW5zKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBub3JtUHJvcCA9IHByb3BlcnR5LnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzY2hlbWEgPSBjc3NTY2hlbWFbbm9ybVByb3BdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXNjaGVtYSkge1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzYW5pdGl6ZUNzc1Byb3BlcnR5KFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9ybVByb3AsIHNjaGVtYSwgdG9rZW5zLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3B0X25haXZlVXJpUmV3cml0ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgID8gZnVuY3Rpb24gKHVybCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzYWZlVXJpKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cmwsIGh0bWw0LnVlZmZlY3RzLlNBTUVfRE9DVU1FTlQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGh0bWw0Lmx0eXBlcy5TQU5EQk9YRUQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlRZUEVcIjogXCJDU1NcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkNTU19QUk9QXCI6IG5vcm1Qcm9wXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIG9wdF9uYWl2ZVVyaVJld3JpdGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgOiBudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgc2FuaXRpemVkRGVjbGFyYXRpb25zLnB1c2gocHJvcGVydHkgKyAnOiAnICsgdG9rZW5zLmpvaW4oJyAnKSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB2YWx1ZSA9IHNhbml0aXplZERlY2xhcmF0aW9ucy5sZW5ndGggPiAwID9cbiAgICAgICAgICAgICAgc2FuaXRpemVkRGVjbGFyYXRpb25zLmpvaW4oJyA7ICcpIDogbnVsbDtcbiAgICAgICAgICAgIGlmIChvcHRfbG9nZ2VyKSB7XG4gICAgICAgICAgICAgIGxvZyhvcHRfbG9nZ2VyLCB0YWdOYW1lLCBhdHRyaWJOYW1lLCBvbGRWYWx1ZSwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBodG1sNC5hdHlwZVsnSUQnXTpcbiAgICAgICAgICBjYXNlIGh0bWw0LmF0eXBlWydJRFJFRiddOlxuICAgICAgICAgIGNhc2UgaHRtbDQuYXR5cGVbJ0lEUkVGUyddOlxuICAgICAgICAgIGNhc2UgaHRtbDQuYXR5cGVbJ0dMT0JBTF9OQU1FJ106XG4gICAgICAgICAgY2FzZSBodG1sNC5hdHlwZVsnTE9DQUxfTkFNRSddOlxuICAgICAgICAgIGNhc2UgaHRtbDQuYXR5cGVbJ0NMQVNTRVMnXTpcbiAgICAgICAgICAgIHZhbHVlID0gb3B0X25tVG9rZW5Qb2xpY3kgPyBvcHRfbm1Ub2tlblBvbGljeSh2YWx1ZSkgOiB2YWx1ZTtcbiAgICAgICAgICAgIGlmIChvcHRfbG9nZ2VyKSB7XG4gICAgICAgICAgICAgIGxvZyhvcHRfbG9nZ2VyLCB0YWdOYW1lLCBhdHRyaWJOYW1lLCBvbGRWYWx1ZSwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBodG1sNC5hdHlwZVsnVVJJJ106XG4gICAgICAgICAgICB2YWx1ZSA9IHNhZmVVcmkodmFsdWUsXG4gICAgICAgICAgICAgIGdldFVyaUVmZmVjdCh0YWdOYW1lLCBhdHRyaWJOYW1lKSxcbiAgICAgICAgICAgICAgZ2V0TG9hZGVyVHlwZSh0YWdOYW1lLCBhdHRyaWJOYW1lKSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIFwiVFlQRVwiOiBcIk1BUktVUFwiLFxuICAgICAgICAgICAgICAgIFwiWE1MX0FUVFJcIjogYXR0cmliTmFtZSxcbiAgICAgICAgICAgICAgICBcIlhNTF9UQUdcIjogdGFnTmFtZVxuICAgICAgICAgICAgICB9LCBvcHRfbmFpdmVVcmlSZXdyaXRlcik7XG4gICAgICAgICAgICAgIGlmIChvcHRfbG9nZ2VyKSB7XG4gICAgICAgICAgICAgIGxvZyhvcHRfbG9nZ2VyLCB0YWdOYW1lLCBhdHRyaWJOYW1lLCBvbGRWYWx1ZSwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBodG1sNC5hdHlwZVsnVVJJX0ZSQUdNRU5UJ106XG4gICAgICAgICAgICBpZiAodmFsdWUgJiYgJyMnID09PSB2YWx1ZS5jaGFyQXQoMCkpIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZS5zdWJzdHJpbmcoMSk7ICAvLyByZW1vdmUgdGhlIGxlYWRpbmcgJyMnXG4gICAgICAgICAgICAgIHZhbHVlID0gb3B0X25tVG9rZW5Qb2xpY3kgPyBvcHRfbm1Ub2tlblBvbGljeSh2YWx1ZSkgOiB2YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB2b2lkIDApIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9ICcjJyArIHZhbHVlOyAgLy8gcmVzdG9yZSB0aGUgbGVhZGluZyAnIydcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdF9sb2dnZXIpIHtcbiAgICAgICAgICAgICAgbG9nKG9wdF9sb2dnZXIsIHRhZ05hbWUsIGF0dHJpYk5hbWUsIG9sZFZhbHVlLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICAgICAgaWYgKG9wdF9sb2dnZXIpIHtcbiAgICAgICAgICAgICAgbG9nKG9wdF9sb2dnZXIsIHRhZ05hbWUsIGF0dHJpYk5hbWUsIG9sZFZhbHVlLCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICBpZiAob3B0X2xvZ2dlcikge1xuICAgICAgICAgIGxvZyhvcHRfbG9nZ2VyLCB0YWdOYW1lLCBhdHRyaWJOYW1lLCBvbGRWYWx1ZSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBhdHRyaWJzW2kgKyAxXSA9IHZhbHVlO1xuICAgIH1cbiAgICByZXR1cm4gYXR0cmlicztcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgdGFnIHBvbGljeSB0aGF0IG9taXRzIGFsbCB0YWdzIG1hcmtlZCBVTlNBRkUgaW4gaHRtbDQtZGVmcy5qc1xuICAgKiBhbmQgYXBwbGllcyB0aGUgZGVmYXVsdCBhdHRyaWJ1dGUgc2FuaXRpemVyIHdpdGggdGhlIHN1cHBsaWVkIHBvbGljeSBmb3JcbiAgICogVVJJIGF0dHJpYnV0ZXMgYW5kIE5NVE9LRU4gYXR0cmlidXRlcy5cbiAgICogQHBhcmFtIHs/ZnVuY3Rpb24oP3N0cmluZyk6ID9zdHJpbmd9IG9wdF9uYWl2ZVVyaVJld3JpdGVyIEEgdHJhbnNmb3JtIHRvXG4gICAqICAgICBhcHBseSB0byBVUkkgYXR0cmlidXRlcy4gIElmIG5vdCBnaXZlbiwgVVJJIGF0dHJpYnV0ZXMgYXJlIGRlbGV0ZWQuXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb24oP3N0cmluZyk6ID9zdHJpbmd9IG9wdF9ubVRva2VuUG9saWN5IEEgdHJhbnNmb3JtIHRvIGFwcGx5XG4gICAqICAgICB0byBhdHRyaWJ1dGVzIGNvbnRhaW5pbmcgSFRNTCBuYW1lcywgZWxlbWVudCBJRHMsIGFuZCBzcGFjZS1zZXBhcmF0ZWRcbiAgICogICAgIGxpc3RzIG9mIGNsYXNzZXMuICBJZiBub3QgZ2l2ZW4sIHN1Y2ggYXR0cmlidXRlcyBhcmUgbGVmdCB1bmNoYW5nZWQuXG4gICAqIEByZXR1cm4ge2Z1bmN0aW9uKHN0cmluZywgQXJyYXkuPD9zdHJpbmc+KX0gQSB0YWdQb2xpY3kgc3VpdGFibGUgZm9yXG4gICAqICAgICBwYXNzaW5nIHRvIGh0bWwuc2FuaXRpemUuXG4gICAqL1xuICBmdW5jdGlvbiBtYWtlVGFnUG9saWN5KFxuICAgIG9wdF9uYWl2ZVVyaVJld3JpdGVyLCBvcHRfbm1Ub2tlblBvbGljeSwgb3B0X2xvZ2dlcikge1xuICAgIHJldHVybiBmdW5jdGlvbih0YWdOYW1lLCBhdHRyaWJzKSB7XG4gICAgICBpZiAoIShodG1sNC5FTEVNRU5UU1t0YWdOYW1lXSAmIGh0bWw0LmVmbGFnc1snVU5TQUZFJ10pKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgJ2F0dHJpYnMnOiBzYW5pdGl6ZUF0dHJpYnModGFnTmFtZSwgYXR0cmlicyxcbiAgICAgICAgICAgIG9wdF9uYWl2ZVVyaVJld3JpdGVyLCBvcHRfbm1Ub2tlblBvbGljeSwgb3B0X2xvZ2dlcilcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChvcHRfbG9nZ2VyKSB7XG4gICAgICAgICAgbG9nKG9wdF9sb2dnZXIsIHRhZ05hbWUsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTYW5pdGl6ZXMgSFRNTCB0YWdzIGFuZCBhdHRyaWJ1dGVzIGFjY29yZGluZyB0byBhIGdpdmVuIHBvbGljeS5cbiAgICogQHBhcmFtIHtzdHJpbmd9IGlucHV0SHRtbCBUaGUgSFRNTCB0byBzYW5pdGl6ZS5cbiAgICogQHBhcmFtIHtmdW5jdGlvbihzdHJpbmcsIEFycmF5Ljw/c3RyaW5nPil9IHRhZ1BvbGljeSBBIGZ1bmN0aW9uIHRoYXRcbiAgICogICAgIGRlY2lkZXMgd2hpY2ggdGFncyB0byBhY2NlcHQgYW5kIHNhbml0aXplcyB0aGVpciBhdHRyaWJ1dGVzIChzZWVcbiAgICogICAgIG1ha2VIdG1sU2FuaXRpemVyIGFib3ZlIGZvciBkZXRhaWxzKS5cbiAgICogQHJldHVybiB7c3RyaW5nfSBUaGUgc2FuaXRpemVkIEhUTUwuXG4gICAqL1xuICBmdW5jdGlvbiBzYW5pdGl6ZVdpdGhQb2xpY3koaW5wdXRIdG1sLCB0YWdQb2xpY3kpIHtcbiAgICB2YXIgb3V0cHV0QXJyYXkgPSBbXTtcbiAgICBtYWtlSHRtbFNhbml0aXplcih0YWdQb2xpY3kpKGlucHV0SHRtbCwgb3V0cHV0QXJyYXkpO1xuICAgIHJldHVybiBvdXRwdXRBcnJheS5qb2luKCcnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdHJpcHMgdW5zYWZlIHRhZ3MgYW5kIGF0dHJpYnV0ZXMgZnJvbSBIVE1MLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gaW5wdXRIdG1sIFRoZSBIVE1MIHRvIHNhbml0aXplLlxuICAgKiBAcGFyYW0gez9mdW5jdGlvbig/c3RyaW5nKTogP3N0cmluZ30gb3B0X25haXZlVXJpUmV3cml0ZXIgQSB0cmFuc2Zvcm0gdG9cbiAgICogICAgIGFwcGx5IHRvIFVSSSBhdHRyaWJ1dGVzLiAgSWYgbm90IGdpdmVuLCBVUkkgYXR0cmlidXRlcyBhcmUgZGVsZXRlZC5cbiAgICogQHBhcmFtIHtmdW5jdGlvbig/c3RyaW5nKTogP3N0cmluZ30gb3B0X25tVG9rZW5Qb2xpY3kgQSB0cmFuc2Zvcm0gdG8gYXBwbHlcbiAgICogICAgIHRvIGF0dHJpYnV0ZXMgY29udGFpbmluZyBIVE1MIG5hbWVzLCBlbGVtZW50IElEcywgYW5kIHNwYWNlLXNlcGFyYXRlZFxuICAgKiAgICAgbGlzdHMgb2YgY2xhc3Nlcy4gIElmIG5vdCBnaXZlbiwgc3VjaCBhdHRyaWJ1dGVzIGFyZSBsZWZ0IHVuY2hhbmdlZC5cbiAgICovXG4gIGZ1bmN0aW9uIHNhbml0aXplKGlucHV0SHRtbCxcbiAgICBvcHRfbmFpdmVVcmlSZXdyaXRlciwgb3B0X25tVG9rZW5Qb2xpY3ksIG9wdF9sb2dnZXIpIHtcbiAgICB2YXIgdGFnUG9saWN5ID0gbWFrZVRhZ1BvbGljeShcbiAgICAgIG9wdF9uYWl2ZVVyaVJld3JpdGVyLCBvcHRfbm1Ub2tlblBvbGljeSwgb3B0X2xvZ2dlcik7XG4gICAgcmV0dXJuIHNhbml0aXplV2l0aFBvbGljeShpbnB1dEh0bWwsIHRhZ1BvbGljeSk7XG4gIH1cblxuICAvLyBFeHBvcnQgYm90aCBxdW90ZWQgYW5kIHVucXVvdGVkIG5hbWVzIGZvciBDbG9zdXJlIGxpbmthZ2UuXG4gIHZhciBodG1sID0ge307XG4gIGh0bWwuZXNjYXBlQXR0cmliID0gaHRtbFsnZXNjYXBlQXR0cmliJ10gPSBlc2NhcGVBdHRyaWI7XG4gIGh0bWwubWFrZUh0bWxTYW5pdGl6ZXIgPSBodG1sWydtYWtlSHRtbFNhbml0aXplciddID0gbWFrZUh0bWxTYW5pdGl6ZXI7XG4gIGh0bWwubWFrZVNheFBhcnNlciA9IGh0bWxbJ21ha2VTYXhQYXJzZXInXSA9IG1ha2VTYXhQYXJzZXI7XG4gIGh0bWwubWFrZVRhZ1BvbGljeSA9IGh0bWxbJ21ha2VUYWdQb2xpY3knXSA9IG1ha2VUYWdQb2xpY3k7XG4gIGh0bWwubm9ybWFsaXplUkNEYXRhID0gaHRtbFsnbm9ybWFsaXplUkNEYXRhJ10gPSBub3JtYWxpemVSQ0RhdGE7XG4gIGh0bWwuc2FuaXRpemUgPSBodG1sWydzYW5pdGl6ZSddID0gc2FuaXRpemU7XG4gIGh0bWwuc2FuaXRpemVBdHRyaWJzID0gaHRtbFsnc2FuaXRpemVBdHRyaWJzJ10gPSBzYW5pdGl6ZUF0dHJpYnM7XG4gIGh0bWwuc2FuaXRpemVXaXRoUG9saWN5ID0gaHRtbFsnc2FuaXRpemVXaXRoUG9saWN5J10gPSBzYW5pdGl6ZVdpdGhQb2xpY3k7XG4gIGh0bWwudW5lc2NhcGVFbnRpdGllcyA9IGh0bWxbJ3VuZXNjYXBlRW50aXRpZXMnXSA9IHVuZXNjYXBlRW50aXRpZXM7XG4gIHJldHVybiBodG1sO1xufSkoaHRtbDQpO1xuXG52YXIgaHRtbF9zYW5pdGl6ZSA9IGh0bWxbJ3Nhbml0aXplJ107XG5cbi8vIExvb3NlbiByZXN0cmljdGlvbnMgb2YgQ2FqYSdzXG4vLyBodG1sLXNhbml0aXplciB0byBhbGxvdyBmb3Igc3R5bGluZ1xuaHRtbDQuQVRUUklCU1snKjo6c3R5bGUnXSA9IDA7XG5odG1sNC5FTEVNRU5UU1snc3R5bGUnXSA9IDA7XG5odG1sNC5BVFRSSUJTWydhOjp0YXJnZXQnXSA9IDA7XG5odG1sNC5FTEVNRU5UU1sndmlkZW8nXSA9IDA7XG5odG1sNC5BVFRSSUJTWyd2aWRlbzo6c3JjJ10gPSAwO1xuaHRtbDQuQVRUUklCU1sndmlkZW86OnBvc3RlciddID0gMDtcbmh0bWw0LkFUVFJJQlNbJ3ZpZGVvOjpjb250cm9scyddID0gMDtcbmh0bWw0LkVMRU1FTlRTWydhdWRpbyddID0gMDtcbmh0bWw0LkFUVFJJQlNbJ2F1ZGlvOjpzcmMnXSA9IDA7XG5odG1sNC5BVFRSSUJTWyd2aWRlbzo6YXV0b3BsYXknXSA9IDA7XG5odG1sNC5BVFRSSUJTWyd2aWRlbzo6Y29udHJvbHMnXSA9IDA7XG5cbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gaHRtbF9zYW5pdGl6ZTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCJhdXRob3JcIjogXCJNYXBib3hcIixcbiAgXCJuYW1lXCI6IFwibWFwYm94LmpzXCIsXG4gIFwiZGVzY3JpcHRpb25cIjogXCJtYXBib3ggamF2YXNjcmlwdCBhcGlcIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMy4xLjFcIixcbiAgXCJob21lcGFnZVwiOiBcImh0dHA6Ly9tYXBib3guY29tL1wiLFxuICBcInJlcG9zaXRvcnlcIjoge1xuICAgIFwidHlwZVwiOiBcImdpdFwiLFxuICAgIFwidXJsXCI6IFwiZ2l0Oi8vZ2l0aHViLmNvbS9tYXBib3gvbWFwYm94LmpzLmdpdFwiXG4gIH0sXG4gIFwibWFpblwiOiBcInNyYy9pbmRleC5qc1wiLFxuICBcImRlcGVuZGVuY2llc1wiOiB7XG4gICAgXCJjb3JzbGl0ZVwiOiBcIjAuMC42XCIsXG4gICAgXCJpc2FycmF5XCI6IFwiMC4wLjFcIixcbiAgICBcImxlYWZsZXRcIjogXCIxLjAuMlwiLFxuICAgIFwibXVzdGFjaGVcIjogXCIyLjIuMVwiLFxuICAgIFwic2FuaXRpemUtY2FqYVwiOiBcIjAuMS40XCJcbiAgfSxcbiAgXCJzY3JpcHRzXCI6IHtcbiAgICBcInRlc3RcIjogXCJlc2xpbnQgLS1uby1lc2xpbnRyYyAtYyAuZXNsaW50cmMgc3JjICYmIHBoYW50b21qcyBub2RlX21vZHVsZXMvbW9jaGEtcGhhbnRvbWpzLWNvcmUvbW9jaGEtcGhhbnRvbWpzLWNvcmUuanMgdGVzdC9pbmRleC5odG1sXCJcbiAgfSxcbiAgXCJsaWNlbnNlXCI6IFwiQlNELTMtQ2xhdXNlXCIsXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcbiAgICBcImJyb3dzZXJpZnlcIjogXCJeMTMuMC4wXCIsXG4gICAgXCJjbGVhbi1jc3NcIjogXCJ+Mi4wLjdcIixcbiAgICBcImN6LWNvbnZlbnRpb25hbC1jaGFuZ2Vsb2dcIjogXCIxLjIuMFwiLFxuICAgIFwiZXNsaW50XCI6IFwiXjAuMjMuMFwiLFxuICAgIFwiZXhwZWN0LmpzXCI6IFwiMC4zLjFcIixcbiAgICBcImhhcHBlblwiOiBcIjAuMS4zXCIsXG4gICAgXCJsZWFmbGV0LWZ1bGxzY3JlZW5cIjogXCIwLjAuNFwiLFxuICAgIFwibGVhZmxldC1oYXNoXCI6IFwiMC4yLjFcIixcbiAgICBcIm1hcmtlZFwiOiBcIn4wLjMuMFwiLFxuICAgIFwibWluaWZ5aWZ5XCI6IFwiXjYuMS4wXCIsXG4gICAgXCJtaW5pbWlzdFwiOiBcIjAuMC41XCIsXG4gICAgXCJtb2NoYVwiOiBcIjIuNC41XCIsXG4gICAgXCJtb2NoYS1waGFudG9tanMtY29yZVwiOiBcIjIuMC4xXCIsXG4gICAgXCJwaGFudG9tanMtcHJlYnVpbHRcIjogXCIyLjEuMTJcIixcbiAgICBcInNpbm9uXCI6IFwiMS4xMC4yXCJcbiAgfSxcbiAgXCJvcHRpb25hbERlcGVuZGVuY2llc1wiOiB7fSxcbiAgXCJlbmdpbmVzXCI6IHtcbiAgICBcIm5vZGVcIjogXCIqXCJcbiAgfSxcbiAgXCJjb25maWdcIjoge1xuICAgIFwiY29tbWl0aXplblwiOiB7XG4gICAgICBcInBhdGhcIjogXCIuL25vZGVfbW9kdWxlcy9jei1jb252ZW50aW9uYWwtY2hhbmdlbG9nXCJcbiAgICB9XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgSFRUUF9VUkw6ICdodHRwOi8vYS50aWxlcy5tYXBib3guY29tL3Y0JyxcclxuICAgIEhUVFBTX1VSTDogJ2h0dHBzOi8vYS50aWxlcy5tYXBib3guY29tL3Y0JyxcclxuICAgIEZPUkNFX0hUVFBTOiBmYWxzZSxcclxuICAgIFJFUVVJUkVfQUNDRVNTX1RPS0VOOiB0cnVlXHJcbn07XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyksXHJcbiAgICBmb3JtYXRfdXJsID0gcmVxdWlyZSgnLi9mb3JtYXRfdXJsJyksXHJcbiAgICByZXF1ZXN0ID0gcmVxdWlyZSgnLi9yZXF1ZXN0JyksXHJcbiAgICBtYXJrZXIgPSByZXF1aXJlKCcuL21hcmtlcicpLFxyXG4gICAgc2ltcGxlc3R5bGUgPSByZXF1aXJlKCcuL3NpbXBsZXN0eWxlJyk7XHJcblxyXG4vLyAjIGZlYXR1cmVMYXllclxyXG4vL1xyXG4vLyBBIGxheWVyIG9mIGZlYXR1cmVzLCBsb2FkZWQgZnJvbSBNYXBib3ggb3IgZWxzZS4gQWRkcyB0aGUgYWJpbGl0eVxyXG4vLyB0byByZXNldCBmZWF0dXJlcywgZmlsdGVyIHRoZW0sIGFuZCBsb2FkIHRoZW0gZnJvbSBhIEdlb0pTT04gVVJMLlxyXG52YXIgRmVhdHVyZUxheWVyID0gTC5GZWF0dXJlR3JvdXAuZXh0ZW5kKHtcclxuICAgIG9wdGlvbnM6IHtcclxuICAgICAgICBmaWx0ZXI6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdHJ1ZTsgfSxcclxuICAgICAgICBzYW5pdGl6ZXI6IHJlcXVpcmUoJ3Nhbml0aXplLWNhamEnKSxcclxuICAgICAgICBzdHlsZTogc2ltcGxlc3R5bGUuc3R5bGUsXHJcbiAgICAgICAgcG9wdXBPcHRpb25zOiB7IGNsb3NlQnV0dG9uOiBmYWxzZSB9XHJcbiAgICB9LFxyXG5cclxuICAgIGluaXRpYWxpemU6IGZ1bmN0aW9uKF8sIG9wdGlvbnMpIHtcclxuICAgICAgICBMLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcblxyXG4gICAgICAgIHRoaXMuX2xheWVycyA9IHt9O1xyXG5cclxuICAgICAgICBpZiAodHlwZW9mIF8gPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIHV0aWwuaWRVcmwoXywgdGhpcyk7XHJcbiAgICAgICAgLy8gamF2YXNjcmlwdCBvYmplY3Qgb2YgVGlsZUpTT04gZGF0YVxyXG4gICAgICAgIH0gZWxzZSBpZiAoXyAmJiB0eXBlb2YgXyA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgdGhpcy5zZXRHZW9KU09OKF8pO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgc2V0R2VvSlNPTjogZnVuY3Rpb24oXykge1xyXG4gICAgICAgIHRoaXMuX2dlb2pzb24gPSBfO1xyXG4gICAgICAgIHRoaXMuY2xlYXJMYXllcnMoKTtcclxuICAgICAgICB0aGlzLl9pbml0aWFsaXplKF8pO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICBnZXRHZW9KU09OOiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fZ2VvanNvbjtcclxuICAgIH0sXHJcblxyXG4gICAgbG9hZFVSTDogZnVuY3Rpb24odXJsKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX3JlcXVlc3QgJiYgJ2Fib3J0JyBpbiB0aGlzLl9yZXF1ZXN0KSB0aGlzLl9yZXF1ZXN0LmFib3J0KCk7XHJcbiAgICAgICAgdGhpcy5fcmVxdWVzdCA9IHJlcXVlc3QodXJsLCBMLmJpbmQoZnVuY3Rpb24oZXJyLCBqc29uKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3JlcXVlc3QgPSBudWxsO1xyXG4gICAgICAgICAgICBpZiAoZXJyICYmIGVyci50eXBlICE9PSAnYWJvcnQnKSB7XHJcbiAgICAgICAgICAgICAgICB1dGlsLmxvZygnY291bGQgbm90IGxvYWQgZmVhdHVyZXMgYXQgJyArIHVybCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywge2Vycm9yOiBlcnJ9KTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChqc29uKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNldEdlb0pTT04oanNvbik7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3JlYWR5Jyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIGxvYWRJRDogZnVuY3Rpb24oaWQpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5sb2FkVVJMKGZvcm1hdF91cmwoJy92NC8nICsgaWQgKyAnL2ZlYXR1cmVzLmpzb24nLCB0aGlzLm9wdGlvbnMuYWNjZXNzVG9rZW4pKTtcclxuICAgIH0sXHJcblxyXG4gICAgc2V0RmlsdGVyOiBmdW5jdGlvbihfKSB7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zLmZpbHRlciA9IF87XHJcbiAgICAgICAgaWYgKHRoaXMuX2dlb2pzb24pIHtcclxuICAgICAgICAgICAgdGhpcy5jbGVhckxheWVycygpO1xyXG4gICAgICAgICAgICB0aGlzLl9pbml0aWFsaXplKHRoaXMuX2dlb2pzb24pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgZ2V0RmlsdGVyOiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmZpbHRlcjtcclxuICAgIH0sXHJcblxyXG4gICAgX2luaXRpYWxpemU6IGZ1bmN0aW9uKGpzb24pIHtcclxuICAgICAgICB2YXIgZmVhdHVyZXMgPSBMLlV0aWwuaXNBcnJheShqc29uKSA/IGpzb24gOiBqc29uLmZlYXR1cmVzLFxyXG4gICAgICAgICAgICBpLCBsZW47XHJcblxyXG4gICAgICAgIGlmIChmZWF0dXJlcykge1xyXG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBsZW4gPSBmZWF0dXJlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgICAgICAgICAgICAgLy8gT25seSBhZGQgdGhpcyBpZiBnZW9tZXRyeSBvciBnZW9tZXRyaWVzIGFyZSBzZXQgYW5kIG5vdCBudWxsXHJcbiAgICAgICAgICAgICAgICBpZiAoZmVhdHVyZXNbaV0uZ2VvbWV0cmllcyB8fCBmZWF0dXJlc1tpXS5nZW9tZXRyeSB8fCBmZWF0dXJlc1tpXS5mZWF0dXJlcykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2luaXRpYWxpemUoZmVhdHVyZXNbaV0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMuZmlsdGVyKGpzb24pKSB7XHJcblxyXG4gICAgICAgICAgICB2YXIgb3B0cyA9IHthY2Nlc3NUb2tlbjogdGhpcy5vcHRpb25zLmFjY2Vzc1Rva2VufSxcclxuICAgICAgICAgICAgICAgIHBvaW50VG9MYXllciA9IHRoaXMub3B0aW9ucy5wb2ludFRvTGF5ZXIgfHwgZnVuY3Rpb24oZmVhdHVyZSwgbGF0bG9uKSB7XHJcbiAgICAgICAgICAgICAgICAgIHJldHVybiBtYXJrZXIuc3R5bGUoZmVhdHVyZSwgbGF0bG9uLCBvcHRzKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBsYXllciA9IEwuR2VvSlNPTi5nZW9tZXRyeVRvTGF5ZXIoanNvbiwge1xyXG4gICAgICAgICAgICAgICAgICAgIHBvaW50VG9MYXllcjogcG9pbnRUb0xheWVyXHJcbiAgICAgICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgICAgIHBvcHVwSHRtbCA9IG1hcmtlci5jcmVhdGVQb3B1cChqc29uLCB0aGlzLm9wdGlvbnMuc2FuaXRpemVyKSxcclxuICAgICAgICAgICAgICAgIHN0eWxlID0gdGhpcy5vcHRpb25zLnN0eWxlLFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdFN0eWxlID0gc3R5bGUgPT09IHNpbXBsZXN0eWxlLnN0eWxlO1xyXG5cclxuICAgICAgICAgICAgaWYgKHN0eWxlICYmICdzZXRTdHlsZScgaW4gbGF5ZXIgJiZcclxuICAgICAgICAgICAgICAgIC8vIGlmIHRoZSBzdHlsZSBtZXRob2QgaXMgdGhlIHNpbXBsZXN0eWxlIGRlZmF1bHQsIHRoZW5cclxuICAgICAgICAgICAgICAgIC8vIG5ldmVyIHN0eWxlIEwuQ2lyY2xlIG9yIEwuQ2lyY2xlTWFya2VyIGJlY2F1c2VcclxuICAgICAgICAgICAgICAgIC8vIHNpbXBsZXN0eWxlIGhhcyBubyBydWxlcyBvdmVyIHRoZW0sIG9ubHkgb3ZlciBnZW9tZXRyeVxyXG4gICAgICAgICAgICAgICAgLy8gcHJpbWl0aXZlcyBkaXJlY3RseSBmcm9tIEdlb0pTT05cclxuICAgICAgICAgICAgICAgICghKGRlZmF1bHRTdHlsZSAmJiAobGF5ZXIgaW5zdGFuY2VvZiBMLkNpcmNsZSB8fFxyXG4gICAgICAgICAgICAgICAgICBsYXllciBpbnN0YW5jZW9mIEwuQ2lyY2xlTWFya2VyKSkpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHN0eWxlID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3R5bGUgPSBzdHlsZShqc29uKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGxheWVyLnNldFN0eWxlKHN0eWxlKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgbGF5ZXIuZmVhdHVyZSA9IGpzb247XHJcblxyXG4gICAgICAgICAgICBpZiAocG9wdXBIdG1sKSB7XHJcbiAgICAgICAgICAgICAgICBsYXllci5iaW5kUG9wdXAocG9wdXBIdG1sLCB0aGlzLm9wdGlvbnMucG9wdXBPcHRpb25zKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5hZGRMYXllcihsYXllcik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59KTtcclxuXHJcbm1vZHVsZS5leHBvcnRzLkZlYXR1cmVMYXllciA9IEZlYXR1cmVMYXllcjtcclxuXHJcbm1vZHVsZS5leHBvcnRzLmZlYXR1cmVMYXllciA9IGZ1bmN0aW9uKF8sIG9wdGlvbnMpIHtcclxuICAgIHJldHVybiBuZXcgRmVhdHVyZUxheWVyKF8sIG9wdGlvbnMpO1xyXG59O1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgRmVlZGJhY2sgPSBMLkNsYXNzLmV4dGVuZCh7XHJcbiAgICBpbmNsdWRlczogTC5NaXhpbi5FdmVudHMsXHJcbiAgICBkYXRhOiB7fSxcclxuICAgIHJlY29yZDogZnVuY3Rpb24oZGF0YSkge1xyXG4gICAgICAgIEwuZXh0ZW5kKHRoaXMuZGF0YSwgZGF0YSk7XHJcbiAgICAgICAgdGhpcy5maXJlKCdjaGFuZ2UnKTtcclxuICAgIH1cclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBGZWVkYmFjaygpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi9jb25maWcnKSxcclxuICAgIHZlcnNpb24gPSByZXF1aXJlKCcuLi9wYWNrYWdlLmpzb24nKS52ZXJzaW9uO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXRoLCBhY2Nlc3NUb2tlbikge1xyXG4gICAgYWNjZXNzVG9rZW4gPSBhY2Nlc3NUb2tlbiB8fCBMLm1hcGJveC5hY2Nlc3NUb2tlbjtcclxuXHJcbiAgICBpZiAoIWFjY2Vzc1Rva2VuICYmIGNvbmZpZy5SRVFVSVJFX0FDQ0VTU19UT0tFTikge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQW4gQVBJIGFjY2VzcyB0b2tlbiBpcyByZXF1aXJlZCB0byB1c2UgTWFwYm94LmpzLiAnICtcclxuICAgICAgICAgICAgJ1NlZSBodHRwczovL3d3dy5tYXBib3guY29tL21hcGJveC5qcy9hcGkvdicgKyB2ZXJzaW9uICsgJy9hcGktYWNjZXNzLXRva2Vucy8nKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgdXJsID0gKGRvY3VtZW50LmxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JyB8fCBjb25maWcuRk9SQ0VfSFRUUFMpID8gY29uZmlnLkhUVFBTX1VSTCA6IGNvbmZpZy5IVFRQX1VSTDtcclxuICAgIHVybCA9IHVybC5yZXBsYWNlKC9cXC92NCQvLCAnJyk7XHJcbiAgICB1cmwgKz0gcGF0aDtcclxuXHJcbiAgICBpZiAoY29uZmlnLlJFUVVJUkVfQUNDRVNTX1RPS0VOKSB7XHJcbiAgICAgICAgaWYgKGFjY2Vzc1Rva2VuWzBdID09PSAncycpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVc2UgYSBwdWJsaWMgYWNjZXNzIHRva2VuIChway4qKSB3aXRoIE1hcGJveC5qcywgbm90IGEgc2VjcmV0IGFjY2VzcyB0b2tlbiAoc2suKikuICcgK1xyXG4gICAgICAgICAgICAgICAgJ1NlZSBodHRwczovL3d3dy5tYXBib3guY29tL21hcGJveC5qcy9hcGkvdicgKyB2ZXJzaW9uICsgJy9hcGktYWNjZXNzLXRva2Vucy8nKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHVybCArPSB1cmwuaW5kZXhPZignPycpICE9PSAtMSA/ICcmYWNjZXNzX3Rva2VuPScgOiAnP2FjY2Vzc190b2tlbj0nO1xyXG4gICAgICAgIHVybCArPSBhY2Nlc3NUb2tlbjtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdXJsO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMudGlsZUpTT04gPSBmdW5jdGlvbih1cmxPck1hcElELCBhY2Nlc3NUb2tlbikge1xyXG5cclxuICAgIGlmICh1cmxPck1hcElELmluZGV4T2YoJ21hcGJveDovL3N0eWxlcycpID09PSAwKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTdHlsZXMgY3JlYXRlZCB3aXRoIE1hcGJveCBTdHVkaW8gbmVlZCB0byBiZSB1c2VkIHdpdGggJyArXHJcbiAgICAgICAgICAgICdMLm1hcGJveC5zdHlsZUxheWVyLCBub3QgTC5tYXBib3gudGlsZUxheWVyJyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHVybE9yTWFwSUQuaW5kZXhPZignLycpICE9PSAtMSlcclxuICAgICAgICByZXR1cm4gdXJsT3JNYXBJRDtcclxuXHJcbiAgICB2YXIgdXJsID0gbW9kdWxlLmV4cG9ydHMoJy92NC8nICsgdXJsT3JNYXBJRCArICcuanNvbicsIGFjY2Vzc1Rva2VuKTtcclxuXHJcbiAgICAvLyBUaWxlSlNPTiByZXF1ZXN0cyBuZWVkIGEgc2VjdXJlIGZsYWcgYXBwZW5kZWQgdG8gdGhlaXIgVVJMcyBzb1xyXG4gICAgLy8gdGhhdCB0aGUgc2VydmVyIGtub3dzIHRvIHNlbmQgU1NMLWlmaWVkIHJlc291cmNlIHJlZmVyZW5jZXMuXHJcbiAgICBpZiAodXJsLmluZGV4T2YoJ2h0dHBzJykgPT09IDApXHJcbiAgICAgICAgdXJsICs9ICcmc2VjdXJlJztcclxuXHJcbiAgICByZXR1cm4gdXJsO1xyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzLnN0eWxlID0gZnVuY3Rpb24oc3R5bGVVUkwsIGFjY2Vzc1Rva2VuKSB7XHJcbiAgICBpZiAoc3R5bGVVUkwuaW5kZXhPZignbWFwYm94Oi8vc3R5bGVzLycpID09PSAtMSkgdGhyb3cgbmV3IEVycm9yKCdJbmNvcnJlY3RseSBmb3JtYXR0ZWQgTWFwYm94IHN0eWxlIGF0ICcgKyBzdHlsZVVSTCk7XHJcblxyXG4gICAgdmFyIG93bmVySURTdHlsZSA9IHN0eWxlVVJMLnNwbGl0KCdtYXBib3g6Ly9zdHlsZXMvJylbMV07XHJcbiAgICB2YXIgdXJsID0gbW9kdWxlLmV4cG9ydHMoJy9zdHlsZXMvdjEvJyArIG93bmVySURTdHlsZSwgYWNjZXNzVG9rZW4pXHJcbiAgICAgICAgLnJlcGxhY2UoJ2h0dHA6Ly8nLCAnaHR0cHM6Ly8nKTtcclxuXHJcbiAgICByZXR1cm4gdXJsO1xyXG59O1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzYXJyYXknKSxcclxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcclxuICAgIGZvcm1hdF91cmwgPSByZXF1aXJlKCcuL2Zvcm1hdF91cmwnKSxcclxuICAgIGZlZWRiYWNrID0gcmVxdWlyZSgnLi9mZWVkYmFjaycpLFxyXG4gICAgcmVxdWVzdCA9IHJlcXVpcmUoJy4vcmVxdWVzdCcpO1xyXG5cclxuLy8gTG93LWxldmVsIGdlb2NvZGluZyBpbnRlcmZhY2UgLSB3cmFwcyBzcGVjaWZpYyBBUEkgY2FsbHMgYW5kIHRoZWlyXHJcbi8vIHJldHVybiB2YWx1ZXMuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odXJsLCBvcHRpb25zKSB7XHJcbiAgICBpZiAoIW9wdGlvbnMpIG9wdGlvbnMgPSB7fTtcclxuICAgIHZhciBnZW9jb2RlciA9IHt9O1xyXG5cclxuICAgIHV0aWwuc3RyaWN0KHVybCwgJ3N0cmluZycpO1xyXG5cclxuICAgIGlmICh1cmwuaW5kZXhPZignLycpID09PSAtMSkge1xyXG4gICAgICAgIHVybCA9IGZvcm1hdF91cmwoJy9nZW9jb2RpbmcvdjUvJyArIHVybCArICcve3F1ZXJ5fS5qc29uJywgb3B0aW9ucy5hY2Nlc3NUb2tlbiwgNSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcm91bmRUbyhsYXRMbmcsIHByZWNpc2lvbikge1xyXG4gICAgICAgIHZhciBtdWx0ID0gTWF0aC5wb3coMTAsIHByZWNpc2lvbik7XHJcbiAgICAgICAgbGF0TG5nLmxhdCA9IE1hdGgucm91bmQobGF0TG5nLmxhdCAqIG11bHQpIC8gbXVsdDtcclxuICAgICAgICBsYXRMbmcubG5nID0gTWF0aC5yb3VuZChsYXRMbmcubG5nICogbXVsdCkgLyBtdWx0O1xyXG4gICAgICAgIHJldHVybiBsYXRMbmc7XHJcbiAgICB9XHJcblxyXG4gICAgZ2VvY29kZXIuZ2V0VVJMID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHVybDtcclxuICAgIH07XHJcblxyXG4gICAgZ2VvY29kZXIucXVlcnlVUkwgPSBmdW5jdGlvbihfKSB7XHJcbiAgICAgICAgdmFyIGlzT2JqZWN0ID0gIShpc0FycmF5KF8pIHx8IHR5cGVvZiBfID09PSAnc3RyaW5nJyksXHJcbiAgICAgICAgICAgIHF1ZXJ5ID0gaXNPYmplY3QgPyBfLnF1ZXJ5IDogXztcclxuXHJcbiAgICAgICAgaWYgKGlzQXJyYXkocXVlcnkpKSB7XHJcbiAgICAgICAgICAgIHZhciBwYXJ0cyA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHF1ZXJ5Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBwYXJ0c1tpXSA9IGVuY29kZVVSSUNvbXBvbmVudChxdWVyeVtpXSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcXVlcnkgPSBwYXJ0cy5qb2luKCc7Jyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcXVlcnkgPSBlbmNvZGVVUklDb21wb25lbnQocXVlcnkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZmVlZGJhY2sucmVjb3JkKHsgZ2VvY29kaW5nOiBxdWVyeSB9KTtcclxuXHJcbiAgICAgICAgdmFyIHVybCA9IEwuVXRpbC50ZW1wbGF0ZShnZW9jb2Rlci5nZXRVUkwoKSwge3F1ZXJ5OiBxdWVyeX0pO1xyXG5cclxuICAgICAgICBpZiAoaXNPYmplY3QpIHtcclxuICAgICAgICAgICAgaWYgKF8udHlwZXMpIHtcclxuICAgICAgICAgICAgICAgIGlmIChpc0FycmF5KF8udHlwZXMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdXJsICs9ICcmdHlwZXM9JyArIF8udHlwZXMuam9pbigpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB1cmwgKz0gJyZ0eXBlcz0nICsgXy50eXBlcztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKF8uY291bnRyeSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGlzQXJyYXkoXy5jb3VudHJ5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHVybCArPSAnJmNvdW50cnk9JyArIF8uY291bnRyeS5qb2luKCk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHVybCArPSAnJmNvdW50cnk9JyArIF8uY291bnRyeTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKF8uYmJveCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGlzQXJyYXkoXy5iYm94KSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHVybCArPSAnJmJib3g9JyArIF8uYmJveC5qb2luKCk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHVybCArPSAnJmJib3g9JyArIF8uYmJveDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKF8ucHJveGltaXR5KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcHJveGltaXR5ID0gcm91bmRUbyhMLmxhdExuZyhfLnByb3hpbWl0eSksIDMpO1xyXG4gICAgICAgICAgICAgICAgdXJsICs9ICcmcHJveGltaXR5PScgKyBwcm94aW1pdHkubG5nICsgJywnICsgcHJveGltaXR5LmxhdDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBfLmF1dG9jb21wbGV0ZSA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICAgICAgICAgICB1cmwgKz0gJyZhdXRvY29tcGxldGU9JyArIF8uYXV0b2NvbXBsZXRlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gdXJsO1xyXG4gICAgfTtcclxuXHJcbiAgICBnZW9jb2Rlci5xdWVyeSA9IGZ1bmN0aW9uKF8sIGNhbGxiYWNrKSB7XHJcbiAgICAgICAgdXRpbC5zdHJpY3QoY2FsbGJhY2ssICdmdW5jdGlvbicpO1xyXG5cclxuICAgICAgICByZXF1ZXN0KGdlb2NvZGVyLnF1ZXJ5VVJMKF8pLCBmdW5jdGlvbihlcnIsIGpzb24pIHtcclxuICAgICAgICAgICAgaWYgKGpzb24gJiYgKGpzb24ubGVuZ3RoIHx8IGpzb24uZmVhdHVyZXMpKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcmVzID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHM6IGpzb25cclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICBpZiAoanNvbi5mZWF0dXJlcyAmJiBqc29uLmZlYXR1cmVzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcy5sYXRsbmcgPSBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGpzb24uZmVhdHVyZXNbMF0uY2VudGVyWzFdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBqc29uLmZlYXR1cmVzWzBdLmNlbnRlclswXV07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChqc29uLmZlYXR1cmVzWzBdLmJib3gpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzLmJvdW5kcyA9IGpzb24uZmVhdHVyZXNbMF0uYmJveDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzLmxib3VuZHMgPSB1dGlsLmxib3VuZHMocmVzLmJvdW5kcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzKTtcclxuICAgICAgICAgICAgfSBlbHNlIGNhbGxiYWNrKGVyciB8fCB0cnVlKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGdlb2NvZGVyO1xyXG4gICAgfTtcclxuXHJcbiAgICAvLyBhIHJldmVyc2UgZ2VvY29kZTpcclxuICAgIC8vXHJcbiAgICAvLyAgZ2VvY29kZXIucmV2ZXJzZVF1ZXJ5KFs4MCwgMjBdKVxyXG4gICAgZ2VvY29kZXIucmV2ZXJzZVF1ZXJ5ID0gZnVuY3Rpb24oXywgY2FsbGJhY2spIHtcclxuICAgICAgICB2YXIgcSA9ICcnO1xyXG5cclxuICAgICAgICAvLyBzb3J0IHRocm91Z2ggZGlmZmVyZW50IHdheXMgcGVvcGxlIHJlcHJlc2VudCBsYXQgYW5kIGxvbiBwYWlyc1xyXG4gICAgICAgIGZ1bmN0aW9uIG5vcm1hbGl6ZSh4KSB7XHJcbiAgICAgICAgICAgIHZhciBsYXRMbmc7XHJcbiAgICAgICAgICAgIGlmICh4LmxhdCAhPT0gdW5kZWZpbmVkICYmIHgubG5nICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIGxhdExuZyA9IEwubGF0TG5nKHgubGF0LCB4LmxuZyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoeC5sYXQgIT09IHVuZGVmaW5lZCAmJiB4LmxvbiAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBsYXRMbmcgPSBMLmxhdExuZyh4LmxhdCwgeC5sb24pO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgbGF0TG5nID0gTC5sYXRMbmcoeFsxXSwgeFswXSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbGF0TG5nID0gcm91bmRUbyhsYXRMbmcsIDUpO1xyXG4gICAgICAgICAgICByZXR1cm4gbGF0TG5nLmxuZyArICcsJyArIGxhdExuZy5sYXQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoXy5sZW5ndGggJiYgX1swXS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIHB0cyA9IFtdOyBpIDwgXy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgcHRzLnB1c2gobm9ybWFsaXplKF9baV0pKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBxID0gcHRzLmpvaW4oJzsnKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBxID0gbm9ybWFsaXplKF8pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVxdWVzdChnZW9jb2Rlci5xdWVyeVVSTChxKSwgZnVuY3Rpb24oZXJyLCBqc29uKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwganNvbik7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBnZW9jb2RlcjtcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIGdlb2NvZGVyO1xyXG59O1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgZ2VvY29kZXIgPSByZXF1aXJlKCcuL2dlb2NvZGVyJyksXHJcbiAgICB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XHJcblxyXG52YXIgR2VvY29kZXJDb250cm9sID0gTC5Db250cm9sLmV4dGVuZCh7XHJcbiAgICBpbmNsdWRlczogTC5NaXhpbi5FdmVudHMsXHJcblxyXG4gICAgb3B0aW9uczoge1xyXG4gICAgICAgIHByb3hpbWl0eTogdHJ1ZSxcclxuICAgICAgICBwb3NpdGlvbjogJ3RvcGxlZnQnLFxyXG4gICAgICAgIHBvaW50Wm9vbTogMTYsXHJcbiAgICAgICAga2VlcE9wZW46IGZhbHNlLFxyXG4gICAgICAgIGF1dG9jb21wbGV0ZTogZmFsc2UsXHJcbiAgICAgICAgcXVlcnlPcHRpb25zOiB7fVxyXG4gICAgfSxcclxuXHJcbiAgICBpbml0aWFsaXplOiBmdW5jdGlvbihfLCBvcHRpb25zKSB7XHJcbiAgICAgICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcbiAgICAgICAgdGhpcy5zZXRVUkwoXyk7XHJcbiAgICAgICAgdGhpcy5fdXBkYXRlU3VibWl0ID0gTC5iaW5kKHRoaXMuX3VwZGF0ZVN1Ym1pdCwgdGhpcyk7XHJcbiAgICAgICAgdGhpcy5fdXBkYXRlQXV0b2NvbXBsZXRlID0gTC5iaW5kKHRoaXMuX3VwZGF0ZUF1dG9jb21wbGV0ZSwgdGhpcyk7XHJcbiAgICAgICAgdGhpcy5fY2hvb3NlUmVzdWx0ID0gTC5iaW5kKHRoaXMuX2Nob29zZVJlc3VsdCwgdGhpcyk7XHJcbiAgICB9LFxyXG5cclxuICAgIHNldFVSTDogZnVuY3Rpb24oXykge1xyXG4gICAgICAgIHRoaXMuZ2VvY29kZXIgPSBnZW9jb2RlcihfLCB7XHJcbiAgICAgICAgICAgIGFjY2Vzc1Rva2VuOiB0aGlzLm9wdGlvbnMuYWNjZXNzVG9rZW5cclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgZ2V0VVJMOiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5nZW9jb2Rlci5nZXRVUkwoKTtcclxuICAgIH0sXHJcblxyXG4gICAgc2V0SUQ6IGZ1bmN0aW9uKF8pIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZXRVUkwoXyk7XHJcbiAgICB9LFxyXG5cclxuICAgIHNldFRpbGVKU09OOiBmdW5jdGlvbihfKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0VVJMKF8uZ2VvY29kZXIpO1xyXG4gICAgfSxcclxuXHJcbiAgICBfdG9nZ2xlOiBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKGUpIEwuRG9tRXZlbnQuc3RvcChlKTtcclxuICAgICAgICBpZiAoTC5Eb21VdGlsLmhhc0NsYXNzKHRoaXMuX2NvbnRhaW5lciwgJ2FjdGl2ZScpKSB7XHJcbiAgICAgICAgICAgIEwuRG9tVXRpbC5yZW1vdmVDbGFzcyh0aGlzLl9jb250YWluZXIsICdhY3RpdmUnKTtcclxuICAgICAgICAgICAgdGhpcy5fcmVzdWx0cy5pbm5lckhUTUwgPSAnJztcclxuICAgICAgICAgICAgdGhpcy5faW5wdXQuYmx1cigpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9jb250YWluZXIsICdhY3RpdmUnKTtcclxuICAgICAgICAgICAgdGhpcy5faW5wdXQuZm9jdXMoKTtcclxuICAgICAgICAgICAgdGhpcy5faW5wdXQuc2VsZWN0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBfY2xvc2VJZk9wZW46IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGlmIChMLkRvbVV0aWwuaGFzQ2xhc3ModGhpcy5fY29udGFpbmVyLCAnYWN0aXZlJykgJiZcclxuICAgICAgICAgICAgIXRoaXMub3B0aW9ucy5rZWVwT3Blbikge1xyXG4gICAgICAgICAgICBMLkRvbVV0aWwucmVtb3ZlQ2xhc3ModGhpcy5fY29udGFpbmVyLCAnYWN0aXZlJyk7XHJcbiAgICAgICAgICAgIHRoaXMuX3Jlc3VsdHMuaW5uZXJIVE1MID0gJyc7XHJcbiAgICAgICAgICAgIHRoaXMuX2lucHV0LmJsdXIoKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIG9uQWRkOiBmdW5jdGlvbihtYXApIHtcclxuXHJcbiAgICAgICAgdmFyIGNvbnRhaW5lciA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsICdsZWFmbGV0LWNvbnRyb2wtbWFwYm94LWdlb2NvZGVyIGxlYWZsZXQtYmFyIGxlYWZsZXQtY29udHJvbCcpLFxyXG4gICAgICAgICAgICBsaW5rID0gTC5Eb21VdGlsLmNyZWF0ZSgnYScsICdsZWFmbGV0LWNvbnRyb2wtbWFwYm94LWdlb2NvZGVyLXRvZ2dsZSBtYXBib3gtaWNvbiBtYXBib3gtaWNvbi1nZW9jb2RlcicsIGNvbnRhaW5lciksXHJcbiAgICAgICAgICAgIHJlc3VsdHMgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCAnbGVhZmxldC1jb250cm9sLW1hcGJveC1nZW9jb2Rlci1yZXN1bHRzJywgY29udGFpbmVyKSxcclxuICAgICAgICAgICAgd3JhcCA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsICdsZWFmbGV0LWNvbnRyb2wtbWFwYm94LWdlb2NvZGVyLXdyYXAnLCBjb250YWluZXIpLFxyXG4gICAgICAgICAgICBmb3JtID0gTC5Eb21VdGlsLmNyZWF0ZSgnZm9ybScsICdsZWFmbGV0LWNvbnRyb2wtbWFwYm94LWdlb2NvZGVyLWZvcm0nLCB3cmFwKSxcclxuICAgICAgICAgICAgaW5wdXQgPSBMLkRvbVV0aWwuY3JlYXRlKCdpbnB1dCcsICcnLCBmb3JtKTtcclxuXHJcbiAgICAgICAgbGluay5ocmVmID0gJyMnO1xyXG4gICAgICAgIGxpbmsuaW5uZXJIVE1MID0gJyZuYnNwOyc7XHJcblxyXG4gICAgICAgIGlucHV0LnR5cGUgPSAndGV4dCc7XHJcbiAgICAgICAgaW5wdXQuc2V0QXR0cmlidXRlKCdwbGFjZWhvbGRlcicsICdTZWFyY2gnKTtcclxuXHJcbiAgICAgICAgTC5Eb21FdmVudC5hZGRMaXN0ZW5lcihmb3JtLCAnc3VibWl0JywgdGhpcy5fZ2VvY29kZSwgdGhpcyk7XHJcbiAgICAgICAgTC5Eb21FdmVudC5hZGRMaXN0ZW5lcihpbnB1dCwgJ2tleXVwJywgdGhpcy5fYXV0b2NvbXBsZXRlLCB0aGlzKTtcclxuICAgICAgICBMLkRvbUV2ZW50LmRpc2FibGVDbGlja1Byb3BhZ2F0aW9uKGNvbnRhaW5lcik7XHJcblxyXG4gICAgICAgIHRoaXMuX21hcCA9IG1hcDtcclxuICAgICAgICB0aGlzLl9yZXN1bHRzID0gcmVzdWx0cztcclxuICAgICAgICB0aGlzLl9pbnB1dCA9IGlucHV0O1xyXG4gICAgICAgIHRoaXMuX2Zvcm0gPSBmb3JtO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmtlZXBPcGVuKSB7XHJcbiAgICAgICAgICAgIEwuRG9tVXRpbC5hZGRDbGFzcyhjb250YWluZXIsICdhY3RpdmUnKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLl9tYXAub24oJ2NsaWNrJywgdGhpcy5fY2xvc2VJZk9wZW4sIHRoaXMpO1xyXG4gICAgICAgICAgICBMLkRvbUV2ZW50LmFkZExpc3RlbmVyKGxpbmssICdjbGljaycsIHRoaXMuX3RvZ2dsZSwgdGhpcyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gY29udGFpbmVyO1xyXG4gICAgfSxcclxuXHJcbiAgICBfdXBkYXRlU3VibWl0OiBmdW5jdGlvbihlcnIsIHJlc3ApIHtcclxuICAgICAgICBMLkRvbVV0aWwucmVtb3ZlQ2xhc3ModGhpcy5fY29udGFpbmVyLCAnc2VhcmNoaW5nJyk7XHJcbiAgICAgICAgdGhpcy5fcmVzdWx0cy5pbm5lckhUTUwgPSAnJztcclxuICAgICAgICBpZiAoZXJyIHx8ICFyZXNwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCB7ZXJyb3I6IGVycn0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHZhciBmZWF0dXJlcyA9IFtdO1xyXG4gICAgICAgICAgICBpZiAocmVzcC5yZXN1bHRzICYmIHJlc3AucmVzdWx0cy5mZWF0dXJlcykge1xyXG4gICAgICAgICAgICAgICAgZmVhdHVyZXMgPSByZXNwLnJlc3VsdHMuZmVhdHVyZXM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGZlYXR1cmVzLmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdhdXRvc2VsZWN0JywgeyBmZWF0dXJlOiBmZWF0dXJlc1swXSB9KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnZm91bmQnLCB7cmVzdWx0czogcmVzcC5yZXN1bHRzfSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9jaG9vc2VSZXN1bHQoZmVhdHVyZXNbMF0pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fY2xvc2VJZk9wZW4oKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChmZWF0dXJlcy5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2ZvdW5kJywge3Jlc3VsdHM6IHJlc3AucmVzdWx0c30pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZGlzcGxheVJlc3VsdHMoZmVhdHVyZXMpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdub3Rmb3VuZCcpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fZGlzcGxheVJlc3VsdHMoZmVhdHVyZXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBfdXBkYXRlQXV0b2NvbXBsZXRlOiBmdW5jdGlvbihlcnIsIHJlc3ApIHtcclxuICAgICAgICB0aGlzLl9yZXN1bHRzLmlubmVySFRNTCA9ICcnO1xyXG4gICAgICAgIGlmIChlcnIgfHwgIXJlc3ApIHtcclxuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIHtlcnJvcjogZXJyfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGZlYXR1cmVzID0gW107XHJcbiAgICAgICAgICAgIGlmIChyZXNwLnJlc3VsdHMgJiYgcmVzcC5yZXN1bHRzLmZlYXR1cmVzKSB7XHJcbiAgICAgICAgICAgICAgICBmZWF0dXJlcyA9IHJlc3AucmVzdWx0cy5mZWF0dXJlcztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoZmVhdHVyZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2ZvdW5kJywge3Jlc3VsdHM6IHJlc3AucmVzdWx0c30pO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdub3Rmb3VuZCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuX2Rpc3BsYXlSZXN1bHRzKGZlYXR1cmVzKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIF9kaXNwbGF5UmVzdWx0czogZnVuY3Rpb24oZmVhdHVyZXMpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IE1hdGgubWluKGZlYXR1cmVzLmxlbmd0aCwgNSk7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgdmFyIGZlYXR1cmUgPSBmZWF0dXJlc1tpXTtcclxuICAgICAgICAgICAgdmFyIG5hbWUgPSBmZWF0dXJlLnBsYWNlX25hbWU7XHJcbiAgICAgICAgICAgIGlmICghbmFtZS5sZW5ndGgpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgdmFyIHIgPSBMLkRvbVV0aWwuY3JlYXRlKCdhJywgJycsIHRoaXMuX3Jlc3VsdHMpO1xyXG4gICAgICAgICAgICB2YXIgdGV4dCA9ICgnaW5uZXJUZXh0JyBpbiByKSA/ICdpbm5lclRleHQnIDogJ3RleHRDb250ZW50JztcclxuICAgICAgICAgICAgclt0ZXh0XSA9IG5hbWU7XHJcbiAgICAgICAgICAgIHIuc2V0QXR0cmlidXRlKCd0aXRsZScsIG5hbWUpO1xyXG4gICAgICAgICAgICByLmhyZWYgPSAnIyc7XHJcblxyXG4gICAgICAgICAgICAoTC5iaW5kKGZ1bmN0aW9uKGZlYXR1cmUpIHtcclxuICAgICAgICAgICAgICAgIEwuRG9tRXZlbnQuYWRkTGlzdGVuZXIociwgJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2Nob29zZVJlc3VsdChmZWF0dXJlKTtcclxuICAgICAgICAgICAgICAgICAgICBMLkRvbUV2ZW50LnN0b3AoZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdzZWxlY3QnLCB7IGZlYXR1cmU6IGZlYXR1cmUgfSk7XHJcbiAgICAgICAgICAgICAgICB9LCB0aGlzKTtcclxuICAgICAgICAgICAgfSwgdGhpcykpKGZlYXR1cmUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZmVhdHVyZXMubGVuZ3RoID4gNSkge1xyXG4gICAgICAgICAgICB2YXIgb3V0b2YgPSBMLkRvbVV0aWwuY3JlYXRlKCdzcGFuJywgJycsIHRoaXMuX3Jlc3VsdHMpO1xyXG4gICAgICAgICAgICBvdXRvZi5pbm5lckhUTUwgPSAnVG9wIDUgb2YgJyArIGZlYXR1cmVzLmxlbmd0aCArICcgIHJlc3VsdHMnO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgX2Nob29zZVJlc3VsdDogZnVuY3Rpb24ocmVzdWx0KSB7XHJcbiAgICAgICAgaWYgKHJlc3VsdC5iYm94KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX21hcC5maXRCb3VuZHModXRpbC5sYm91bmRzKHJlc3VsdC5iYm94KSk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChyZXN1bHQuY2VudGVyKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX21hcC5zZXRWaWV3KFtyZXN1bHQuY2VudGVyWzFdLCByZXN1bHQuY2VudGVyWzBdXSwgKHRoaXMuX21hcC5nZXRab29tKCkgPT09IHVuZGVmaW5lZCkgP1xyXG4gICAgICAgICAgICAgICAgdGhpcy5vcHRpb25zLnBvaW50Wm9vbSA6XHJcbiAgICAgICAgICAgICAgICBNYXRoLm1heCh0aGlzLl9tYXAuZ2V0Wm9vbSgpLCB0aGlzLm9wdGlvbnMucG9pbnRab29tKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBfZ2VvY29kZTogZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIEwuRG9tRXZlbnQucHJldmVudERlZmF1bHQoZSk7XHJcbiAgICAgICAgaWYgKHRoaXMuX2lucHV0LnZhbHVlID09PSAnJykgcmV0dXJuIHRoaXMuX3VwZGF0ZVN1Ym1pdCgpO1xyXG4gICAgICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9jb250YWluZXIsICdzZWFyY2hpbmcnKTtcclxuICAgICAgICB0aGlzLmdlb2NvZGVyLnF1ZXJ5KEwuVXRpbC5leHRlbmQoe1xyXG4gICAgICAgICAgICBxdWVyeTogdGhpcy5faW5wdXQudmFsdWUsXHJcbiAgICAgICAgICAgIHByb3hpbWl0eTogdGhpcy5vcHRpb25zLnByb3hpbWl0eSA/IHRoaXMuX21hcC5nZXRDZW50ZXIoKSA6IGZhbHNlXHJcbiAgICAgICAgfSwgdGhpcy5vcHRpb25zLnF1ZXJ5T3B0aW9ucyksIHRoaXMuX3VwZGF0ZVN1Ym1pdCk7XHJcbiAgICB9LFxyXG5cclxuICAgIF9hdXRvY29tcGxldGU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5vcHRpb25zLmF1dG9jb21wbGV0ZSkgcmV0dXJuO1xyXG4gICAgICAgIGlmICh0aGlzLl9pbnB1dC52YWx1ZSA9PT0gJycpIHJldHVybiB0aGlzLl91cGRhdGVBdXRvY29tcGxldGUoKTtcclxuICAgICAgICB0aGlzLmdlb2NvZGVyLnF1ZXJ5KEwuVXRpbC5leHRlbmQoe1xyXG4gICAgICAgICAgICBxdWVyeTogdGhpcy5faW5wdXQudmFsdWUsXHJcbiAgICAgICAgICAgIHByb3hpbWl0eTogdGhpcy5vcHRpb25zLnByb3hpbWl0eSA/IHRoaXMuX21hcC5nZXRDZW50ZXIoKSA6IGZhbHNlXHJcbiAgICAgICAgfSwgdGhpcy5vcHRpb25zLnF1ZXJ5T3B0aW9ucyksIHRoaXMuX3VwZGF0ZUF1dG9jb21wbGV0ZSk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMuR2VvY29kZXJDb250cm9sID0gR2VvY29kZXJDb250cm9sO1xyXG5cclxubW9kdWxlLmV4cG9ydHMuZ2VvY29kZXJDb250cm9sID0gZnVuY3Rpb24oXywgb3B0aW9ucykge1xyXG4gICAgcmV0dXJuIG5ldyBHZW9jb2RlckNvbnRyb2woXywgb3B0aW9ucyk7XHJcbn07XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbmZ1bmN0aW9uIHV0ZkRlY29kZShjKSB7XHJcbiAgICBpZiAoYyA+PSA5MykgYy0tO1xyXG4gICAgaWYgKGMgPj0gMzUpIGMtLTtcclxuICAgIHJldHVybiBjIC0gMzI7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZGF0YSkge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uKHgsIHkpIHtcclxuICAgICAgICBpZiAoIWRhdGEpIHJldHVybjtcclxuICAgICAgICB2YXIgaWR4ID0gdXRmRGVjb2RlKGRhdGEuZ3JpZFt5XS5jaGFyQ29kZUF0KHgpKSxcclxuICAgICAgICAgICAga2V5ID0gZGF0YS5rZXlzW2lkeF07XHJcbiAgICAgICAgcmV0dXJuIGRhdGEuZGF0YVtrZXldO1xyXG4gICAgfTtcclxufTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKSxcclxuICAgIE11c3RhY2hlID0gcmVxdWlyZSgnbXVzdGFjaGUnKTtcclxuXHJcbnZhciBHcmlkQ29udHJvbCA9IEwuQ29udHJvbC5leHRlbmQoe1xyXG5cclxuICAgIG9wdGlvbnM6IHtcclxuICAgICAgICBwaW5uYWJsZTogdHJ1ZSxcclxuICAgICAgICBmb2xsb3c6IGZhbHNlLFxyXG4gICAgICAgIHNhbml0aXplcjogcmVxdWlyZSgnc2FuaXRpemUtY2FqYScpLFxyXG4gICAgICAgIHRvdWNoVGVhc2VyOiB0cnVlLFxyXG4gICAgICAgIGxvY2F0aW9uOiB0cnVlXHJcbiAgICB9LFxyXG5cclxuICAgIF9jdXJyZW50Q29udGVudDogJycsXHJcblxyXG4gICAgLy8gcGlubmVkIG1lYW5zIHRoYXQgdGhpcyBjb250cm9sIGlzIG9uIGEgZmVhdHVyZSBhbmQgdGhlIHVzZXIgaGFzIGxpa2VseVxyXG4gICAgLy8gY2xpY2tlZC4gcGlubmVkIHdpbGwgbm90IGJlY29tZSBmYWxzZSB1bmxlc3MgdGhlIHVzZXIgY2xpY2tzIG9mZlxyXG4gICAgLy8gb2YgdGhlIGZlYXR1cmUgb250byBhbm90aGVyIG9yIGNsaWNrcyB4XHJcbiAgICBfcGlubmVkOiBmYWxzZSxcclxuXHJcbiAgICBpbml0aWFsaXplOiBmdW5jdGlvbihfLCBvcHRpb25zKSB7XHJcbiAgICAgICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XHJcbiAgICAgICAgdXRpbC5zdHJpY3RfaW5zdGFuY2UoXywgTC5DbGFzcywgJ0wubWFwYm94LmdyaWRMYXllcicpO1xyXG4gICAgICAgIHRoaXMuX2xheWVyID0gXztcclxuICAgIH0sXHJcblxyXG4gICAgc2V0VGVtcGxhdGU6IGZ1bmN0aW9uKHRlbXBsYXRlKSB7XHJcbiAgICAgICAgdXRpbC5zdHJpY3QodGVtcGxhdGUsICdzdHJpbmcnKTtcclxuICAgICAgICB0aGlzLm9wdGlvbnMudGVtcGxhdGUgPSB0ZW1wbGF0ZTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgX3RlbXBsYXRlOiBmdW5jdGlvbihmb3JtYXQsIGRhdGEpIHtcclxuICAgICAgICBpZiAoIWRhdGEpIHJldHVybjtcclxuICAgICAgICB2YXIgdGVtcGxhdGUgPSB0aGlzLm9wdGlvbnMudGVtcGxhdGUgfHwgdGhpcy5fbGF5ZXIuZ2V0VGlsZUpTT04oKS50ZW1wbGF0ZTtcclxuICAgICAgICBpZiAodGVtcGxhdGUpIHtcclxuICAgICAgICAgICAgdmFyIGQgPSB7fTtcclxuICAgICAgICAgICAgZFsnX18nICsgZm9ybWF0ICsgJ19fJ10gPSB0cnVlO1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLnNhbml0aXplcihcclxuICAgICAgICAgICAgICAgIE11c3RhY2hlLnRvX2h0bWwodGVtcGxhdGUsIEwuZXh0ZW5kKGQsIGRhdGEpKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICAvLyBjaGFuZ2UgdGhlIGNvbnRlbnQgb2YgdGhlIHRvb2x0aXAgSFRNTCBpZiBpdCBoYXMgY2hhbmdlZCwgb3RoZXJ3aXNlXHJcbiAgICAvLyBub29wXHJcbiAgICBfc2hvdzogZnVuY3Rpb24oY29udGVudCwgbykge1xyXG4gICAgICAgIGlmIChjb250ZW50ID09PSB0aGlzLl9jdXJyZW50Q29udGVudCkgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLl9jdXJyZW50Q29udGVudCA9IGNvbnRlbnQ7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZm9sbG93KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3BvcHVwLnNldENvbnRlbnQoY29udGVudClcclxuICAgICAgICAgICAgICAgIC5zZXRMYXRMbmcoby5sYXRMbmcpO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5fbWFwLl9wb3B1cCAhPT0gdGhpcy5fcG9wdXApIHRoaXMuX3BvcHVwLm9wZW5Pbih0aGlzLl9tYXApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcclxuICAgICAgICAgICAgdGhpcy5fY29udGVudFdyYXBwZXIuaW5uZXJIVE1MID0gY29udGVudDtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIGhpZGU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuX3Bpbm5lZCA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMuX2N1cnJlbnRDb250ZW50ID0gJyc7XHJcblxyXG4gICAgICAgIHRoaXMuX21hcC5jbG9zZVBvcHVwKCk7XHJcbiAgICAgICAgdGhpcy5fY29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgICAgICAgdGhpcy5fY29udGVudFdyYXBwZXIuaW5uZXJIVE1MID0gJyc7XHJcblxyXG4gICAgICAgIEwuRG9tVXRpbC5yZW1vdmVDbGFzcyh0aGlzLl9jb250YWluZXIsICdjbG9zYWJsZScpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgX21vdXNlb3ZlcjogZnVuY3Rpb24obykge1xyXG4gICAgICAgIGlmIChvLmRhdGEpIHtcclxuICAgICAgICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX21hcC5fY29udGFpbmVyLCAnbWFwLWNsaWNrYWJsZScpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIEwuRG9tVXRpbC5yZW1vdmVDbGFzcyh0aGlzLl9tYXAuX2NvbnRhaW5lciwgJ21hcC1jbGlja2FibGUnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9waW5uZWQpIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIGNvbnRlbnQgPSB0aGlzLl90ZW1wbGF0ZSgndGVhc2VyJywgby5kYXRhKTtcclxuICAgICAgICBpZiAoY29udGVudCkge1xyXG4gICAgICAgICAgICB0aGlzLl9zaG93KGNvbnRlbnQsIG8pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuaGlkZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgX21vdXNlbW92ZTogZnVuY3Rpb24obykge1xyXG4gICAgICAgIGlmICh0aGlzLl9waW5uZWQpIHJldHVybjtcclxuICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5mb2xsb3cpIHJldHVybjtcclxuXHJcbiAgICAgICAgdGhpcy5fcG9wdXAuc2V0TGF0TG5nKG8ubGF0TG5nKTtcclxuICAgIH0sXHJcblxyXG4gICAgX25hdmlnYXRlVG86IGZ1bmN0aW9uKHVybCkge1xyXG4gICAgICAgIHdpbmRvdy50b3AubG9jYXRpb24uaHJlZiA9IHVybDtcclxuICAgIH0sXHJcblxyXG4gICAgX2NsaWNrOiBmdW5jdGlvbihvKSB7XHJcblxyXG4gICAgICAgIHZhciBsb2NhdGlvbl9mb3JtYXR0ZWQgPSB0aGlzLl90ZW1wbGF0ZSgnbG9jYXRpb24nLCBvLmRhdGEpO1xyXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMubG9jYXRpb24gJiYgbG9jYXRpb25fZm9ybWF0dGVkICYmXHJcbiAgICAgICAgICAgIGxvY2F0aW9uX2Zvcm1hdHRlZC5zZWFyY2goL15odHRwcz86LykgPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX25hdmlnYXRlVG8odGhpcy5fdGVtcGxhdGUoJ2xvY2F0aW9uJywgby5kYXRhKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5waW5uYWJsZSkgcmV0dXJuO1xyXG5cclxuICAgICAgICB2YXIgY29udGVudCA9IHRoaXMuX3RlbXBsYXRlKCdmdWxsJywgby5kYXRhKTtcclxuXHJcbiAgICAgICAgaWYgKCFjb250ZW50ICYmIHRoaXMub3B0aW9ucy50b3VjaFRlYXNlciAmJiBMLkJyb3dzZXIudG91Y2gpIHtcclxuICAgICAgICAgICAgY29udGVudCA9IHRoaXMuX3RlbXBsYXRlKCd0ZWFzZXInLCBvLmRhdGEpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGNvbnRlbnQpIHtcclxuICAgICAgICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX2NvbnRhaW5lciwgJ2Nsb3NhYmxlJyk7XHJcbiAgICAgICAgICAgIHRoaXMuX3Bpbm5lZCA9IHRydWU7XHJcbiAgICAgICAgICAgIHRoaXMuX3Nob3coY29udGVudCwgbyk7XHJcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9waW5uZWQpIHtcclxuICAgICAgICAgICAgTC5Eb21VdGlsLnJlbW92ZUNsYXNzKHRoaXMuX2NvbnRhaW5lciwgJ2Nsb3NhYmxlJyk7XHJcbiAgICAgICAgICAgIHRoaXMuX3Bpbm5lZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICB0aGlzLmhpZGUoKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIF9vblBvcHVwQ2xvc2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuX2N1cnJlbnRDb250ZW50ID0gbnVsbDtcclxuICAgICAgICB0aGlzLl9waW5uZWQgPSBmYWxzZTtcclxuICAgIH0sXHJcblxyXG4gICAgX2NyZWF0ZUNsb3NlYnV0dG9uOiBmdW5jdGlvbihjb250YWluZXIsIGZuKSB7XHJcbiAgICAgICAgdmFyIGxpbmsgPSBMLkRvbVV0aWwuY3JlYXRlKCdhJywgJ2Nsb3NlJywgY29udGFpbmVyKTtcclxuXHJcbiAgICAgICAgbGluay5pbm5lckhUTUwgPSAnY2xvc2UnO1xyXG4gICAgICAgIGxpbmsuaHJlZiA9ICcjJztcclxuICAgICAgICBsaW5rLnRpdGxlID0gJ2Nsb3NlJztcclxuXHJcbiAgICAgICAgTC5Eb21FdmVudFxyXG4gICAgICAgICAgICAub24obGluaywgJ2NsaWNrJywgTC5Eb21FdmVudC5zdG9wUHJvcGFnYXRpb24pXHJcbiAgICAgICAgICAgIC5vbihsaW5rLCAnbW91c2Vkb3duJywgTC5Eb21FdmVudC5zdG9wUHJvcGFnYXRpb24pXHJcbiAgICAgICAgICAgIC5vbihsaW5rLCAnZGJsY2xpY2snLCBMLkRvbUV2ZW50LnN0b3BQcm9wYWdhdGlvbilcclxuICAgICAgICAgICAgLm9uKGxpbmssICdjbGljaycsIEwuRG9tRXZlbnQucHJldmVudERlZmF1bHQpXHJcbiAgICAgICAgICAgIC5vbihsaW5rLCAnY2xpY2snLCBmbiwgdGhpcyk7XHJcblxyXG4gICAgICAgIHJldHVybiBsaW5rO1xyXG4gICAgfSxcclxuXHJcbiAgICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XHJcbiAgICAgICAgdGhpcy5fbWFwID0gbWFwO1xyXG5cclxuICAgICAgICB2YXIgY2xhc3NOYW1lID0gJ2xlYWZsZXQtY29udHJvbC1ncmlkIG1hcC10b29sdGlwJyxcclxuICAgICAgICAgICAgY29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgY2xhc3NOYW1lKSxcclxuICAgICAgICAgICAgY29udGVudFdyYXBwZXIgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCAnbWFwLXRvb2x0aXAtY29udGVudCcpO1xyXG5cclxuICAgICAgICAvLyBoaWRlIHRoZSBjb250YWluZXIgZWxlbWVudCBpbml0aWFsbHlcclxuICAgICAgICBjb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICAgICAgICB0aGlzLl9jcmVhdGVDbG9zZWJ1dHRvbihjb250YWluZXIsIHRoaXMuaGlkZSk7XHJcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGNvbnRlbnRXcmFwcGVyKTtcclxuXHJcbiAgICAgICAgdGhpcy5fY29udGVudFdyYXBwZXIgPSBjb250ZW50V3JhcHBlcjtcclxuICAgICAgICB0aGlzLl9wb3B1cCA9IG5ldyBMLlBvcHVwKHsgYXV0b1BhbjogZmFsc2UsIGNsb3NlT25DbGljazogZmFsc2UgfSk7XHJcblxyXG4gICAgICAgIG1hcC5vbigncG9wdXBjbG9zZScsIHRoaXMuX29uUG9wdXBDbG9zZSwgdGhpcyk7XHJcblxyXG4gICAgICAgIEwuRG9tRXZlbnRcclxuICAgICAgICAgICAgLmRpc2FibGVDbGlja1Byb3BhZ2F0aW9uKGNvbnRhaW5lcilcclxuICAgICAgICAgICAgLy8gYWxsb3cgcGVvcGxlIHRvIHNjcm9sbCB0b29sdGlwcyB3aXRoIG1vdXNld2hlZWxcclxuICAgICAgICAgICAgLmFkZExpc3RlbmVyKGNvbnRhaW5lciwgJ21vdXNld2hlZWwnLCBMLkRvbUV2ZW50LnN0b3BQcm9wYWdhdGlvbik7XHJcblxyXG4gICAgICAgIHRoaXMuX2xheWVyXHJcbiAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgdGhpcy5fbW91c2VvdmVyLCB0aGlzKVxyXG4gICAgICAgICAgICAub24oJ21vdXNlbW92ZScsIHRoaXMuX21vdXNlbW92ZSwgdGhpcylcclxuICAgICAgICAgICAgLm9uKCdjbGljaycsIHRoaXMuX2NsaWNrLCB0aGlzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGNvbnRhaW5lcjtcclxuICAgIH0sXHJcblxyXG4gICAgb25SZW1vdmU6IGZ1bmN0aW9uIChtYXApIHtcclxuXHJcbiAgICAgICAgbWFwLm9mZigncG9wdXBjbG9zZScsIHRoaXMuX29uUG9wdXBDbG9zZSwgdGhpcyk7XHJcblxyXG4gICAgICAgIHRoaXMuX2xheWVyXHJcbiAgICAgICAgICAgIC5vZmYoJ21vdXNlb3ZlcicsIHRoaXMuX21vdXNlb3ZlciwgdGhpcylcclxuICAgICAgICAgICAgLm9mZignbW91c2Vtb3ZlJywgdGhpcy5fbW91c2Vtb3ZlLCB0aGlzKVxyXG4gICAgICAgICAgICAub2ZmKCdjbGljaycsIHRoaXMuX2NsaWNrLCB0aGlzKTtcclxuICAgIH1cclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5HcmlkQ29udHJvbCA9IEdyaWRDb250cm9sO1xyXG5cclxubW9kdWxlLmV4cG9ydHMuZ3JpZENvbnRyb2wgPSBmdW5jdGlvbihfLCBvcHRpb25zKSB7XHJcbiAgICByZXR1cm4gbmV3IEdyaWRDb250cm9sKF8sIG9wdGlvbnMpO1xyXG59O1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxyXG4gICAgcmVxdWVzdCA9IHJlcXVpcmUoJy4vcmVxdWVzdCcpLFxyXG4gICAgZ3JpZCA9IHJlcXVpcmUoJy4vZ3JpZCcpO1xyXG5cclxuLy8gZm9ya2VkIGZyb20gZGFuemVsL0wuVVRGR3JpZFxyXG52YXIgR3JpZExheWVyID0gTC5MYXllci5leHRlbmQoe1xyXG4gICAgaW5jbHVkZXM6IFtyZXF1aXJlKCcuL2xvYWRfdGlsZWpzb24nKV0sXHJcblxyXG4gICAgb3B0aW9uczoge1xyXG4gICAgICAgIHRlbXBsYXRlOiBmdW5jdGlvbigpIHsgcmV0dXJuICcnOyB9XHJcbiAgICB9LFxyXG5cclxuICAgIF9tb3VzZU9uOiBudWxsLFxyXG4gICAgX3RpbGVqc29uOiB7fSxcclxuICAgIF9jYWNoZToge30sXHJcblxyXG4gICAgaW5pdGlhbGl6ZTogZnVuY3Rpb24oXywgb3B0aW9ucykge1xyXG4gICAgICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG4gICAgICAgIHRoaXMuX2xvYWRUaWxlSlNPTihfKTtcclxuICAgIH0sXHJcblxyXG4gICAgX3NldFRpbGVKU09OOiBmdW5jdGlvbihqc29uKSB7XHJcbiAgICAgICAgdXRpbC5zdHJpY3QoanNvbiwgJ29iamVjdCcpO1xyXG5cclxuICAgICAgICBMLmV4dGVuZCh0aGlzLm9wdGlvbnMsIHtcclxuICAgICAgICAgICAgZ3JpZHM6IGpzb24uZ3JpZHMsXHJcbiAgICAgICAgICAgIG1pblpvb206IGpzb24ubWluem9vbSxcclxuICAgICAgICAgICAgbWF4Wm9vbToganNvbi5tYXh6b29tLFxyXG4gICAgICAgICAgICBib3VuZHM6IGpzb24uYm91bmRzICYmIHV0aWwubGJvdW5kcyhqc29uLmJvdW5kcylcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5fdGlsZWpzb24gPSBqc29uO1xyXG4gICAgICAgIHRoaXMuX2NhY2hlID0ge307XHJcbiAgICAgICAgdGhpcy5fdXBkYXRlKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICBnZXRUaWxlSlNPTjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RpbGVqc29uO1xyXG4gICAgfSxcclxuXHJcbiAgICBhY3RpdmU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiAhISh0aGlzLl9tYXAgJiYgdGhpcy5vcHRpb25zLmdyaWRzICYmIHRoaXMub3B0aW9ucy5ncmlkcy5sZW5ndGgpO1xyXG4gICAgfSxcclxuXHJcbiAgICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XHJcbiAgICAgICAgdGhpcy5fbWFwID0gbWFwO1xyXG4gICAgICAgIHRoaXMuX3VwZGF0ZSgpO1xyXG5cclxuICAgICAgICB0aGlzLl9tYXBcclxuICAgICAgICAgICAgLm9uKCdjbGljaycsIHRoaXMuX2NsaWNrLCB0aGlzKVxyXG4gICAgICAgICAgICAub24oJ21vdXNlbW92ZScsIHRoaXMuX21vdmUsIHRoaXMpXHJcbiAgICAgICAgICAgIC5vbignbW92ZWVuZCcsIHRoaXMuX3VwZGF0ZSwgdGhpcyk7XHJcbiAgICB9LFxyXG5cclxuICAgIG9uUmVtb3ZlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGlzLl9tYXBcclxuICAgICAgICAgICAgLm9mZignY2xpY2snLCB0aGlzLl9jbGljaywgdGhpcylcclxuICAgICAgICAgICAgLm9mZignbW91c2Vtb3ZlJywgdGhpcy5fbW92ZSwgdGhpcylcclxuICAgICAgICAgICAgLm9mZignbW92ZWVuZCcsIHRoaXMuX3VwZGF0ZSwgdGhpcyk7XHJcbiAgICB9LFxyXG5cclxuICAgIGdldERhdGE6IGZ1bmN0aW9uKGxhdGxuZywgY2FsbGJhY2spIHtcclxuICAgICAgICBpZiAoIXRoaXMuYWN0aXZlKCkpIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIG1hcCA9IHRoaXMuX21hcCxcclxuICAgICAgICAgICAgcG9pbnQgPSBtYXAucHJvamVjdChsYXRsbmcud3JhcCgpKSxcclxuICAgICAgICAgICAgdGlsZVNpemUgPSAyNTYsXHJcbiAgICAgICAgICAgIHJlc29sdXRpb24gPSA0LFxyXG4gICAgICAgICAgICB4ID0gTWF0aC5mbG9vcihwb2ludC54IC8gdGlsZVNpemUpLFxyXG4gICAgICAgICAgICB5ID0gTWF0aC5mbG9vcihwb2ludC55IC8gdGlsZVNpemUpLFxyXG4gICAgICAgICAgICBtYXggPSBtYXAub3B0aW9ucy5jcnMuc2NhbGUobWFwLmdldFpvb20oKSkgLyB0aWxlU2l6ZTtcclxuXHJcbiAgICAgICAgeCA9ICh4ICsgbWF4KSAlIG1heDtcclxuICAgICAgICB5ID0gKHkgKyBtYXgpICUgbWF4O1xyXG5cclxuICAgICAgICB0aGlzLl9nZXRUaWxlKG1hcC5nZXRab29tKCksIHgsIHksIGZ1bmN0aW9uKGdyaWQpIHtcclxuICAgICAgICAgICAgdmFyIGdyaWRYID0gTWF0aC5mbG9vcigocG9pbnQueCAtICh4ICogdGlsZVNpemUpKSAvIHJlc29sdXRpb24pLFxyXG4gICAgICAgICAgICAgICAgZ3JpZFkgPSBNYXRoLmZsb29yKChwb2ludC55IC0gKHkgKiB0aWxlU2l6ZSkpIC8gcmVzb2x1dGlvbik7XHJcblxyXG4gICAgICAgICAgICBjYWxsYmFjayhncmlkKGdyaWRYLCBncmlkWSkpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgX2NsaWNrOiBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgdGhpcy5nZXREYXRhKGUubGF0bG5nLCBMLmJpbmQoZnVuY3Rpb24oZGF0YSkge1xyXG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2NsaWNrJywge1xyXG4gICAgICAgICAgICAgICAgbGF0TG5nOiBlLmxhdGxuZyxcclxuICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgfSxcclxuXHJcbiAgICBfbW92ZTogZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIHRoaXMuZ2V0RGF0YShlLmxhdGxuZywgTC5iaW5kKGZ1bmN0aW9uKGRhdGEpIHtcclxuICAgICAgICAgICAgaWYgKGRhdGEgIT09IHRoaXMuX21vdXNlT24pIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9tb3VzZU9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdtb3VzZW91dCcsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGF0TG5nOiBlLmxhdGxuZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogdGhpcy5fbW91c2VPblxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnbW91c2VvdmVyJywge1xyXG4gICAgICAgICAgICAgICAgICAgIGxhdExuZzogZS5sYXRsbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogZGF0YVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5fbW91c2VPbiA9IGRhdGE7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ21vdXNlbW92ZScsIHtcclxuICAgICAgICAgICAgICAgICAgICBsYXRMbmc6IGUubGF0bG5nLFxyXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgfSxcclxuXHJcbiAgICBfZ2V0VGlsZVVSTDogZnVuY3Rpb24odGlsZVBvaW50KSB7XHJcbiAgICAgICAgdmFyIHVybHMgPSB0aGlzLm9wdGlvbnMuZ3JpZHMsXHJcbiAgICAgICAgICAgIGluZGV4ID0gKHRpbGVQb2ludC54ICsgdGlsZVBvaW50LnkpICUgdXJscy5sZW5ndGgsXHJcbiAgICAgICAgICAgIHVybCA9IHVybHNbaW5kZXhdO1xyXG5cclxuICAgICAgICByZXR1cm4gTC5VdGlsLnRlbXBsYXRlKHVybCwgdGlsZVBvaW50KTtcclxuICAgIH0sXHJcblxyXG4gICAgLy8gTG9hZCB1cCBhbGwgcmVxdWlyZWQganNvbiBncmlkIGZpbGVzXHJcbiAgICBfdXBkYXRlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICBpZiAoIXRoaXMuYWN0aXZlKCkpIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIGJvdW5kcyA9IHRoaXMuX21hcC5nZXRQaXhlbEJvdW5kcygpLFxyXG4gICAgICAgICAgICB6ID0gdGhpcy5fbWFwLmdldFpvb20oKSxcclxuICAgICAgICAgICAgdGlsZVNpemUgPSAyNTY7XHJcblxyXG4gICAgICAgIGlmICh6ID4gdGhpcy5vcHRpb25zLm1heFpvb20gfHwgeiA8IHRoaXMub3B0aW9ucy5taW5ab29tKSByZXR1cm47XHJcblxyXG4gICAgICAgIHZhciB0aWxlQm91bmRzID0gTC5ib3VuZHMoXHJcbiAgICAgICAgICAgICAgICBib3VuZHMubWluLmRpdmlkZUJ5KHRpbGVTaXplKS5fZmxvb3IoKSxcclxuICAgICAgICAgICAgICAgIGJvdW5kcy5tYXguZGl2aWRlQnkodGlsZVNpemUpLl9mbG9vcigpKSxcclxuICAgICAgICAgICAgbWF4ID0gdGhpcy5fbWFwLm9wdGlvbnMuY3JzLnNjYWxlKHopIC8gdGlsZVNpemU7XHJcblxyXG4gICAgICAgIGZvciAodmFyIHggPSB0aWxlQm91bmRzLm1pbi54OyB4IDw9IHRpbGVCb3VuZHMubWF4Lng7IHgrKykge1xyXG4gICAgICAgICAgICBmb3IgKHZhciB5ID0gdGlsZUJvdW5kcy5taW4ueTsgeSA8PSB0aWxlQm91bmRzLm1heC55OyB5KyspIHtcclxuICAgICAgICAgICAgICAgIC8vIHggd3JhcHBlZFxyXG4gICAgICAgICAgICAgICAgdGhpcy5fZ2V0VGlsZSh6LCAoKHggJSBtYXgpICsgbWF4KSAlIG1heCwgKCh5ICUgbWF4KSArIG1heCkgJSBtYXgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBfZ2V0VGlsZTogZnVuY3Rpb24oeiwgeCwgeSwgY2FsbGJhY2spIHtcclxuICAgICAgICB2YXIga2V5ID0geiArICdfJyArIHggKyAnXycgKyB5LFxyXG4gICAgICAgICAgICB0aWxlUG9pbnQgPSBMLnBvaW50KHgsIHkpO1xyXG5cclxuICAgICAgICB0aWxlUG9pbnQueiA9IHo7XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5fdGlsZVNob3VsZEJlTG9hZGVkKHRpbGVQb2ludCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGtleSBpbiB0aGlzLl9jYWNoZSkge1xyXG4gICAgICAgICAgICBpZiAoIWNhbGxiYWNrKSByZXR1cm47XHJcblxyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuX2NhY2hlW2tleV0gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKHRoaXMuX2NhY2hlW2tleV0pOyAvLyBBbHJlYWR5IGxvYWRlZFxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fY2FjaGVba2V5XS5wdXNoKGNhbGxiYWNrKTsgLy8gUGVuZGluZ1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9jYWNoZVtrZXldID0gW107XHJcblxyXG4gICAgICAgIGlmIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICB0aGlzLl9jYWNoZVtrZXldLnB1c2goY2FsbGJhY2spO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVxdWVzdCh0aGlzLl9nZXRUaWxlVVJMKHRpbGVQb2ludCksIEwuYmluZChmdW5jdGlvbihlcnIsIGpzb24pIHtcclxuICAgICAgICAgICAgdmFyIGNhbGxiYWNrcyA9IHRoaXMuX2NhY2hlW2tleV07XHJcbiAgICAgICAgICAgIHRoaXMuX2NhY2hlW2tleV0gPSBncmlkKGpzb24pO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzW2ldKHRoaXMuX2NhY2hlW2tleV0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgfSxcclxuXHJcbiAgICBfdGlsZVNob3VsZEJlTG9hZGVkOiBmdW5jdGlvbih0aWxlUG9pbnQpIHtcclxuICAgICAgICBpZiAodGlsZVBvaW50LnogPiB0aGlzLm9wdGlvbnMubWF4Wm9vbSB8fCB0aWxlUG9pbnQueiA8IHRoaXMub3B0aW9ucy5taW5ab29tKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuYm91bmRzKSB7XHJcbiAgICAgICAgICAgIHZhciB0aWxlU2l6ZSA9IDI1NixcclxuICAgICAgICAgICAgICAgIG53UG9pbnQgPSB0aWxlUG9pbnQubXVsdGlwbHlCeSh0aWxlU2l6ZSksXHJcbiAgICAgICAgICAgICAgICBzZVBvaW50ID0gbndQb2ludC5hZGQobmV3IEwuUG9pbnQodGlsZVNpemUsIHRpbGVTaXplKSksXHJcbiAgICAgICAgICAgICAgICBudyA9IHRoaXMuX21hcC51bnByb2plY3QobndQb2ludCksXHJcbiAgICAgICAgICAgICAgICBzZSA9IHRoaXMuX21hcC51bnByb2plY3Qoc2VQb2ludCksXHJcbiAgICAgICAgICAgICAgICBib3VuZHMgPSBuZXcgTC5MYXRMbmdCb3VuZHMoW253LCBzZV0pO1xyXG5cclxuICAgICAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuYm91bmRzLmludGVyc2VjdHMoYm91bmRzKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5HcmlkTGF5ZXIgPSBHcmlkTGF5ZXI7XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5ncmlkTGF5ZXIgPSBmdW5jdGlvbihfLCBvcHRpb25zKSB7XHJcbiAgICByZXR1cm4gbmV3IEdyaWRMYXllcihfLCBvcHRpb25zKTtcclxufTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIExlZ2VuZENvbnRyb2wgPSBMLkNvbnRyb2wuZXh0ZW5kKHtcclxuXHJcbiAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgcG9zaXRpb246ICdib3R0b21yaWdodCcsXHJcbiAgICAgICAgc2FuaXRpemVyOiByZXF1aXJlKCdzYW5pdGl6ZS1jYWphJylcclxuICAgIH0sXHJcblxyXG4gICAgaW5pdGlhbGl6ZTogZnVuY3Rpb24ob3B0aW9ucykge1xyXG4gICAgICAgIEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcclxuICAgICAgICB0aGlzLl9sZWdlbmRzID0ge307XHJcbiAgICB9LFxyXG5cclxuICAgIG9uQWRkOiBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGlzLl9jb250YWluZXIgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCAnbWFwLWxlZ2VuZHMgd2F4LWxlZ2VuZHMnKTtcclxuICAgICAgICBMLkRvbUV2ZW50LmRpc2FibGVDbGlja1Byb3BhZ2F0aW9uKHRoaXMuX2NvbnRhaW5lcik7XHJcblxyXG4gICAgICAgIHRoaXMuX3VwZGF0ZSgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy5fY29udGFpbmVyO1xyXG4gICAgfSxcclxuXHJcbiAgICBhZGRMZWdlbmQ6IGZ1bmN0aW9uKHRleHQpIHtcclxuICAgICAgICBpZiAoIXRleHQpIHsgcmV0dXJuIHRoaXM7IH1cclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLl9sZWdlbmRzW3RleHRdKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2xlZ2VuZHNbdGV4dF0gPSAwO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fbGVnZW5kc1t0ZXh0XSsrO1xyXG4gICAgICAgIHJldHVybiB0aGlzLl91cGRhdGUoKTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVtb3ZlTGVnZW5kOiBmdW5jdGlvbih0ZXh0KSB7XHJcbiAgICAgICAgaWYgKCF0ZXh0KSB7IHJldHVybiB0aGlzOyB9XHJcbiAgICAgICAgaWYgKHRoaXMuX2xlZ2VuZHNbdGV4dF0pIHRoaXMuX2xlZ2VuZHNbdGV4dF0tLTtcclxuICAgICAgICByZXR1cm4gdGhpcy5fdXBkYXRlKCk7XHJcbiAgICB9LFxyXG5cclxuICAgIF91cGRhdGU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5fbWFwKSB7IHJldHVybiB0aGlzOyB9XHJcblxyXG4gICAgICAgIHRoaXMuX2NvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcclxuICAgICAgICB2YXIgaGlkZSA9ICdub25lJztcclxuXHJcbiAgICAgICAgZm9yICh2YXIgaSBpbiB0aGlzLl9sZWdlbmRzKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9sZWdlbmRzLmhhc093blByb3BlcnR5KGkpICYmIHRoaXMuX2xlZ2VuZHNbaV0pIHtcclxuICAgICAgICAgICAgICAgIHZhciBkaXYgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCAnbWFwLWxlZ2VuZCB3YXgtbGVnZW5kJywgdGhpcy5fY29udGFpbmVyKTtcclxuICAgICAgICAgICAgICAgIGRpdi5pbm5lckhUTUwgPSB0aGlzLm9wdGlvbnMuc2FuaXRpemVyKGkpO1xyXG4gICAgICAgICAgICAgICAgaGlkZSA9ICdibG9jayc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGhpZGUgdGhlIGNvbnRyb2wgZW50aXJlbHkgdW5sZXNzIHRoZXJlIGlzIGF0IGxlYXN0IG9uZSBsZWdlbmQ7XHJcbiAgICAgICAgLy8gb3RoZXJ3aXNlIHRoZXJlIHdpbGwgYmUgYSBzbWFsbCBncmV5IGJsZW1pc2ggb24gdGhlIG1hcC5cclxuICAgICAgICB0aGlzLl9jb250YWluZXIuc3R5bGUuZGlzcGxheSA9IGhpZGU7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbm1vZHVsZS5leHBvcnRzLkxlZ2VuZENvbnRyb2wgPSBMZWdlbmRDb250cm9sO1xyXG5cclxubW9kdWxlLmV4cG9ydHMubGVnZW5kQ29udHJvbCA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcclxuICAgIHJldHVybiBuZXcgTGVnZW5kQ29udHJvbChvcHRpb25zKTtcclxufTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIHJlcXVlc3QgPSByZXF1aXJlKCcuL3JlcXVlc3QnKSxcclxuICAgIGZvcm1hdF91cmwgPSByZXF1aXJlKCcuL2Zvcm1hdF91cmwnKSxcclxuICAgIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgX2xvYWRUaWxlSlNPTjogZnVuY3Rpb24oXykge1xyXG4gICAgICAgIGlmICh0eXBlb2YgXyA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgXyA9IGZvcm1hdF91cmwudGlsZUpTT04oXywgdGhpcy5vcHRpb25zICYmIHRoaXMub3B0aW9ucy5hY2Nlc3NUb2tlbik7XHJcbiAgICAgICAgICAgIHJlcXVlc3QoXywgTC5iaW5kKGZ1bmN0aW9uKGVyciwganNvbikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIHV0aWwubG9nKCdjb3VsZCBub3QgbG9hZCBUaWxlSlNPTiBhdCAnICsgXyk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIHtlcnJvcjogZXJyfSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGpzb24pIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRUaWxlSlNPTihqc29uKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3JlYWR5Jyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sIHRoaXMpKTtcclxuICAgICAgICB9IGVsc2UgaWYgKF8gJiYgdHlwZW9mIF8gPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3NldFRpbGVKU09OKF8pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIHRpbGVMYXllciA9IHJlcXVpcmUoJy4vdGlsZV9sYXllcicpLnRpbGVMYXllcixcclxuICAgIGZlYXR1cmVMYXllciA9IHJlcXVpcmUoJy4vZmVhdHVyZV9sYXllcicpLmZlYXR1cmVMYXllcixcclxuICAgIGdyaWRMYXllciA9IHJlcXVpcmUoJy4vZ3JpZF9sYXllcicpLmdyaWRMYXllcixcclxuICAgIGdyaWRDb250cm9sID0gcmVxdWlyZSgnLi9ncmlkX2NvbnRyb2wnKS5ncmlkQ29udHJvbCxcclxuICAgIHNoYXJlQ29udHJvbCA9IHJlcXVpcmUoJy4vc2hhcmVfY29udHJvbCcpLnNoYXJlQ29udHJvbCxcclxuICAgIGxlZ2VuZENvbnRyb2wgPSByZXF1aXJlKCcuL2xlZ2VuZF9jb250cm9sJykubGVnZW5kQ29udHJvbCxcclxuICAgIG1hcGJveExvZ29Db250cm9sID0gcmVxdWlyZSgnLi9tYXBib3hfbG9nbycpLm1hcGJveExvZ29Db250cm9sLFxyXG4gICAgZmVlZGJhY2sgPSByZXF1aXJlKCcuL2ZlZWRiYWNrJyk7XHJcblxyXG5mdW5jdGlvbiB3aXRoQWNjZXNzVG9rZW4ob3B0aW9ucywgYWNjZXNzVG9rZW4pIHtcclxuICAgIGlmICghYWNjZXNzVG9rZW4gfHwgb3B0aW9ucy5hY2Nlc3NUb2tlbilcclxuICAgICAgICByZXR1cm4gb3B0aW9ucztcclxuICAgIHJldHVybiBMLmV4dGVuZCh7YWNjZXNzVG9rZW46IGFjY2Vzc1Rva2VufSwgb3B0aW9ucyk7XHJcbn1cclxuXHJcbnZhciBMTWFwID0gTC5NYXAuZXh0ZW5kKHtcclxuICAgIGluY2x1ZGVzOiBbcmVxdWlyZSgnLi9sb2FkX3RpbGVqc29uJyldLFxyXG5cclxuICAgIG9wdGlvbnM6IHtcclxuICAgICAgICB0aWxlTGF5ZXI6IHt9LFxyXG4gICAgICAgIGZlYXR1cmVMYXllcjoge30sXHJcbiAgICAgICAgZ3JpZExheWVyOiB7fSxcclxuICAgICAgICBsZWdlbmRDb250cm9sOiB7fSxcclxuICAgICAgICBncmlkQ29udHJvbDoge30sXHJcbiAgICAgICAgc2hhcmVDb250cm9sOiBmYWxzZSxcclxuICAgICAgICBzYW5pdGl6ZXI6IHJlcXVpcmUoJ3Nhbml0aXplLWNhamEnKVxyXG4gICAgfSxcclxuXHJcbiAgICBfdGlsZWpzb246IHt9LFxyXG5cclxuICAgIGluaXRpYWxpemU6IGZ1bmN0aW9uKGVsZW1lbnQsIF8sIG9wdGlvbnMpIHtcclxuXHJcbiAgICAgICAgTC5NYXAucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBlbGVtZW50LFxyXG4gICAgICAgICAgICBMLmV4dGVuZCh7fSwgTC5NYXAucHJvdG90eXBlLm9wdGlvbnMsIG9wdGlvbnMpKTtcclxuXHJcbiAgICAgICAgLy8gRGlzYWJsZSB0aGUgZGVmYXVsdCAnTGVhZmxldCcgdGV4dFxyXG4gICAgICAgIGlmICh0aGlzLmF0dHJpYnV0aW9uQ29udHJvbCkge1xyXG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0aW9uQ29udHJvbC5zZXRQcmVmaXgoJycpO1xyXG5cclxuICAgICAgICAgICAgdmFyIGNvbXBhY3QgPSB0aGlzLm9wdGlvbnMuYXR0cmlidXRpb25Db250cm9sLmNvbXBhY3Q7XHJcbiAgICAgICAgICAgIC8vIFNldCBhIGNvbXBhY3QgZGlzcGxheSBpZiBtYXAgY29udGFpbmVyIHdpZHRoIGlzIDwgNjQwIG9yXHJcbiAgICAgICAgICAgIC8vIGNvbXBhY3QgaXMgc2V0IHRvIGB0cnVlYCBpbiBhdHRyaWJ1dGlvbkNvbnRyb2wgb3B0aW9ucy5cclxuICAgICAgICAgICAgaWYgKGNvbXBhY3QgfHwgKGNvbXBhY3QgIT09IGZhbHNlICYmIHRoaXMuX2NvbnRhaW5lci5vZmZzZXRXaWR0aCA8PSA2NDApKSB7XHJcbiAgICAgICAgICAgICAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5hdHRyaWJ1dGlvbkNvbnRyb2wuX2NvbnRhaW5lciwgJ2xlYWZsZXQtY29tcGFjdC1hdHRyaWJ1dGlvbicpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoY29tcGFjdCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm9uKCdyZXNpemUnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fY29udGFpbmVyLm9mZnNldFdpZHRoID4gNjQwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIEwuRG9tVXRpbC5yZW1vdmVDbGFzcyh0aGlzLmF0dHJpYnV0aW9uQ29udHJvbC5fY29udGFpbmVyLCAnbGVhZmxldC1jb21wYWN0LWF0dHJpYnV0aW9uJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuYXR0cmlidXRpb25Db250cm9sLl9jb250YWluZXIsICdsZWFmbGV0LWNvbXBhY3QtYXR0cmlidXRpb24nKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy50aWxlTGF5ZXIpIHtcclxuICAgICAgICAgICAgdGhpcy50aWxlTGF5ZXIgPSB0aWxlTGF5ZXIodW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAgICAgd2l0aEFjY2Vzc1Rva2VuKHRoaXMub3B0aW9ucy50aWxlTGF5ZXIsIHRoaXMub3B0aW9ucy5hY2Nlc3NUb2tlbikpO1xyXG4gICAgICAgICAgICB0aGlzLmFkZExheWVyKHRoaXMudGlsZUxheWVyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZmVhdHVyZUxheWVyKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZmVhdHVyZUxheWVyID0gZmVhdHVyZUxheWVyKHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICAgIHdpdGhBY2Nlc3NUb2tlbih0aGlzLm9wdGlvbnMuZmVhdHVyZUxheWVyLCB0aGlzLm9wdGlvbnMuYWNjZXNzVG9rZW4pKTtcclxuICAgICAgICAgICAgdGhpcy5hZGRMYXllcih0aGlzLmZlYXR1cmVMYXllcik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmdyaWRMYXllcikge1xyXG4gICAgICAgICAgICB0aGlzLmdyaWRMYXllciA9IGdyaWRMYXllcih1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICB3aXRoQWNjZXNzVG9rZW4odGhpcy5vcHRpb25zLmdyaWRMYXllciwgdGhpcy5vcHRpb25zLmFjY2Vzc1Rva2VuKSk7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkTGF5ZXIodGhpcy5ncmlkTGF5ZXIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5ncmlkTGF5ZXIgJiYgdGhpcy5vcHRpb25zLmdyaWRDb250cm9sKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZ3JpZENvbnRyb2wgPSBncmlkQ29udHJvbCh0aGlzLmdyaWRMYXllciwgdGhpcy5vcHRpb25zLmdyaWRDb250cm9sKTtcclxuICAgICAgICAgICAgdGhpcy5hZGRDb250cm9sKHRoaXMuZ3JpZENvbnRyb2wpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5sZWdlbmRDb250cm9sKSB7XHJcbiAgICAgICAgICAgIHRoaXMubGVnZW5kQ29udHJvbCA9IGxlZ2VuZENvbnRyb2wodGhpcy5vcHRpb25zLmxlZ2VuZENvbnRyb2wpO1xyXG4gICAgICAgICAgICB0aGlzLmFkZENvbnRyb2wodGhpcy5sZWdlbmRDb250cm9sKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuc2hhcmVDb250cm9sKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2hhcmVDb250cm9sID0gc2hhcmVDb250cm9sKHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICAgIHdpdGhBY2Nlc3NUb2tlbih0aGlzLm9wdGlvbnMuc2hhcmVDb250cm9sLCB0aGlzLm9wdGlvbnMuYWNjZXNzVG9rZW4pKTtcclxuICAgICAgICAgICAgdGhpcy5hZGRDb250cm9sKHRoaXMuc2hhcmVDb250cm9sKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX21hcGJveExvZ29Db250cm9sID0gbWFwYm94TG9nb0NvbnRyb2wodGhpcy5vcHRpb25zLm1hcGJveExvZ29Db250cm9sKTtcclxuICAgICAgICB0aGlzLmFkZENvbnRyb2wodGhpcy5fbWFwYm94TG9nb0NvbnRyb2wpO1xyXG5cclxuICAgICAgICB0aGlzLl9sb2FkVGlsZUpTT04oXyk7XHJcblxyXG4gICAgICAgIHRoaXMub24oJ2xheWVyYWRkJywgdGhpcy5fb25MYXllckFkZCwgdGhpcylcclxuICAgICAgICAgICAgLm9uKCdsYXllcnJlbW92ZScsIHRoaXMuX29uTGF5ZXJSZW1vdmUsIHRoaXMpXHJcbiAgICAgICAgICAgIC5vbignbW92ZWVuZCcsIHRoaXMuX3VwZGF0ZU1hcEZlZWRiYWNrTGluaywgdGhpcyk7XHJcblxyXG4gICAgICAgIHRoaXMud2hlblJlYWR5KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgZmVlZGJhY2sub24oJ2NoYW5nZScsIHRoaXMuX3VwZGF0ZU1hcEZlZWRiYWNrTGluaywgdGhpcyk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMub24oJ3VubG9hZCcsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgZmVlZGJhY2sub2ZmKCdjaGFuZ2UnLCB0aGlzLl91cGRhdGVNYXBGZWVkYmFja0xpbmssIHRoaXMpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICAvLyB1c2UgYSBqYXZhc2NyaXB0IG9iamVjdCBvZiB0aWxlanNvbiBkYXRhIHRvIGNvbmZpZ3VyZSB0aGlzIGxheWVyXHJcbiAgICBfc2V0VGlsZUpTT046IGZ1bmN0aW9uKF8pIHtcclxuICAgICAgICB0aGlzLl90aWxlanNvbiA9IF87XHJcbiAgICAgICAgdGhpcy5faW5pdGlhbGl6ZShfKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgZ2V0VGlsZUpTT046IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl90aWxlanNvbjtcclxuICAgIH0sXHJcblxyXG4gICAgX2luaXRpYWxpemU6IGZ1bmN0aW9uKGpzb24pIHtcclxuICAgICAgICBpZiAodGhpcy50aWxlTGF5ZXIpIHtcclxuICAgICAgICAgICAgdGhpcy50aWxlTGF5ZXIuX3NldFRpbGVKU09OKGpzb24pO1xyXG4gICAgICAgICAgICB0aGlzLl91cGRhdGVMYXllcih0aGlzLnRpbGVMYXllcik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5mZWF0dXJlTGF5ZXIgJiYgIXRoaXMuZmVhdHVyZUxheWVyLmdldEdlb0pTT04oKSAmJiBqc29uLmRhdGEgJiYganNvbi5kYXRhWzBdKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZmVhdHVyZUxheWVyLmxvYWRVUkwoanNvbi5kYXRhWzBdKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmdyaWRMYXllcikge1xyXG4gICAgICAgICAgICB0aGlzLmdyaWRMYXllci5fc2V0VGlsZUpTT04oanNvbik7XHJcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUxheWVyKHRoaXMuZ3JpZExheWVyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmxlZ2VuZENvbnRyb2wgJiYganNvbi5sZWdlbmQpIHtcclxuICAgICAgICAgICAgdGhpcy5sZWdlbmRDb250cm9sLmFkZExlZ2VuZChqc29uLmxlZ2VuZCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5zaGFyZUNvbnRyb2wpIHtcclxuICAgICAgICAgICAgdGhpcy5zaGFyZUNvbnRyb2wuX3NldFRpbGVKU09OKGpzb24pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fbWFwYm94TG9nb0NvbnRyb2wuX3NldFRpbGVKU09OKGpzb24pO1xyXG5cclxuICAgICAgICBpZiAoIXRoaXMuX2xvYWRlZCAmJiBqc29uLmNlbnRlcikge1xyXG4gICAgICAgICAgICB2YXIgem9vbSA9IHRoaXMuZ2V0Wm9vbSgpICE9PSB1bmRlZmluZWQgPyB0aGlzLmdldFpvb20oKSA6IGpzb24uY2VudGVyWzJdLFxyXG4gICAgICAgICAgICAgICAgY2VudGVyID0gTC5sYXRMbmcoanNvbi5jZW50ZXJbMV0sIGpzb24uY2VudGVyWzBdKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuc2V0VmlldyhjZW50ZXIsIHpvb20pO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgX3VwZGF0ZU1hcEZlZWRiYWNrTGluazogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLl9jb250cm9sQ29udGFpbmVyLmdldEVsZW1lbnRzQnlDbGFzc05hbWUpIHJldHVybjtcclxuICAgICAgICB2YXIgbGluayA9IHRoaXMuX2NvbnRyb2xDb250YWluZXIuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnbWFwYm94LWltcHJvdmUtbWFwJyk7XHJcbiAgICAgICAgaWYgKGxpbmsubGVuZ3RoICYmIHRoaXMuX2xvYWRlZCkge1xyXG4gICAgICAgICAgICB2YXIgY2VudGVyID0gdGhpcy5nZXRDZW50ZXIoKS53cmFwKCk7XHJcbiAgICAgICAgICAgIHZhciB0aWxlanNvbiA9IHRoaXMuX3RpbGVqc29uIHx8IHt9O1xyXG4gICAgICAgICAgICB2YXIgaWQgPSB0aWxlanNvbi5pZCB8fCAnJztcclxuXHJcbiAgICAgICAgICAgIHZhciBoYXNoID0gJyMnICsgaWQgKyAnLycgK1xyXG4gICAgICAgICAgICAgICAgY2VudGVyLmxuZy50b0ZpeGVkKDMpICsgJy8nICtcclxuICAgICAgICAgICAgICAgIGNlbnRlci5sYXQudG9GaXhlZCgzKSArICcvJyArXHJcbiAgICAgICAgICAgICAgICB0aGlzLmdldFpvb20oKTtcclxuXHJcbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBmZWVkYmFjay5kYXRhKSB7XHJcbiAgICAgICAgICAgICAgICBoYXNoICs9ICcvJyArIGtleSArICc9JyArIGZlZWRiYWNrLmRhdGFba2V5XTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5rLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsaW5rW2ldLmhhc2ggPSBoYXNoO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBfb25MYXllckFkZDogZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmICgnb24nIGluIGUubGF5ZXIpIHtcclxuICAgICAgICAgICAgZS5sYXllci5vbigncmVhZHknLCB0aGlzLl9vbkxheWVyUmVhZHksIHRoaXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB3aW5kb3cuc2V0VGltZW91dChMLmJpbmQodGhpcy5fdXBkYXRlTWFwRmVlZGJhY2tMaW5rLCB0aGlzKSwgMCk7IC8vIFVwZGF0ZSBhZnRlciBhdHRyaWJ1dGlvbiBjb250cm9sIHJlc2V0cyB0aGUgSFRNTC5cclxuICAgIH0sXHJcblxyXG4gICAgX29uTGF5ZXJSZW1vdmU6IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBpZiAoJ29uJyBpbiBlLmxheWVyKSB7XHJcbiAgICAgICAgICAgIGUubGF5ZXIub2ZmKCdyZWFkeScsIHRoaXMuX29uTGF5ZXJSZWFkeSwgdGhpcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KEwuYmluZCh0aGlzLl91cGRhdGVNYXBGZWVkYmFja0xpbmssIHRoaXMpLCAwKTsgLy8gVXBkYXRlIGFmdGVyIGF0dHJpYnV0aW9uIGNvbnRyb2wgcmVzZXRzIHRoZSBIVE1MLlxyXG4gICAgfSxcclxuXHJcbiAgICBfb25MYXllclJlYWR5OiBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgdGhpcy5fdXBkYXRlTGF5ZXIoZS50YXJnZXQpO1xyXG4gICAgfSxcclxuXHJcbiAgICBfdXBkYXRlTGF5ZXI6IGZ1bmN0aW9uKGxheWVyKSB7XHJcbiAgICAgICAgaWYgKCFsYXllci5vcHRpb25zKSByZXR1cm47XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmF0dHJpYnV0aW9uQ29udHJvbCAmJiB0aGlzLl9sb2FkZWQgJiYgbGF5ZXIuZ2V0QXR0cmlidXRpb24pIHtcclxuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGlvbkNvbnRyb2wuYWRkQXR0cmlidXRpb24obGF5ZXIuZ2V0QXR0cmlidXRpb24oKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIShMLnN0YW1wKGxheWVyKSBpbiB0aGlzLl96b29tQm91bmRMYXllcnMpICYmXHJcbiAgICAgICAgICAgICAgICAobGF5ZXIub3B0aW9ucy5tYXhab29tIHx8IGxheWVyLm9wdGlvbnMubWluWm9vbSkpIHtcclxuICAgICAgICAgICAgdGhpcy5fem9vbUJvdW5kTGF5ZXJzW0wuc3RhbXAobGF5ZXIpXSA9IGxheWVyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fdXBkYXRlTWFwRmVlZGJhY2tMaW5rKCk7XHJcbiAgICAgICAgdGhpcy5fdXBkYXRlWm9vbUxldmVscygpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbm1vZHVsZS5leHBvcnRzLk1hcCA9IExNYXA7XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5tYXAgPSBmdW5jdGlvbihlbGVtZW50LCBfLCBvcHRpb25zKSB7XHJcbiAgICByZXR1cm4gbmV3IExNYXAoZWxlbWVudCwgXywgb3B0aW9ucyk7XHJcbn07XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBnZW9jb2RlckNvbnRyb2wgPSByZXF1aXJlKCcuL2dlb2NvZGVyX2NvbnRyb2wnKSxcclxuICAgIGdyaWRDb250cm9sID0gcmVxdWlyZSgnLi9ncmlkX2NvbnRyb2wnKSxcclxuICAgIGZlYXR1cmVMYXllciA9IHJlcXVpcmUoJy4vZmVhdHVyZV9sYXllcicpLFxyXG4gICAgbGVnZW5kQ29udHJvbCA9IHJlcXVpcmUoJy4vbGVnZW5kX2NvbnRyb2wnKSxcclxuICAgIHNoYXJlQ29udHJvbCA9IHJlcXVpcmUoJy4vc2hhcmVfY29udHJvbCcpLFxyXG4gICAgdGlsZUxheWVyID0gcmVxdWlyZSgnLi90aWxlX2xheWVyJyksXHJcbiAgICBtYXAgPSByZXF1aXJlKCcuL21hcCcpLFxyXG4gICAgZ3JpZExheWVyID0gcmVxdWlyZSgnLi9ncmlkX2xheWVyJyksXHJcbiAgICBzdHlsZUxheWVyID0gcmVxdWlyZSgnLi9zdHlsZV9sYXllcicpO1xyXG5cclxuTC5tYXBib3ggPSBtb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFZFUlNJT046IHJlcXVpcmUoJy4uL3BhY2thZ2UuanNvbicpLnZlcnNpb24sXHJcbiAgICBnZW9jb2RlcjogcmVxdWlyZSgnLi9nZW9jb2RlcicpLFxyXG4gICAgbWFya2VyOiByZXF1aXJlKCcuL21hcmtlcicpLFxyXG4gICAgc2ltcGxlc3R5bGU6IHJlcXVpcmUoJy4vc2ltcGxlc3R5bGUnKSxcclxuICAgIHRpbGVMYXllcjogdGlsZUxheWVyLnRpbGVMYXllcixcclxuICAgIFRpbGVMYXllcjogdGlsZUxheWVyLlRpbGVMYXllcixcclxuICAgIHN0eWxlTGF5ZXI6IHN0eWxlTGF5ZXIuc3R5bGVMYXllcixcclxuICAgIFN0eWxlTGF5ZXI6IHN0eWxlTGF5ZXIuU3R5bGVMYXllcixcclxuICAgIHNoYXJlQ29udHJvbDogc2hhcmVDb250cm9sLnNoYXJlQ29udHJvbCxcclxuICAgIFNoYXJlQ29udHJvbDogc2hhcmVDb250cm9sLlNoYXJlQ29udHJvbCxcclxuICAgIGxlZ2VuZENvbnRyb2w6IGxlZ2VuZENvbnRyb2wubGVnZW5kQ29udHJvbCxcclxuICAgIExlZ2VuZENvbnRyb2w6IGxlZ2VuZENvbnRyb2wuTGVnZW5kQ29udHJvbCxcclxuICAgIGdlb2NvZGVyQ29udHJvbDogZ2VvY29kZXJDb250cm9sLmdlb2NvZGVyQ29udHJvbCxcclxuICAgIEdlb2NvZGVyQ29udHJvbDogZ2VvY29kZXJDb250cm9sLkdlb2NvZGVyQ29udHJvbCxcclxuICAgIGdyaWRDb250cm9sOiBncmlkQ29udHJvbC5ncmlkQ29udHJvbCxcclxuICAgIEdyaWRDb250cm9sOiBncmlkQ29udHJvbC5HcmlkQ29udHJvbCxcclxuICAgIGdyaWRMYXllcjogZ3JpZExheWVyLmdyaWRMYXllcixcclxuICAgIEdyaWRMYXllcjogZ3JpZExheWVyLkdyaWRMYXllcixcclxuICAgIGZlYXR1cmVMYXllcjogZmVhdHVyZUxheWVyLmZlYXR1cmVMYXllcixcclxuICAgIEZlYXR1cmVMYXllcjogZmVhdHVyZUxheWVyLkZlYXR1cmVMYXllcixcclxuICAgIG1hcDogbWFwLm1hcCxcclxuICAgIE1hcDogbWFwLk1hcCxcclxuICAgIGNvbmZpZzogcmVxdWlyZSgnLi9jb25maWcnKSxcclxuICAgIHNhbml0aXplOiByZXF1aXJlKCdzYW5pdGl6ZS1jYWphJyksXHJcbiAgICB0ZW1wbGF0ZTogcmVxdWlyZSgnbXVzdGFjaGUnKS50b19odG1sLFxyXG4gICAgZmVlZGJhY2s6IHJlcXVpcmUoJy4vZmVlZGJhY2snKVxyXG59O1xyXG5cclxuXHJcbi8vIEhhcmRjb2RlIGltYWdlIHBhdGgsIGJlY2F1c2UgTGVhZmxldCdzIGF1dG9kZXRlY3Rpb25cclxuLy8gZmFpbHMsIGJlY2F1c2UgbWFwYm94LmpzIGlzIG5vdCBuYW1lZCBsZWFmbGV0LmpzXHJcbndpbmRvdy5MLkljb24uRGVmYXVsdC5pbWFnZVBhdGggPVxyXG4gICAgLy8gRGV0ZWN0IGJhZC1uZXdzIHByb3RvY29scyBsaWtlIGZpbGU6Ly8gYW5kIGhhcmRjb2RlXHJcbiAgICAvLyB0byBodHRwcyBpZiB0aGV5J3JlIGRldGVjdGVkLlxyXG4gICAgKChkb2N1bWVudC5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOicgfHxcclxuICAgIGRvY3VtZW50LmxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cDonKSA/ICcnIDogJ2h0dHBzOicpICtcclxuICAgICcvL2FwaS50aWxlcy5tYXBib3guY29tL21hcGJveC5qcy8nICsgJ3YnICtcclxuICAgIHJlcXVpcmUoJy4uL3BhY2thZ2UuanNvbicpLnZlcnNpb24gKyAnL2ltYWdlcy8nO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgTWFwYm94TG9nb0NvbnRyb2wgPSBMLkNvbnRyb2wuZXh0ZW5kKHtcclxuXHJcbiAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgcG9zaXRpb246ICdib3R0b21sZWZ0J1xyXG4gICAgfSxcclxuXHJcbiAgICBpbml0aWFsaXplOiBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgICAgICAgTC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xyXG4gICAgfSxcclxuXHJcbiAgICBvbkFkZDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5fY29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgJ21hcGJveC1sb2dvJyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbnRhaW5lcjtcclxuICAgIH0sXHJcblxyXG4gICAgX3NldFRpbGVKU09OOiBmdW5jdGlvbihqc29uKSB7XHJcbiAgICAgICAgLy8gQ2hlY2sgaWYgYWNjb3VudCByZWZlcmVuY2VkIGJ5IHRoZSBhY2Nlc3NUb2tlblxyXG4gICAgICAgIC8vIGlzIGFzc2NvY2lhdGVkIHdpdGggdGhlIE1hcGJveCBMb2dvXHJcbiAgICAgICAgLy8gYXMgZGV0ZXJtaW5lZCBieSBtYXBib3gtbWFwcy5cclxuICAgICAgICBpZiAoanNvbi5tYXBib3hfbG9nbykge1xyXG4gICAgICAgICAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fY29udGFpbmVyLCAnbWFwYm94LWxvZ28tdHJ1ZScpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5NYXBib3hMb2dvQ29udHJvbCA9IE1hcGJveExvZ29Db250cm9sO1xyXG5cclxubW9kdWxlLmV4cG9ydHMubWFwYm94TG9nb0NvbnRyb2wgPSBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgICByZXR1cm4gbmV3IE1hcGJveExvZ29Db250cm9sKG9wdGlvbnMpO1xyXG59O1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgZm9ybWF0X3VybCA9IHJlcXVpcmUoJy4vZm9ybWF0X3VybCcpLFxyXG4gICAgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpLFxyXG4gICAgc2FuaXRpemUgPSByZXF1aXJlKCdzYW5pdGl6ZS1jYWphJyk7XHJcblxyXG4vLyBtYXBib3gtcmVsYXRlZCBtYXJrZXJzIGZ1bmN0aW9uYWxpdHlcclxuLy8gcHJvdmlkZSBhbiBpY29uIGZyb20gbWFwYm94J3Mgc2ltcGxlLXN0eWxlIHNwZWMgYW5kIGhvc3RlZCBtYXJrZXJzXHJcbi8vIHNlcnZpY2VcclxuZnVuY3Rpb24gaWNvbihmcCwgb3B0aW9ucykge1xyXG4gICAgZnAgPSBmcCB8fCB7fTtcclxuXHJcbiAgICB2YXIgc2l6ZXMgPSB7XHJcbiAgICAgICAgICAgIHNtYWxsOiBbMjAsIDUwXSxcclxuICAgICAgICAgICAgbWVkaXVtOiBbMzAsIDcwXSxcclxuICAgICAgICAgICAgbGFyZ2U6IFszNSwgOTBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBzaXplID0gZnBbJ21hcmtlci1zaXplJ10gfHwgJ21lZGl1bScsXHJcbiAgICAgICAgc3ltYm9sID0gKCdtYXJrZXItc3ltYm9sJyBpbiBmcCAmJiBmcFsnbWFya2VyLXN5bWJvbCddICE9PSAnJykgPyAnLScgKyBmcFsnbWFya2VyLXN5bWJvbCddIDogJycsXHJcbiAgICAgICAgY29sb3IgPSAoZnBbJ21hcmtlci1jb2xvciddIHx8ICc3ZTdlN2UnKS5yZXBsYWNlKCcjJywgJycpO1xyXG5cclxuICAgIHJldHVybiBMLmljb24oe1xyXG4gICAgICAgIGljb25Vcmw6IGZvcm1hdF91cmwoJy92NC9tYXJrZXIvJyArXHJcbiAgICAgICAgICAgICdwaW4tJyArIHNpemUuY2hhckF0KDApICsgc3ltYm9sICsgJysnICsgY29sb3IgK1xyXG4gICAgICAgICAgICAvLyBkZXRlY3QgYW5kIHVzZSByZXRpbmEgbWFya2Vycywgd2hpY2ggYXJlIHgyIHJlc29sdXRpb25cclxuICAgICAgICAgICAgKEwuQnJvd3Nlci5yZXRpbmEgPyAnQDJ4JyA6ICcnKSArICcucG5nJywgb3B0aW9ucyAmJiBvcHRpb25zLmFjY2Vzc1Rva2VuKSxcclxuICAgICAgICBpY29uU2l6ZTogc2l6ZXNbc2l6ZV0sXHJcbiAgICAgICAgaWNvbkFuY2hvcjogW3NpemVzW3NpemVdWzBdIC8gMiwgc2l6ZXNbc2l6ZV1bMV0gLyAyXSxcclxuICAgICAgICBwb3B1cEFuY2hvcjogWzAsIC1zaXplc1tzaXplXVsxXSAvIDJdXHJcbiAgICB9KTtcclxufVxyXG5cclxuLy8gYSBmYWN0b3J5IHRoYXQgcHJvdmlkZXMgbWFya2VycyBmb3IgTGVhZmxldCBmcm9tIE1hcGJveCdzXHJcbi8vIFtzaW1wbGUtc3R5bGUgc3BlY2lmaWNhdGlvbl0oaHR0cHM6Ly9naXRodWIuY29tL21hcGJveC9zaW1wbGVzdHlsZS1zcGVjKVxyXG4vLyBhbmQgW01hcmtlcnMgQVBJXShodHRwOi8vbWFwYm94LmNvbS9kZXZlbG9wZXJzL2FwaS8jbWFya2VycykuXHJcbmZ1bmN0aW9uIHN0eWxlKGYsIGxhdGxvbiwgb3B0aW9ucykge1xyXG4gICAgcmV0dXJuIEwubWFya2VyKGxhdGxvbiwge1xyXG4gICAgICAgIGljb246IGljb24oZi5wcm9wZXJ0aWVzLCBvcHRpb25zKSxcclxuICAgICAgICB0aXRsZTogdXRpbC5zdHJpcF90YWdzKFxyXG4gICAgICAgICAgICBzYW5pdGl6ZSgoZi5wcm9wZXJ0aWVzICYmIGYucHJvcGVydGllcy50aXRsZSkgfHwgJycpKVxyXG4gICAgfSk7XHJcbn1cclxuXHJcbi8vIFNhbml0aXplIGFuZCBmb3JtYXQgcHJvcGVydGllcyBvZiBhIEdlb0pTT04gRmVhdHVyZSBvYmplY3QgaW4gb3JkZXJcclxuLy8gdG8gZm9ybSB0aGUgSFRNTCBzdHJpbmcgdXNlZCBhcyB0aGUgYXJndW1lbnQgZm9yIGBMLmNyZWF0ZVBvcHVwYFxyXG5mdW5jdGlvbiBjcmVhdGVQb3B1cChmLCBzYW5pdGl6ZXIpIHtcclxuICAgIGlmICghZiB8fCAhZi5wcm9wZXJ0aWVzKSByZXR1cm4gJyc7XHJcbiAgICB2YXIgcG9wdXAgPSAnJztcclxuXHJcbiAgICBpZiAoZi5wcm9wZXJ0aWVzLnRpdGxlKSB7XHJcbiAgICAgICAgcG9wdXAgKz0gJzxkaXYgY2xhc3M9XCJtYXJrZXItdGl0bGVcIj4nICsgZi5wcm9wZXJ0aWVzLnRpdGxlICsgJzwvZGl2Pic7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGYucHJvcGVydGllcy5kZXNjcmlwdGlvbikge1xyXG4gICAgICAgIHBvcHVwICs9ICc8ZGl2IGNsYXNzPVwibWFya2VyLWRlc2NyaXB0aW9uXCI+JyArIGYucHJvcGVydGllcy5kZXNjcmlwdGlvbiArICc8L2Rpdj4nO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiAoc2FuaXRpemVyIHx8IHNhbml0aXplKShwb3B1cCk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgaWNvbjogaWNvbixcclxuICAgIHN0eWxlOiBzdHlsZSxcclxuICAgIGNyZWF0ZVBvcHVwOiBjcmVhdGVQb3B1cFxyXG59O1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgY29yc2xpdGUgPSByZXF1aXJlKCdjb3JzbGl0ZScpLFxyXG4gICAgc3RyaWN0ID0gcmVxdWlyZSgnLi91dGlsJykuc3RyaWN0LFxyXG4gICAgY29uZmlnID0gcmVxdWlyZSgnLi9jb25maWcnKTtcclxuXHJcbnZhciBwcm90b2NvbCA9IC9eKGh0dHBzPzopPyg/PVxcL1xcLygufGFwaSlcXC50aWxlc1xcLm1hcGJveFxcLmNvbVxcLykvO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7XHJcbiAgICBzdHJpY3QodXJsLCAnc3RyaW5nJyk7XHJcbiAgICBzdHJpY3QoY2FsbGJhY2ssICdmdW5jdGlvbicpO1xyXG5cclxuICAgIHVybCA9IHVybC5yZXBsYWNlKHByb3RvY29sLCBmdW5jdGlvbihtYXRjaCwgcHJvdG9jb2wpIHtcclxuICAgICAgICBpZiAoISgnd2l0aENyZWRlbnRpYWxzJyBpbiBuZXcgd2luZG93LlhNTEh0dHBSZXF1ZXN0KCkpKSB7XHJcbiAgICAgICAgICAgIC8vIFhEb21haW5SZXF1ZXN0IGluIHVzZTsgZG9lc24ndCBzdXBwb3J0IGNyb3NzLXByb3RvY29sIHJlcXVlc3RzXHJcbiAgICAgICAgICAgIHJldHVybiBkb2N1bWVudC5sb2NhdGlvbi5wcm90b2NvbDtcclxuICAgICAgICB9IGVsc2UgaWYgKHByb3RvY29sID09PSAnaHR0cHM6JyB8fCBkb2N1bWVudC5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOicgfHwgY29uZmlnLkZPUkNFX0hUVFBTKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnaHR0cHM6JztcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gJ2h0dHA6JztcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBmdW5jdGlvbiBvbmxvYWQoZXJyLCByZXNwKSB7XHJcbiAgICAgICAgaWYgKCFlcnIgJiYgcmVzcCkge1xyXG4gICAgICAgICAgICByZXNwID0gSlNPTi5wYXJzZShyZXNwLnJlc3BvbnNlVGV4dCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNhbGxiYWNrKGVyciwgcmVzcCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGNvcnNsaXRlKHVybCwgb25sb2FkKTtcclxufTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGZvcm1hdF91cmwgPSByZXF1aXJlKCcuL2Zvcm1hdF91cmwnKTtcclxuXHJcbnZhciBTaGFyZUNvbnRyb2wgPSBMLkNvbnRyb2wuZXh0ZW5kKHtcclxuICAgIGluY2x1ZGVzOiBbcmVxdWlyZSgnLi9sb2FkX3RpbGVqc29uJyldLFxyXG5cclxuICAgIG9wdGlvbnM6IHtcclxuICAgICAgICBwb3NpdGlvbjogJ3RvcGxlZnQnLFxyXG4gICAgICAgIHVybDogJydcclxuICAgIH0sXHJcblxyXG4gICAgaW5pdGlhbGl6ZTogZnVuY3Rpb24oXywgb3B0aW9ucykge1xyXG4gICAgICAgIEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcclxuICAgICAgICB0aGlzLl9sb2FkVGlsZUpTT04oXyk7XHJcbiAgICB9LFxyXG5cclxuICAgIF9zZXRUaWxlSlNPTjogZnVuY3Rpb24oanNvbikge1xyXG4gICAgICAgIHRoaXMuX3RpbGVqc29uID0ganNvbjtcclxuICAgIH0sXHJcblxyXG4gICAgb25BZGQ6IGZ1bmN0aW9uKG1hcCkge1xyXG4gICAgICAgIHRoaXMuX21hcCA9IG1hcDtcclxuXHJcbiAgICAgICAgdmFyIGNvbnRhaW5lciA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsICdsZWFmbGV0LWNvbnRyb2wtbWFwYm94LXNoYXJlIGxlYWZsZXQtYmFyJyk7XHJcbiAgICAgICAgdmFyIGxpbmsgPSBMLkRvbVV0aWwuY3JlYXRlKCdhJywgJ21hcGJveC1zaGFyZSBtYXBib3gtaWNvbiBtYXBib3gtaWNvbi1zaGFyZScsIGNvbnRhaW5lcik7XHJcbiAgICAgICAgbGluay5ocmVmID0gJyMnO1xyXG5cclxuICAgICAgICB0aGlzLl9tb2RhbCA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsICdtYXBib3gtbW9kYWwnLCB0aGlzLl9tYXAuX2NvbnRhaW5lcik7XHJcbiAgICAgICAgdGhpcy5fbWFzayA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsICdtYXBib3gtbW9kYWwtbWFzaycsIHRoaXMuX21vZGFsKTtcclxuICAgICAgICB0aGlzLl9jb250ZW50ID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgJ21hcGJveC1tb2RhbC1jb250ZW50JywgdGhpcy5fbW9kYWwpO1xyXG5cclxuICAgICAgICBMLkRvbUV2ZW50LmFkZExpc3RlbmVyKGxpbmssICdjbGljaycsIHRoaXMuX3NoYXJlQ2xpY2ssIHRoaXMpO1xyXG4gICAgICAgIEwuRG9tRXZlbnQuZGlzYWJsZUNsaWNrUHJvcGFnYXRpb24oY29udGFpbmVyKTtcclxuXHJcbiAgICAgICAgdGhpcy5fbWFwLm9uKCdtb3VzZWRvd24nLCB0aGlzLl9jbGlja091dCwgdGhpcyk7XHJcblxyXG4gICAgICAgIHJldHVybiBjb250YWluZXI7XHJcbiAgICB9LFxyXG5cclxuICAgIF9jbGlja091dDogZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmICh0aGlzLl9zaGFyaW5nKSB7XHJcbiAgICAgICAgICAgIEwuRG9tRXZlbnQucHJldmVudERlZmF1bHQoZSk7XHJcbiAgICAgICAgICAgIEwuRG9tVXRpbC5yZW1vdmVDbGFzcyh0aGlzLl9tb2RhbCwgJ2FjdGl2ZScpO1xyXG4gICAgICAgICAgICB0aGlzLl9jb250ZW50LmlubmVySFRNTCA9ICcnO1xyXG4gICAgICAgICAgICB0aGlzLl9zaGFyaW5nID0gbnVsbDtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgX3NoYXJlQ2xpY2s6IGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBMLkRvbUV2ZW50LnN0b3AoZSk7XHJcbiAgICAgICAgaWYgKHRoaXMuX3NoYXJpbmcpIHJldHVybiB0aGlzLl9jbGlja091dChlKTtcclxuXHJcbiAgICAgICAgdmFyIHRpbGVqc29uID0gdGhpcy5fdGlsZWpzb24gfHwgdGhpcy5fbWFwLl90aWxlanNvbiB8fCB7fSxcclxuICAgICAgICAgICAgdXJsID0gZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMub3B0aW9ucy51cmwgfHwgdGlsZWpzb24ud2VicGFnZSB8fCB3aW5kb3cubG9jYXRpb24pLFxyXG4gICAgICAgICAgICBuYW1lID0gZW5jb2RlVVJJQ29tcG9uZW50KHRpbGVqc29uLm5hbWUpLFxyXG4gICAgICAgICAgICBpbWFnZSA9IGZvcm1hdF91cmwoJy92NC8nICsgdGlsZWpzb24uaWQgKyAnLycgKyB0aGlzLl9tYXAuZ2V0Q2VudGVyKCkubG5nICsgJywnICsgdGhpcy5fbWFwLmdldENlbnRlcigpLmxhdCArICcsJyArIHRoaXMuX21hcC5nZXRab29tKCkgKyAnLzYwMHg2MDAucG5nJywgdGhpcy5vcHRpb25zLmFjY2Vzc1Rva2VuKSxcclxuICAgICAgICAgICAgZW1iZWQgPSBmb3JtYXRfdXJsKCcvdjQvJyArIHRpbGVqc29uLmlkICsgJy5odG1sJywgdGhpcy5vcHRpb25zLmFjY2Vzc1Rva2VuKSxcclxuICAgICAgICAgICAgdHdpdHRlclVSTCA9ICcvL3R3aXR0ZXIuY29tL2ludGVudC90d2VldD9zdGF0dXM9JyArIG5hbWUgKyAnICcgKyB1cmwsXHJcbiAgICAgICAgICAgIGZhY2Vib29rVVJMID0gJy8vd3d3LmZhY2Vib29rLmNvbS9zaGFyZXIucGhwP3U9JyArIHVybCArICcmdD0nICsgbmFtZSxcclxuICAgICAgICAgICAgcGludGVyZXN0VVJMID0gJy8vd3d3LnBpbnRlcmVzdC5jb20vcGluL2NyZWF0ZS9idXR0b24vP3VybD0nICsgdXJsICsgJyZtZWRpYT0nICsgaW1hZ2UgKyAnJmRlc2NyaXB0aW9uPScgKyBuYW1lLFxyXG4gICAgICAgICAgICBlbWJlZFZhbHVlID0gJzxpZnJhbWUgd2lkdGg9XCIxMDAlXCIgaGVpZ2h0PVwiNTAwcHhcIiBmcmFtZUJvcmRlcj1cIjBcIiBzcmM9XCInICsgZW1iZWQgKyAnXCI+PC9pZnJhbWU+JyxcclxuICAgICAgICAgICAgZW1iZWRMYWJlbCA9ICdDb3B5IGFuZCBwYXN0ZSB0aGlzIDxzdHJvbmc+SFRNTCBjb2RlPC9zdHJvbmc+IGludG8gZG9jdW1lbnRzIHRvIGVtYmVkIHRoaXMgbWFwIG9uIHdlYiBwYWdlcy4nO1xyXG5cclxuICAgICAgICBmdW5jdGlvbiBjcmVhdGVTaGFyZUJ1dHRvbihidXR0b25DbGFzcywgaHJlZiwgc29jaWFsTWVkaWFOYW1lKSB7XHJcbiAgICAgICAgICAgIHZhciBlbGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG4gICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZSgnY2xhc3MnLCBidXR0b25DbGFzcyk7XHJcbiAgICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKCdocmVmJywgaHJlZik7XHJcbiAgICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKCd0YXJnZXQnLCAnX2JsYW5rJyk7XHJcbiAgICAgICAgICAgIHNvY2lhbE1lZGlhTmFtZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHNvY2lhbE1lZGlhTmFtZSk7XHJcbiAgICAgICAgICAgIGVsZW0uYXBwZW5kQ2hpbGQoc29jaWFsTWVkaWFOYW1lKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBlbGVtO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX21vZGFsLCAnYWN0aXZlJyk7XHJcblxyXG4gICAgICAgIHRoaXMuX3NoYXJpbmcgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCAnbWFwYm94LW1vZGFsLWJvZHknLCB0aGlzLl9jb250ZW50KTtcclxuXHJcbiAgICAgICAgdmFyIHR3aXR0ZXJCdXR0b24gPSBjcmVhdGVTaGFyZUJ1dHRvbignbWFwYm94LWJ1dHRvbiBtYXBib3gtYnV0dG9uLWljb24gbWFwYm94LWljb24tdHdpdHRlcicsIHR3aXR0ZXJVUkwsICdUd2l0dGVyJyk7XHJcbiAgICAgICAgdmFyIGZhY2Vib29rQnV0dG9uID0gY3JlYXRlU2hhcmVCdXR0b24oJ21hcGJveC1idXR0b24gbWFwYm94LWJ1dHRvbi1pY29uIG1hcGJveC1pY29uLWZhY2Vib29rJywgZmFjZWJvb2tVUkwsICdGYWNlYm9vaycpO1xyXG4gICAgICAgIHZhciBwaW50ZXJlc3RCdXR0b24gPSBjcmVhdGVTaGFyZUJ1dHRvbignbWFwYm94LWJ1dHRvbiBtYXBib3gtYnV0dG9uLWljb24gbWFwYm94LWljb24tcGludGVyZXN0JywgcGludGVyZXN0VVJMLCAnUGludGVyZXN0Jyk7XHJcblxyXG4gICAgICAgIHZhciBzaGFyZUhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2gzJyk7XHJcbiAgICAgICAgdmFyIHNoYXJlVGV4dCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCdTaGFyZSB0aGlzIG1hcCcpO1xyXG4gICAgICAgIHNoYXJlSGVhZGVyLmFwcGVuZENoaWxkKHNoYXJlVGV4dCk7XHJcblxyXG4gICAgICAgIHZhciBzaGFyZUJ1dHRvbnMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICBzaGFyZUJ1dHRvbnMuc2V0QXR0cmlidXRlKCdjbGFzcycsICdtYXBib3gtc2hhcmUtYnV0dG9ucycpO1xyXG4gICAgICAgIHNoYXJlQnV0dG9ucy5hcHBlbmRDaGlsZChmYWNlYm9va0J1dHRvbik7XHJcbiAgICAgICAgc2hhcmVCdXR0b25zLmFwcGVuZENoaWxkKHR3aXR0ZXJCdXR0b24pO1xyXG4gICAgICAgIHNoYXJlQnV0dG9ucy5hcHBlbmRDaGlsZChwaW50ZXJlc3RCdXR0b24pO1xyXG5cclxuICAgICAgICB0aGlzLl9zaGFyaW5nLmFwcGVuZENoaWxkKHNoYXJlSGVhZGVyKTtcclxuICAgICAgICB0aGlzLl9zaGFyaW5nLmFwcGVuZENoaWxkKHNoYXJlQnV0dG9ucyk7XHJcblxyXG4gICAgICAgIHZhciBpbnB1dCA9IEwuRG9tVXRpbC5jcmVhdGUoJ2lucHV0JywgJ21hcGJveC1lbWJlZCcsIHRoaXMuX3NoYXJpbmcpO1xyXG4gICAgICAgIGlucHV0LnR5cGUgPSAndGV4dCc7XHJcbiAgICAgICAgaW5wdXQudmFsdWUgPSBlbWJlZFZhbHVlO1xyXG5cclxuICAgICAgICB2YXIgbGFiZWwgPSBMLkRvbVV0aWwuY3JlYXRlKCdsYWJlbCcsICdtYXBib3gtZW1iZWQtZGVzY3JpcHRpb24nLCB0aGlzLl9zaGFyaW5nKTtcclxuICAgICAgICBsYWJlbC5pbm5lckhUTUwgPSBlbWJlZExhYmVsO1xyXG5cclxuICAgICAgICB2YXIgY2xvc2UgPSBMLkRvbVV0aWwuY3JlYXRlKCdhJywgJ2xlYWZsZXQtcG9wdXAtY2xvc2UtYnV0dG9uJywgdGhpcy5fc2hhcmluZyk7XHJcbiAgICAgICAgY2xvc2UuaHJlZiA9ICcjJztcclxuXHJcbiAgICAgICAgTC5Eb21FdmVudC5kaXNhYmxlQ2xpY2tQcm9wYWdhdGlvbih0aGlzLl9zaGFyaW5nKTtcclxuICAgICAgICBMLkRvbUV2ZW50LmFkZExpc3RlbmVyKGNsb3NlLCAnY2xpY2snLCB0aGlzLl9jbGlja091dCwgdGhpcyk7XHJcbiAgICAgICAgTC5Eb21FdmVudC5hZGRMaXN0ZW5lcihpbnB1dCwgJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgICBlLnRhcmdldC5mb2N1cygpO1xyXG4gICAgICAgICAgICBlLnRhcmdldC5zZWxlY3QoKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5TaGFyZUNvbnRyb2wgPSBTaGFyZUNvbnRyb2w7XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5zaGFyZUNvbnRyb2wgPSBmdW5jdGlvbihfLCBvcHRpb25zKSB7XHJcbiAgICByZXR1cm4gbmV3IFNoYXJlQ29udHJvbChfLCBvcHRpb25zKTtcclxufTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuLy8gYW4gaW1wbGVtZW50YXRpb24gb2YgdGhlIHNpbXBsZXN0eWxlIHNwZWMgZm9yIHBvbHlnb24gYW5kIGxpbmVzdHJpbmcgZmVhdHVyZXNcclxuLy8gaHR0cHM6Ly9naXRodWIuY29tL21hcGJveC9zaW1wbGVzdHlsZS1zcGVjXHJcbnZhciBkZWZhdWx0cyA9IHtcclxuICAgIHN0cm9rZTogJyM1NTU1NTUnLFxyXG4gICAgJ3N0cm9rZS13aWR0aCc6IDIsXHJcbiAgICAnc3Ryb2tlLW9wYWNpdHknOiAxLFxyXG4gICAgZmlsbDogJyM1NTU1NTUnLFxyXG4gICAgJ2ZpbGwtb3BhY2l0eSc6IDAuNVxyXG59O1xyXG5cclxudmFyIG1hcHBpbmcgPSBbXHJcbiAgICBbJ3N0cm9rZScsICdjb2xvciddLFxyXG4gICAgWydzdHJva2Utd2lkdGgnLCAnd2VpZ2h0J10sXHJcbiAgICBbJ3N0cm9rZS1vcGFjaXR5JywgJ29wYWNpdHknXSxcclxuICAgIFsnZmlsbCcsICdmaWxsQ29sb3InXSxcclxuICAgIFsnZmlsbC1vcGFjaXR5JywgJ2ZpbGxPcGFjaXR5J11cclxuXTtcclxuXHJcbmZ1bmN0aW9uIGZhbGxiYWNrKGEsIGIpIHtcclxuICAgIHZhciBjID0ge307XHJcbiAgICBmb3IgKHZhciBrIGluIGIpIHtcclxuICAgICAgICBpZiAoYVtrXSA9PT0gdW5kZWZpbmVkKSBjW2tdID0gYltrXTtcclxuICAgICAgICBlbHNlIGNba10gPSBhW2tdO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbWFwKGEpIHtcclxuICAgIHZhciBkID0ge307XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1hcHBpbmcubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBkW21hcHBpbmdbaV1bMV1dID0gYVttYXBwaW5nW2ldWzBdXTtcclxuICAgIH1cclxuICAgIHJldHVybiBkO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzdHlsZShmZWF0dXJlKSB7XHJcbiAgICByZXR1cm4gcmVtYXAoZmFsbGJhY2soZmVhdHVyZS5wcm9wZXJ0aWVzIHx8IHt9LCBkZWZhdWx0cykpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIHN0eWxlOiBzdHlsZSxcclxuICAgIGRlZmF1bHRzOiBkZWZhdWx0c1xyXG59O1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xyXG52YXIgZm9ybWF0X3VybCA9IHJlcXVpcmUoJy4vZm9ybWF0X3VybCcpO1xyXG52YXIgcmVxdWVzdCA9IHJlcXVpcmUoJy4vcmVxdWVzdCcpO1xyXG5cclxudmFyIFN0eWxlTGF5ZXIgPSBMLlRpbGVMYXllci5leHRlbmQoe1xyXG5cclxuICAgIG9wdGlvbnM6IHtcclxuICAgICAgICBzYW5pdGl6ZXI6IHJlcXVpcmUoJ3Nhbml0aXplLWNhamEnKVxyXG4gICAgfSxcclxuXHJcbiAgICBpbml0aWFsaXplOiBmdW5jdGlvbihfLCBvcHRpb25zKSB7XHJcbiAgICAgICAgTC5UaWxlTGF5ZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCB1bmRlZmluZWQsIEwuZXh0ZW5kKHt9LCBvcHRpb25zLCB7XHJcbiAgICAgICAgICAgIHRpbGVTaXplOiA1MTIsXHJcbiAgICAgICAgICAgIHpvb21PZmZzZXQ6IC0xLFxyXG4gICAgICAgICAgICBtaW5OYXRpdmVab29tOiAwLFxyXG4gICAgICAgICAgICB0bXM6IGZhbHNlXHJcbiAgICAgICAgfSkpO1xyXG4gICAgICAgIHRoaXMuX3VybCA9IHRoaXMuX2Zvcm1hdFRpbGVVUkwoXyk7XHJcbiAgICAgICAgdGhpcy5fZ2V0QXR0cmlidXRpb24oXyk7XHJcbiAgICB9LFxyXG5cclxuICAgIF9nZXRBdHRyaWJ1dGlvbjogZnVuY3Rpb24oXykge1xyXG4gICAgICAgIHZhciBzdHlsZVVSTCA9IGZvcm1hdF91cmwuc3R5bGUoXywgdGhpcy5vcHRpb25zICYmIHRoaXMub3B0aW9ucy5hY2Nlc3NUb2tlbik7XHJcbiAgICAgICAgcmVxdWVzdChzdHlsZVVSTCwgTC5iaW5kKGZ1bmN0aW9uKGVyciwgc3R5bGUpIHtcclxuICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgdXRpbC5sb2coJ2NvdWxkIG5vdCBsb2FkIE1hcGJveCBzdHlsZSBhdCAnICsgc3R5bGVVUkwpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIHtlcnJvcjogZXJyfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFyIHNvdXJjZXMgPSBbXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgaWQgaW4gc3R5bGUuc291cmNlcykge1xyXG4gICAgICAgICAgICAgICAgdmFyIHNvdXJjZSA9IHN0eWxlLnNvdXJjZXNbaWRdLnVybC5zcGxpdCgnbWFwYm94Oi8vJylbMV07XHJcbiAgICAgICAgICAgICAgICBzb3VyY2VzLnB1c2goc291cmNlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXF1ZXN0KGZvcm1hdF91cmwudGlsZUpTT04oc291cmNlcy5qb2luKCksIHRoaXMub3B0aW9ucy5hY2Nlc3NUb2tlbiksIEwuYmluZChmdW5jdGlvbihlcnIsIGpzb24pIHtcclxuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICB1dGlsLmxvZygnY291bGQgbm90IGxvYWQgVGlsZUpTT04gYXQgJyArIF8pO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCB7ZXJyb3I6IGVycn0pO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChqc29uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdXRpbC5zdHJpY3QoanNvbiwgJ29iamVjdCcpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm9wdGlvbnMuYXR0cmlidXRpb24gPSB0aGlzLm9wdGlvbnMuc2FuaXRpemVyKGpzb24uYXR0cmlidXRpb24pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl90aWxlanNvbiA9IGpzb247XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdyZWFkeScpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LCB0aGlzKSk7XHJcbiAgICAgICAgfSwgdGhpcykpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvLyBkaXNhYmxlIHRoZSBzZXRVcmwgZnVuY3Rpb24sIHdoaWNoIGlzIG5vdCBhdmFpbGFibGUgb24gbWFwYm94IHRpbGVsYXllcnNcclxuICAgIHNldFVybDogbnVsbCxcclxuXHJcbiAgICBfZm9ybWF0VGlsZVVSTDogZnVuY3Rpb24oc3R5bGUpIHtcclxuICAgICAgICBpZiAodHlwZW9mIHN0eWxlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICBpZiAoc3R5bGUuaW5kZXhPZignbWFwYm94Oi8vc3R5bGVzLycpID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgdXRpbC5sb2coJ0luY29ycmVjdGx5IGZvcm1hdHRlZCBNYXBib3ggc3R5bGUgYXQgJyArIHN0eWxlKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB2YXIgb3duZXJJRFN0eWxlID0gc3R5bGUuc3BsaXQoJ21hcGJveDovL3N0eWxlcy8nKVsxXTtcclxuICAgICAgICAgICAgcmV0dXJuIGZvcm1hdF91cmwoJy9zdHlsZXMvdjEvJyArIG93bmVySURTdHlsZSArICcvdGlsZXMve3p9L3t4fS97eX17cn0nLCB0aGlzLm9wdGlvbnMuYWNjZXNzVG9rZW4pO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHN0eWxlID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICByZXR1cm4gZm9ybWF0X3VybCgnL3N0eWxlcy92MS8nICsgc3R5bGUub3duZXIgKyAnLycgKyBzdHlsZS5pZCArICcvdGlsZXMve3p9L3t4fS97eX17cn0nLCB0aGlzLm9wdGlvbnMuYWNjZXNzVG9rZW4pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5TdHlsZUxheWVyID0gU3R5bGVMYXllcjtcclxuXHJcbm1vZHVsZS5leHBvcnRzLnN0eWxlTGF5ZXIgPSBmdW5jdGlvbihfLCBvcHRpb25zKSB7XHJcbiAgICByZXR1cm4gbmV3IFN0eWxlTGF5ZXIoXywgb3B0aW9ucyk7XHJcbn07XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XHJcbnZhciBmb3JtYXRQYXR0ZXJuID0gL1xcLigoPzpwbmd8anBnKVxcZCopKD89JHxcXD8pLztcclxuXHJcbnZhciBUaWxlTGF5ZXIgPSBMLlRpbGVMYXllci5leHRlbmQoe1xyXG4gICAgaW5jbHVkZXM6IFtyZXF1aXJlKCcuL2xvYWRfdGlsZWpzb24nKV0sXHJcblxyXG4gICAgb3B0aW9uczoge1xyXG4gICAgICAgIHNhbml0aXplcjogcmVxdWlyZSgnc2FuaXRpemUtY2FqYScpXHJcbiAgICB9LFxyXG5cclxuICAgIC8vIGh0dHA6Ly9tYXBib3guY29tL2RldmVsb3BlcnMvYXBpLyNpbWFnZV9xdWFsaXR5XHJcbiAgICBmb3JtYXRzOiBbXHJcbiAgICAgICAgJ3BuZycsICdqcGcnLFxyXG4gICAgICAgIC8vIFBOR1xyXG4gICAgICAgICdwbmczMicsICdwbmc2NCcsICdwbmcxMjgnLCAncG5nMjU2JyxcclxuICAgICAgICAvLyBKUEdcclxuICAgICAgICAnanBnNzAnLCAnanBnODAnLCAnanBnOTAnXSxcclxuXHJcbiAgICBzY2FsZVByZWZpeDogJ0AyeC4nLFxyXG5cclxuICAgIGluaXRpYWxpemU6IGZ1bmN0aW9uKF8sIG9wdGlvbnMpIHtcclxuICAgICAgICBMLlRpbGVMYXllci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIHVuZGVmaW5lZCwgb3B0aW9ucyk7XHJcblxyXG4gICAgICAgIHRoaXMuX3RpbGVqc29uID0ge307XHJcblxyXG4gICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZm9ybWF0KSB7XHJcbiAgICAgICAgICAgIHV0aWwuc3RyaWN0X29uZW9mKG9wdGlvbnMuZm9ybWF0LCB0aGlzLmZvcm1hdHMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fbG9hZFRpbGVKU09OKF8pO1xyXG4gICAgfSxcclxuXHJcbiAgICBzZXRGb3JtYXQ6IGZ1bmN0aW9uKF8pIHtcclxuICAgICAgICB1dGlsLnN0cmljdChfLCAnc3RyaW5nJyk7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zLmZvcm1hdCA9IF87XHJcbiAgICAgICAgdGhpcy5yZWRyYXcoKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLy8gZGlzYWJsZSB0aGUgc2V0VXJsIGZ1bmN0aW9uLCB3aGljaCBpcyBub3QgYXZhaWxhYmxlIG9uIG1hcGJveCB0aWxlbGF5ZXJzXHJcbiAgICBzZXRVcmw6IG51bGwsXHJcblxyXG4gICAgX3NldFRpbGVKU09OOiBmdW5jdGlvbihqc29uKSB7XHJcbiAgICAgICAgdXRpbC5zdHJpY3QoanNvbiwgJ29iamVjdCcpO1xyXG5cclxuICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5mb3JtYXQpIHtcclxuICAgICAgICAgIHZhciBtYXRjaCA9IGpzb24udGlsZXNbMF0ubWF0Y2goZm9ybWF0UGF0dGVybik7XHJcbiAgICAgICAgICBpZiAobWF0Y2gpIHtcclxuICAgICAgICAgICAgICB0aGlzLm9wdGlvbnMuZm9ybWF0ID0gbWF0Y2hbMV07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBMLmV4dGVuZCh0aGlzLm9wdGlvbnMsIHtcclxuICAgICAgICAgICAgdGlsZXM6IGpzb24udGlsZXMsXHJcbiAgICAgICAgICAgIGF0dHJpYnV0aW9uOiB0aGlzLm9wdGlvbnMuc2FuaXRpemVyKGpzb24uYXR0cmlidXRpb24pLFxyXG4gICAgICAgICAgICBtaW5ab29tOiBqc29uLm1pbnpvb20gfHwgMCxcclxuICAgICAgICAgICAgbWF4Wm9vbToganNvbi5tYXh6b29tIHx8IDE4LFxyXG4gICAgICAgICAgICB0bXM6IGpzb24uc2NoZW1lID09PSAndG1zJyxcclxuICAgICAgICAgICAgYm91bmRzOiBqc29uLmJvdW5kcyAmJiB1dGlsLmxib3VuZHMoanNvbi5ib3VuZHMpXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuX3RpbGVqc29uID0ganNvbjtcclxuICAgICAgICB0aGlzLnJlZHJhdygpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICBnZXRUaWxlSlNPTjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RpbGVqc29uO1xyXG4gICAgfSxcclxuXHJcbiAgICAvLyB0aGlzIGlzIGFuIGV4Y2VwdGlvbiB0byBtYXBib3guanMgbmFtaW5nIHJ1bGVzIGJlY2F1c2UgaXQncyBjYWxsZWRcclxuICAgIC8vIGJ5IGBMLm1hcGBcclxuICAgIGdldFRpbGVVcmw6IGZ1bmN0aW9uKHRpbGVQb2ludCkge1xyXG4gICAgICAgIHZhciB0aWxlcyA9IHRoaXMub3B0aW9ucy50aWxlcyxcclxuICAgICAgICAgICAgaW5kZXggPSBNYXRoLmZsb29yKE1hdGguYWJzKHRpbGVQb2ludC54ICsgdGlsZVBvaW50LnkpICUgdGlsZXMubGVuZ3RoKSxcclxuICAgICAgICAgICAgdXJsID0gdGlsZXNbaW5kZXhdO1xyXG5cclxuICAgICAgICB2YXIgdGVtcGxhdGVkID0gTC5VdGlsLnRlbXBsYXRlKHVybCwgdGlsZVBvaW50KTtcclxuICAgICAgICBpZiAoIXRlbXBsYXRlZCB8fCAhdGhpcy5vcHRpb25zLmZvcm1hdCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGVtcGxhdGVkO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0ZW1wbGF0ZWQucmVwbGFjZShmb3JtYXRQYXR0ZXJuLFxyXG4gICAgICAgICAgICAgICAgKEwuQnJvd3Nlci5yZXRpbmEgPyB0aGlzLnNjYWxlUHJlZml4IDogJy4nKSArIHRoaXMub3B0aW9ucy5mb3JtYXQpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLy8gVGlsZUpTT04uVGlsZUxheWVycyBhcmUgYWRkZWQgdG8gdGhlIG1hcCBpbW1lZGlhdGVseSwgc28gdGhhdCB0aGV5IGdldFxyXG4gICAgLy8gdGhlIGRlc2lyZWQgei1pbmRleCwgYnV0IGRvIG5vdCB1cGRhdGUgdW50aWwgdGhlIFRpbGVKU09OIGhhcyBiZWVuIGxvYWRlZC5cclxuICAgIF91cGRhdGU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMudGlsZXMpIHtcclxuICAgICAgICAgICAgTC5UaWxlTGF5ZXIucHJvdG90eXBlLl91cGRhdGUuY2FsbCh0aGlzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMuVGlsZUxheWVyID0gVGlsZUxheWVyO1xyXG5cclxubW9kdWxlLmV4cG9ydHMudGlsZUxheWVyID0gZnVuY3Rpb24oXywgb3B0aW9ucykge1xyXG4gICAgcmV0dXJuIG5ldyBUaWxlTGF5ZXIoXywgb3B0aW9ucyk7XHJcbn07XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbmZ1bmN0aW9uIGNvbnRhaW5zKGl0ZW0sIGxpc3QpIHtcclxuICAgIGlmICghbGlzdCB8fCAhbGlzdC5sZW5ndGgpIHJldHVybiBmYWxzZTtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGlmIChsaXN0W2ldID09PSBpdGVtKSByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBpZFVybDogZnVuY3Rpb24oXywgdCkge1xyXG4gICAgICAgIGlmIChfLmluZGV4T2YoJy8nKSA9PT0gLTEpIHQubG9hZElEKF8pO1xyXG4gICAgICAgIGVsc2UgdC5sb2FkVVJMKF8pO1xyXG4gICAgfSxcclxuICAgIGxvZzogZnVuY3Rpb24oXykge1xyXG4gICAgICAgIGlmICh0eXBlb2YgY29uc29sZSA9PT0gJ29iamVjdCcgJiZcclxuICAgICAgICAgICAgdHlwZW9mIGNvbnNvbGUuZXJyb3IgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihfKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgc3RyaWN0OiBmdW5jdGlvbihfLCB0eXBlKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBfICE9PSB0eXBlKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBhcmd1bWVudDogJyArIHR5cGUgKyAnIGV4cGVjdGVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIHN0cmljdF9pbnN0YW5jZTogZnVuY3Rpb24oXywga2xhc3MsIG5hbWUpIHtcclxuICAgICAgICBpZiAoIShfIGluc3RhbmNlb2Yga2xhc3MpKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBhcmd1bWVudDogJyArIG5hbWUgKyAnIGV4cGVjdGVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIHN0cmljdF9vbmVvZjogZnVuY3Rpb24oXywgdmFsdWVzKSB7XHJcbiAgICAgICAgaWYgKCFjb250YWlucyhfLCB2YWx1ZXMpKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBhcmd1bWVudDogJyArIF8gKyAnIGdpdmVuLCB2YWxpZCB2YWx1ZXMgYXJlICcgK1xyXG4gICAgICAgICAgICAgICAgdmFsdWVzLmpvaW4oJywgJykpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBzdHJpcF90YWdzOiBmdW5jdGlvbihfKSB7XHJcbiAgICAgICAgcmV0dXJuIF8ucmVwbGFjZSgvPFtePF0rPi9nLCAnJyk7XHJcbiAgICB9LFxyXG4gICAgbGJvdW5kczogZnVuY3Rpb24oXykge1xyXG4gICAgICAgIC8vIGxlYWZsZXQtY29tcGF0aWJsZSBib3VuZHMsIHNpbmNlIGxlYWZsZXQgZG9lcyBub3QgZG8gZ2VvanNvblxyXG4gICAgICAgIHJldHVybiBuZXcgTC5MYXRMbmdCb3VuZHMoW1tfWzFdLCBfWzBdXSwgW19bM10sIF9bMl1dXSk7XHJcbiAgICB9XHJcbn07XHJcbiJdfQ==
