Flexible Web-Crawler Module
===========================

Easily build flexible, scalable, and distributed, web crawlers for Node.js.

#### Simple Example

```javascript
var flexible = require('flexible');

// Initiate a crawler. Chainable.
var crawler = flexible('http://www.example.com/')
    .use(flexible.pgQueue('postgres://postgres:1234@localhost:5432/'))

    .route('/search?q=', function (req, res, body, dom, item) {
        console.log('Search results handled for query:', req.params.q);
    })
    .route('/users/:name', function (req, res, body, dom, item) {
        crawler.navigate('http://www.example.com/search?q=' + req.params.name);
    })
    .route('*', function (req, res, body, dom, item) {
        console.log('Every other document is handled by this route.');
    })

    .on('complete', function () {console.log('Crawling finished!');})
    .on('error', function (error) {console.error(error);})

    .crawl();

```
### What does Flexible provide?
* Asynchronous friendly, and evented, API for building flexible, scalable, and distributed web crawlers.
* An array based queue for moderate crawls, and a PostgreSQL based queue for massive, and efficient, crawls.
* Uses a fast, lightweight, and forgivable, HTML parser to ensure proper document compatibility for crawling.
* Component system; use different queues, a router (wildcards, placeholders, etc), querystring parser, etc.

### Installation

```
npm install flexible
```

Or from source:

```
git clone git://github.com/eckardto/flexible.git 
cd flexible
npm link
```

### Complex Example / Demo

```
flexible 

Crawl the web using Flexible.
Usage: node [...]/flexible.bin.js

Options:
  --uri, --url       URI of web page to begin crawling on.          [string]
  --domains          List of domains to allow crawling of.          [string]
  --pg               PostgreSQL URI to connect to for queue.        [string]  [required]
  --processes        Amount of child processes to use.              [default: 0]
  --interval         Request interval of each crawler.              [default: 250]
  --max-concurrency  Maximum concurrency of each crawler.           [default: 5]
  --user-agent       User-agent to identify each crawler as.        [string]
  --timeout          Maximum seconds a request can take.            [default: false]
  --follow-redirect  Follow redirects or not.                       [boolean]
  --max-redirects    Maximum amount of redirects.                 
  --user             Username for HTTP basic authentication.        [string]
  --pass             Password for HTTP basic authentication.        [string]
  --proxy            An HTTP proxy to use for requests.             [string]
```

## API

### Flexible(options)
Returns a configured, ready to begin crawling on demand, crawler instance.

### new Flexible.Crawler()
Returns a new Crawler object; basic configuration.

### Crawler#use(uri, [callback])
Configure crawler to use a component.

### Crawler#navigate(uri, [callback])
Process a URI, and have the crawler navigate (queue) to it.

### Crawler#crawl([callback])
Have crawler crawl (recursive); navigates to each URI the crawler discovers.

### Crawler#Queue#add(uri, [callback])
Add a URI to the crawler's queue allowing it to be crawled.

### Crawler#Queue#get([callback])
Retrieve, and start processing, an unprocessed item from the crawler's queue.

### Crawler#Queue#end(item, [error], [callback])
End processing of an item of the crawler's queue.

### Events

* `navigated` (uri)
Emitted when a URI has been successfully navigated (queued).
* `document` (req, res, body, dom, item)
Emitted when a document is finished being processed.
* `complete`
Emitted when all navigated (queued) URIs have been crawled.

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