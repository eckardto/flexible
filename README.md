### This project will soon be superseded by [node-web-crawler](https://github.com/eckardto/node-web-crawler).

Flexible Web Crawler
====================

Easily build flexible, scalable, and distributed, web crawlers for [node](http://nodejs.org).

## Simple Example

```javascript
var flexible = require('flexible');

// Initiate a crawler. Chainable.
var crawler = flexible('http://www.example.com/')
    .use(flexible.pgQueue('postgres://postgres:1234@localhost:5432/'))

    .route('*/search?q=', function (req, res, body, doc, next) {
        console.log('Search results handled for query:', req.params.q);
    })
    .route('*/users/:name', function (req, res, body, doc, next) {
        crawler.navigate('http://www.example.com/search?q=' + req.params.name);
    })
    .route('*', function (req, res, body, doc, next) {
        console.log('Every other document is handled by this route.');
    })

    .on('complete', function () {
        console.log('All of the queued locations have been crawled.');
    })
    
    .on('error', function (error) {
        console.error('Error:', error.message);
    });
```

## Features
* Asynchronous friendly, and evented, API for easily building flexible, scalable, and distributed web crawlers.
* An array based queue for small crawls, and a PostgreSQL based queue for massive, and efficient, crawls.
* Uses a fast, lightweight, and forgivable, HTML parser to ensure proper document compatibility for crawling.
* Component system; use different queues, a router (wildcards, placeholders, etc), and other components.

## Installation

```
npm install flexible
```

Or from source:

```
git clone git://github.com/eckardto/flexible.git 
cd flexible
npm link
```

## Complex Example / Demo

```
flexible 

Crawl the web using Flexible for node.
Usage: node [...]/flexible.bin.js

Options:
  --url, --uri                  URL of web page to begin crawling on.                        [string]  [required]
  --domains, -d                 List of domains to allow crawling of.                        [string]
  --interval, -i                Request interval of each crawler.                          
  --encoding, -e                Encoding of response body for decoding.                      [string]
  --max-concurrency, -m         Maximum concurrency of each crawler.                       
  --max-crawl-queue-length, -M  Maximum length of the crawl queue.                         
  --user-agent, -A              User-agent to identify each crawler as.                      [string]
  --timeout, -t                 Maximum seconds a request can take.                        
  --follow-redirect             Follow HTTP redirection responses.                           [boolean]
  --max-redirects               Maximum amount of redirects.                               
  --proxy, -p                   An HTTP proxy to use for requests.                           [string]
  --controls, -c                Enable pause (ctrl-p), resume (ctrl-r), and abort (ctrl-a).  [boolean]  [default: true]
  --pg-uri, --pg-url            PostgreSQL URI to connect to for queue.                      [string]
  --pg-get-interval             PostgreSQL queue get request interval.                     
  --pg-max-get-attempts         PostgresSQL queue max get attempts.
```

## API

#### flexible([options])
Returns a configured, navigated and or with crawling started, crawler instance.

#### new flexible.Crawler([options])
Returns a new Crawler object.

#### Crawler#use([component], [callback])
Configure the crawler to use a component.

#### Crawler#navigate(url, [callback])
Process a location, and have the crawler navigate (queue) to it.

#### Crawler#crawl([callback])
Have the crawler crawl (recursive).

#### Crawler#pause()
Have the crawler pause crawling.

#### Crawler#resume()
Have the crawler resume crawling.

#### Crawler#abort()
Have the crawler abort crawling.

### Events

* `navigated` (url)
Emitted when a location has been successfully navigated (queued) to.
* `document` (doc)
Emitted when a document is finished being processed by the crawler.
* `paused`
Emitted when the crawler has paused crawling.
* `resumed`
Emitted when the crawler has resumed crawling.
* `complete`
Emitted when all navigated (queued) to locations have been crawled.

## License
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
