'use strict';

var base64 = _base64();

function formUrlencode(data) {
    return Object.keys(data).map(function(key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]);
    }).join('&')
}

function encode(data) {
    return base64.encode(encodeURIComponent(JSON.stringify(data)));
}

function decode(data) {
    return JSON.parse(decodeURIComponent(base64.decode(data)));
}


function _base64() {

    /*--------------------------------------------------------------------------*/

    var InvalidCharacterError = function(message) {
        this.message = message;
    };
    InvalidCharacterError.prototype = new Error;
    InvalidCharacterError.prototype.name = 'InvalidCharacterError';

    var error = function(message) {
        // Note: the error messages used throughout this file match those used by
        // the native `atob`/`btoa` implementation in Chromium.
        throw new InvalidCharacterError(message);
    };

    var TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    // http://whatwg.org/html/common-microsyntaxes.html#space-character
    var REGEX_SPACE_CHARACTERS = /<%= spaceCharacters %>/g;

    // `decode` is designed to be fully compatible with `atob` as described in the
    // HTML Standard. http://whatwg.org/html/webappapis.html#dom-windowbase64-atob
    // The optimized base64-decoding algorithm used is based on @atk’s excellent
    // implementation. https://gist.github.com/atk/1020396
    var decode = function(input) {
        input = String(input)
            .replace(REGEX_SPACE_CHARACTERS, '');
        var length = input.length;
        if (length % 4 == 0) {
            input = input.replace(/==?$/, '');
            length = input.length;
        }
        if (
            length % 4 == 1 ||
            // http://whatwg.org/C#alphanumeric-ascii-characters
            /[^+a-zA-Z0-9/]/.test(input)
        ) {
            error(
                'Invalid character: the string to be decoded is not correctly encoded.'
            );
        }
        var bitCounter = 0;
        var bitStorage;
        var buffer;
        var output = '';
        var position = -1;
        while (++position < length) {
            buffer = TABLE.indexOf(input.charAt(position));
            bitStorage = bitCounter % 4 ? bitStorage * 64 + buffer : buffer;
            // Unless this is the first of a group of 4 characters…
            if (bitCounter++ % 4) {
                // …convert the first 8 bits to a single ASCII character.
                output += String.fromCharCode(
                    0xFF & bitStorage >> (-2 * bitCounter & 6)
                );
            }
        }
        return output;
    };

    // `encode` is designed to be fully compatible with `btoa` as described in the
    // HTML Standard: http://whatwg.org/html/webappapis.html#dom-windowbase64-btoa
    var encode = function(input) {
        input = String(input);
        if (/[^\0-\xFF]/.test(input)) {
            // Note: no need to special-case astral symbols here, as surrogates are
            // matched, and the input is supposed to only contain ASCII anyway.
            error(
                'The string to be encoded contains characters outside of the ' +
                'Latin1 range.'
            );
        }
        var padding = input.length % 3;
        var output = '';
        var position = -1;
        var a;
        var b;
        var c;
        var d;
        var buffer;
        // Make sure any padding is handled outside of the loop.
        var length = input.length - padding;

        while (++position < length) {
            // Read three bytes, i.e. 24 bits.
            a = input.charCodeAt(position) << 16;
            b = input.charCodeAt(++position) << 8;
            c = input.charCodeAt(++position);
            buffer = a + b + c;
            // Turn the 24 bits into four chunks of 6 bits each, and append the
            // matching character for each of them to the output.
            output += (
                TABLE.charAt(buffer >> 18 & 0x3F) +
                TABLE.charAt(buffer >> 12 & 0x3F) +
                TABLE.charAt(buffer >> 6 & 0x3F) +
                TABLE.charAt(buffer & 0x3F)
            );
        }

        if (padding == 2) {
            a = input.charCodeAt(position) << 8;
            b = input.charCodeAt(++position);
            buffer = a + b;
            output += (
                TABLE.charAt(buffer >> 10) +
                TABLE.charAt((buffer >> 4) & 0x3F) +
                TABLE.charAt((buffer << 2) & 0x3F) +
                '='
            );
        } else if (padding == 1) {
            buffer = input.charCodeAt(position);
            output += (
                TABLE.charAt(buffer >> 2) +
                TABLE.charAt((buffer << 4) & 0x3F) +
                '=='
            );
        }

        return output;
    };

    return {
        'encode': encode,
        'decode': decode,
        'version': '<%= version %>'
    };
};






