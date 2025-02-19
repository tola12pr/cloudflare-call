addEventListener("fetch", async event => {
    event.respondWith((async function() {
        const isPreflightRequest = (event.request.method === "OPTIONS");
        const originUrl = new URL(event.request.url);

        // Function to set up CORS headers, adding more robust CORS options
        function setupCORSHeaders(headers) {
            headers.set("Access-Control-Allow-Origin", event.request.headers.get("Origin"));
            headers.set("Access-Control-Allow-Credentials", "true");  // Allow credentials

            // Allow all methods for CORS, you can limit this to what you need
            headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");

            // Set the allowed headers for CORS
            headers.set("Access-Control-Allow-Headers", 
                "Content-Type, X-Custom-Header, X-Requested-With, Authorization, Origin, Accept");

            // If it's a preflight request, return early with the proper CORS headers
            if (isPreflightRequest) {
                headers.set("Access-Control-Max-Age", "86400");  // Cache preflight response for 24 hours
                headers.delete("X-Content-Type-Options");  // Remove security header that blocks some requests
            }
            return headers;
        }

        const targetUrl = decodeURIComponent(originUrl.search.substr(1)); // Decode the passed URL

        // Log request details for debugging
        console.log("Received request for:", targetUrl);
        console.log("Request method:", event.request.method);

        const originHeader = event.request.headers.get("Origin");
        const connectingIp = event.request.headers.get("CF-Connecting-IP");

        // Validate the origin and target URL (whitelist/blacklist check can go here if needed)
        if (isListedInWhitelist(originHeader, whitelistOrigins) && !isListedInBlacklist(targetUrl, blacklistUrls)) {
            
            // Filtering out unwanted headers from the incoming request
            const filteredHeaders = {};
            for (const [key, value] of event.request.headers.entries()) {
                // Don't forward headers that can cause CORS issues
                if (
                    !key.match(/^origin$/i) && 
                    !key.match(/^cf-/i) && 
                    !key.match(/^x-forw/i) && 
                    !key.match(/^x-cors-headers$/i)
                ) {
                    filteredHeaders[key] = value;
                }
            }

            const newRequest = new Request(event.request, {
                redirect: "follow",
                headers: filteredHeaders
            });

            // Fetch the target URL
            const response = await fetch(targetUrl, newRequest);
            let responseHeaders = new Headers(response.headers);

            // Setup CORS headers on the response
            responseHeaders = setupCORSHeaders(responseHeaders);

            // Expose the CORS-related headers in the response
            const exposedHeaders = ["Content-Type", "X-Custom-Header", "X-Requested-With"];
            responseHeaders.set("Access-Control-Expose-Headers", exposedHeaders.join(","));

            // Add a custom header to track received headers
            const allResponseHeaders = {};
            for (const [key, value] of response.headers.entries()) {
                allResponseHeaders[key] = value;
            }
            responseHeaders.set("cors-received-headers", JSON.stringify(allResponseHeaders));

            // Prepare and return the response
            const responseBody = isPreflightRequest ? null : await response.arrayBuffer();

            return new Response(responseBody, {
                headers: responseHeaders,
                status: isPreflightRequest ? 200 : response.status,
                statusText: isPreflightRequest ? "OK" : response.statusText
            });

        } else {
            // Forbidden access if origin or target URL is invalid
            return new Response(
                "Forbidden: Access to the requested resource is denied.",
                {
                    status: 403,
                    statusText: 'Forbidden',
                    headers: { "Content-Type": "text/html" }
                }
            );
        }
    })());
});
