'use strict';

var url = require('url');
var querystring = require('querystring');

/**
 * Call the middleware.
 */
exports.call = function (crawler, req, res, body, item, next) {
    var query = url.parse(req.uri.href).query;
    if (query) {
        query = querystring.parse(query);
        if (!req.params) {req.params = query;}
        else {
            for (var i in query) {
                if (query.hasOwnProperty(i)) {
                    req.params[i] = params[i];
                }
            }
        }
    }

    next(null, crawler, req, res, body, item);
};