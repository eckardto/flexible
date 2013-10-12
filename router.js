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

var async = require('async');
var url = require('url');
var pathToRegexp = require('path-to-regexp');

/**
 * Router middleware (wildcards, placeholders, etc).
 */
module.exports = function () {
    return function (crawler) {
        crawler._routes = [];

        crawler.route = function (pattern, route) {
            var placeholders = [];
            var regex = pattern instanceof RegExp ? pattern :
                pathToRegexp(pattern, placeholders);
            
            crawler._routes.push({
                route: route, match: function (loc) {
                    var parsed_loc = url.parse(loc);
                    var results = loc.match(regex);
                    if (!results) {return;}

                    for (var params = {}, i = 1; 
                         i < results.length; i++) {
                        var placeholder = placeholders[i - 1];
                        if (placeholder) {
                            params[placeholder.name] = results[i];
                        }
                    }

                    return params;
                }
            });
            
            return crawler;
        };

        crawler._middleware.push(function (crawler, doc, next) {
            async.forEach(crawler._routes, function (route, callback) {
                var params = route.match(doc.request.uri.href);
                if (!params) {return callback(null);}

                for (var j in params) {
                    if (params.hasOwnProperty(j)) {
                        doc.request.params[j] = params[j];
                    }
                }

                route.route(doc.request, doc.response, 
                            doc.body, doc, callback); 
            });

            next(null, crawler, doc);
        });
    };
};