var unsafeHeader = ['Accept-Charset',
    'Accept-Encoding',
    'Access-Control-Request-Headers',
    'Access-Control-Request-Method',
    'Connection',
    'Content-Length',
    'Cookie',
    'Cookie2',
    'Content-Transfer-Encoding',
    'Date',
    'Expect',
    'Host',
    'Keep-Alive',
    'Origin',
    'Referer',
    'TE',
    'Trailer',
    'Transfer-Encoding',
    'Upgrade',
    'User-Agent',
    'Via'
];

function handleHeader(headers) {
    if (!headers) return;
    var newHeaders = {},
        headers = headers.split(/[\r\n]/).forEach(function(header) {
            var index = header.indexOf(":");
            var name = header.substr(0, index);
            var value = header.substr(index + 2);
            if (name) {
                newHeaders[name] = value;
            }

        })
    return newHeaders;
}

function clearProxy() {
    console.log("clearProxy");
    chrome.proxy.settings.clear({});
}

function getProxy(callback) {
    console.log("getProxy");
    chrome.proxy.settings.get({}, callback);
}

chrome.runtime.onMessage.addListener(function(request, _, cb) {
    var data;

    if (request.action === 'get') {
        chrome.storage.local.get([request.name], function(result) {
            data = result[request.name];
            if (typeof cb === 'function') {
                cb(data);
            }
        });
        return true; // 表示异步响应
    } else if (request.action === 'set') {
        var obj = {};
        obj[request.name] = request.value;
        chrome.storage.local.set(obj);
    } else if (request.action === 'clearProxy') {
        clearProxy();
    } else if (request.action === 'getProxy') {
        getProxy(function(details) {
            if (typeof cb === 'function') {
                cb(details);
            }
        });
        return true; // 表示异步响应
    }
})

function dataURLtoFile(dataUrl, filename) {
    var arr = dataUrl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]),
        n = bstr.length,
        u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}


