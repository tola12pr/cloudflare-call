addEventListener("fetch", async event => {
    event.respondWith((async function() {
        const isPreflightRequest = (event.request.method === "OPTIONS");
        const originUrl = new URL(event.request.url);

        function setupCORSHeaders(headers) {
            headers.set("Access-Control-Allow-Origin", event.request.headers.get("Origin"));
            headers.set("Access-Control-Allow-Credentials", "true");
            headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
            headers.set("Access-Control-Allow-Headers", 
                "Content-Type, X-Custom-Header, X-Requested-With, Authorization, Origin, Accept");
            if (isPreflightRequest) {
                headers.set("Access-Control-Max-Age", "86400");
                headers.delete("X-Content-Type-Options");
            }
            return headers;
        }

        const targetUrl = decodeURIComponent(originUrl.search.substr(1));

        console.log("Received request for:", targetUrl);
        console.log("Request method:", event.request.method);

        const originHeader = event.request.headers.get("Origin");
        const connectingIp = event.request.headers.get("CF-Connecting-IP");

        const filteredHeaders = new Headers();
        for (const [key, value] of event.request.headers.entries()) {
            if (
                !key.match(/^origin$/i) && 
                !key.match(/^cf-/i) && 
                !key.match(/^x-forw/i) && 
                !key.match(/^x-cors-headers$/i)
            ) {
                filteredHeaders.set(key, value);
            }
        }

        const newRequest = new Request(event.request, {
            redirect: "follow",
            headers: filteredHeaders
        });

        const response = await fetch(targetUrl, newRequest);
        let responseHeaders = new Headers(response.headers);
        responseHeaders = setupCORSHeaders(responseHeaders);

        const exposedHeaders = ["Content-Type", "X-Custom-Header", "X-Requested-With"];
        responseHeaders.set("Access-Control-Expose-Headers", exposedHeaders.join(","));

        const allResponseHeaders = {};
        for (const [key, value] of response.headers.entries()) {
            allResponseHeaders[key] = value;
        }
        responseHeaders.set("cors-received-headers", JSON.stringify(allResponseHeaders));

        const responseBody = isPreflightRequest ? null : await response.arrayBuffer();

        return new Response(responseBody, {
            headers: responseHeaders,
            status: isPreflightRequest ? 200 : response.status,
            statusText: isPreflightRequest ? "OK" : response.statusText
        });

    })());
});
