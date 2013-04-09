'use strict';

/**
 * Flexible Web-Crawler Module
 * (https://github.com/eckardto/flexible.git)
 *
 * This file is part of Flexible.
 *
 * Flexible is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Flexible is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Flexible.  If not, see <http://www.gnu.org/licenses/>.
 */

var url = require('url');

/**
 * Router middleware (wildcards, placeholders, etc).
 */
module.exports = function () {
    return function (crawler) {
        crawler._routes = [];

        crawler.route = function (pattern, route) {
            var placeholders = [], regex;
            if (pattern instanceof RegExp) {regex = pattern;}
            else if (pattern === '*') {regex = /.*/;}
            else {
                var parsed_pattern = url.parse(pattern);
                if (!parsed_pattern.hostname) {
                    if (pattern.charAt(0) !== '/') {
                        pattern = '/' + pattern;
                    }

                    pattern = '*' + pattern;
                }

                var replace = function (match, operator, placeholder) {
                    if (placeholder) {placeholders.push(placeholder);}
                    
                    return operator === '*' ? '(.*?)' : '([^/#?]*)';
                };

                pattern = pattern.replace(/([:*])([\w\-]+)?/g, replace);
                regex = new RegExp('^' + pattern + '$');
            }
            
            crawler._routes.push({
                route: route, match: function (location) {
                    var parsed_location = url.parse(location);
                    if (parsed_location.search) {
                        location = location
                            .replace(parsed_location.search, '');
                    }

                    var results = location.match(regex);
                    if (!results) {return;}

                    for (var params = {}, i = 1; 
                         i < results.length; i++) {
                        var placeholder = placeholders[i - 1];
                        if (placeholder) {
                            params[placeholder] = results[i];
                        }
                    }

                    return params;
                }
            });
            
            return crawler;
        };

        crawler._middleware
            .push(function (crawler, req, res, item, next) {
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

                        crawler._routes[i].route(req, res, item); 

                        break;
                    }
                }

                next(null, crawler, req, res, item);
            });
    };
};