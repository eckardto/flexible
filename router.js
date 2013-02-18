'use strict';

/**
 * Router middleware (wildcards, placeholders, etc).
 */

var url = require('url');

/**
 * Init the middleware.
 */
exports.init = function (crawler) {
    crawler._routes = [];

    crawler.route = function (pattern, route) {
        var placeholders = [], regex;
        if (pattern instanceof RegExp) {regex = pattern;}
        else if (pattern === '*') {regex = /.*/;}
        else {
            var parsed_pattern = url.parse(pattern);
            if (!parsed_pattern.hostname) {
                if (pattern.charAt(0) !== '/') {pattern = '/' + pattern;}
                pattern = '*' + pattern;
            }

            pattern = pattern
                .replace(/([:*])([\w\-]+)?/g, function (match, operator, placeholder) {             
                    if (placeholder) {placeholders.push(placeholder);}
                    return operator === '*' ? '(.*?)' : '([^/#?]*)';
                });

            regex = new RegExp('^' + pattern + '$');
        }
        
        crawler._routes.push({
            route: route,
            match: function (uri) {
                var parsed_uri = url.parse(uri);
                if (parsed_uri.search) {uri = uri.replace(parsed_uri.search, '');}

                var results = uri.match(regex);
                if (!results) {return;}

                var params = {};
                for (var i = 1; i < results.length; i++) {
                    var placeholder = placeholders[i - 1];
                    if (placeholder) {params[placeholder] = results[i];}
                }

                return params;
            }
        });
        
        return crawler;
    };
};

/**
 * Call the middleware.
 */
exports.call = function (crawler, req, res, body, item, next) {
    for (var i = 0; i < crawler._routes.length; i++) {
        var params = crawler._routes[i].match(req.uri.href);
        if (params) {
            if (!req.params) {req.params = params;}
            else {
                for (var j in params) {
                    if (params.hasOwnProperty(j)) {
                        req.params[j] = params[j];
                    }
                }
            }

            crawler._routes[i].route(req, res, body, item);
        }
    }

    next(null, crawler, req, res, body, item);
};