function sendAjax(req, successFn, errorFn) {
    var formDatas;

    req.headers = req.headers || {};
    req.headers['Content-Type'] = req.headers['Content-Type'] || req.headers['Content-type'] || req.headers['content-type']; // 兼容多种写法

    var timeout = req.timeout || 1000000;

    req.method = req.method || 'GET';
    req.async = req.async === false ? false : true; // 兼容旧字段，fetch 始终异步
    req.headers = req.headers || {};
    console.log(req);

    // 处理请求体
    var body = undefined;
    if (req.method.toLowerCase() !== 'get' && req.method.toLowerCase() !== 'head' && req.method.toLowerCase() !== 'options') {
        if (!req.headers['Content-Type'] || (typeof req.headers['Content-Type'] === 'string' && req.headers['Content-Type'].startsWith('application/x-www-form-urlencoded'))) {
            req.headers['Content-Type'] = req.headers['Content-Type'] || 'application/x-www-form-urlencoded';
            body = formUrlencode(req.data);
        } else if (req.headers['Content-Type'] === 'multipart/form-data') {
            // 让浏览器自动设置带 boundary 的 Content-Type
            delete req.headers['Content-Type'];
            let formDatas = new FormData();
            if (req.formDatas && Array.isArray(req.formDatas)) {
                for (var item of req.formDatas) {
                    if (item != null) {
                        if (item.is_file) {
                            formDatas.append(item.name, dataURLtoFile(item.value, item.fileName))
                        } else if (typeof item.value === 'string' && /data.*base64/.test(item.value)) {
                            formDatas.append(item.name, dataURLtoFile(item.value, 'file'));
                        } else {
                            formDatas.append(item.name, item.value);
                        }
                    }
                }
            }
            body = formDatas;
        } else if (typeof req.data === 'object' && req.data) {
            body = JSON.stringify(req.data);
        } else {
            body = req.data;
        }
    } else {
        delete req.headers['Content-Type'];
    }

    // 处理 query
    if (req.query && typeof req.query === 'object') {
        var getUrl = formUrlencode(req.query);
        req.url = req.url + '?' + getUrl;
        req.query = '';
    }

    // 处理代理（如果有）
    var needClearProxy = false;
    if (req.headers && req.headers['GTest-Proxy'] != null) {
        var config = {
            mode: "pac_script",
            pacScript: {
                data: "function FindProxyForURL(url, host){" +
                    "return 'PROXY " + req.headers['GTest-Proxy'] + "';" +
                    "}"
            }
        };
        chrome.proxy.settings.set({ value: config, scope: 'regular' }, function() {});
        needClearProxy = true;
    }

    // 组装 headers
    var fetchHeaders = new Headers();
    if (req.headers) {
        for (var name in req.headers) {
            try {
                fetchHeaders.set(name, req.headers[name]);
            } catch (error) {
                console.warn('Cannot set header:', name, error && error.message ? error.message : String(error));
            }
        }
    }

    var controller = new AbortController();
    var timer = setTimeout(function() {
        try { controller.abort(); } catch (e) {}
    }, timeout);

    fetch(req.url, {
        method: req.method,
        headers: fetchHeaders,
        body: body,
        signal: controller.signal,
        credentials: 'include' // 尽可能携带凭据，兼容旧行为
    }).then(function(res) {
        var headersObj = {};
        try {
            res.headers.forEach(function(value, key) {
                headersObj[key] = value;
            });
        } catch (e) {}
        return res.text().then(function(text) {
            return {
                headers: headersObj,
                status: res.status,
                statusText: res.statusText,
                body: text
            };
        });
    }).then(function(response) {
        if (response.status == 200) {
            successFn(response);
        } else {
            errorFn(response);
        }
    }).catch(function(err) {
        if (err && err.name === 'AbortError') {
            errorFn({ body: 'Error:Request timeout that the time is ' + timeout });
        } else {
            errorFn({ body: (err && err.message) ? err.message : String(err) });
        }
    }).finally(function() {
        clearTimeout(timer);
        if (needClearProxy) {
            chrome.proxy.settings.clear({});
        }
    });
}

chrome.runtime.onConnect.addListener(function(port) {
    if (port.name === 'request') {
        console.log('Content script connected');
        
        // 监听断开事件
        port.onDisconnect.addListener(function() {
            console.log('Content script disconnected');
        });
        
        port.onMessage.addListener(function(msg) {
            sendAjax(msg.req, function(res) {
                try {
                    port.postMessage({
                        id: msg.id,
                        res: res
                    });
                } catch (error) {
                    console.error('Failed to send response:', error);
                }
                chrome.proxy.settings.clear({});
            }, function(err) {
                try {
                    port.postMessage({
                        id: msg.id,
                        res: err
                    });
                } catch (error) {
                    console.error('Failed to send error response:', error);
                }
                chrome.proxy.settings.clear({});
            })
        });
    }
});

// Manifest V3 注意：
// 在 MV3 中，webRequest 的 blocking 模式受到限制
// 由于此插件所有请求都通过 background script 的 XMLHttpRequest 发送
// 我们可以直接在 sendAjax 函数中处理所有请求和响应头
// 因此移除了 webRequest 监听器以避免权限问题

// 保留这些函数以备将来需要（如果使用 declarativeNetRequest）
function ensureItem(arr, name, value) {
    if (!arr || !Array.isArray(arr)) {
        return arr;
    }
    var find = false;
    arr = arr.map(function(item) {
        if (item.name == name) {
            item.value = value;
            find = true;
        }
        return item;
    })
    if (find === false) {
        arr.push({ name: name, value: value })
    }
    return arr;
}