/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-43e44e5a'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "77cf48c34e6e6b12d85d58f4ef32750b"
  }, {
    "url": "pwa-512x512.png",
    "revision": "075f39918f0e4d5556ecf4912aa87220"
  }, {
    "url": "pwa-192x192.png",
    "revision": "63c1f1303ec2e4436dee1e74eb3c3806"
  }, {
    "url": "index.html",
    "revision": "e5e6bec8e104c90328e354cd0815b5f7"
  }, {
    "url": "favicon.ico",
    "revision": "c2dd3c7ef1f4c338ae9999a7a2d15725"
  }, {
    "url": "favicon-32x32.png",
    "revision": "a558ac952ae5b1a7c4ef33678ec6e0ac"
  }, {
    "url": "favicon-16x16.png",
    "revision": "b9bfbac6ce583cc29f4667baa61654a0"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "e83866951379b186998ed8af4daf0882"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/index-DUL_c9qD.css",
    "revision": null
  }, {
    "url": "assets/index-D1fAKHQf.js",
    "revision": null
  }, {
    "url": "assets/aistudio/image_e3184a06.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_b4386b0c.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_8981a0c0.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_87ed8fd1.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_7ba5c804.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_5da34c3c.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_4b854da1.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_40da1391.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_34040988.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_2f44f9e9.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_03d1f6a5.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_02f3793f.png",
    "revision": null
  }, {
    "url": "assets/aistudio/518b9ec1-b903-4780-b49a-50f66e8d4ec2_1359ad11.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "e83866951379b186998ed8af4daf0882"
  }, {
    "url": "favicon-16x16.png",
    "revision": "b9bfbac6ce583cc29f4667baa61654a0"
  }, {
    "url": "favicon-32x32.png",
    "revision": "a558ac952ae5b1a7c4ef33678ec6e0ac"
  }, {
    "url": "favicon.ico",
    "revision": "c2dd3c7ef1f4c338ae9999a7a2d15725"
  }, {
    "url": "pwa-192x192.png",
    "revision": "63c1f1303ec2e4436dee1e74eb3c3806"
  }, {
    "url": "pwa-512x512.png",
    "revision": "075f39918f0e4d5556ecf4912aa87220"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "77cf48c34e6e6b12d85d58f4ef32750b"
  }, {
    "url": "manifest.webmanifest",
    "revision": "6c18ea3cd6edf18478224907767f5b15"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/version\.json/]
  }));
  workbox.registerRoute(/version\.json(\?.*)?$/i, new workbox.NetworkOnly(), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
