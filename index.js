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
        const filteredHeaders = new Headers();

        for (const [key, value] of event.request.headers.entries()) {
            if (
                !key.match(/^origin$/i) && 
                !key.match(/^cf-/i) && 
                !key.match(/^x-forw/i) && 
                !key.match(/^_cf-/i) &&
                !key.match(/^__cf/i) &&
                !key.match(/^x-cors-headers$/i)
            ) {
                filteredHeaders.set(key, value);
            }
        }

        const cookieHeader = event.request.headers.get("Cookie");
        if (cookieHeader) {
            filteredHeaders.set("Cookie", cookieHeader);
        }

        const token = event.request.headers.get("Authorization");
        if (token) {
            filteredHeaders.set("Authorization", token);
        }

        const newRequest = new Request(event.request, {
            redirect: "follow",
            headers: filteredHeaders,
        });

        let response;
        try {
            response = await fetch(targetUrl, newRequest);
        } catch (error) {
            console.error("Fetch error:", error);
            return new Response("Error fetching the target URL", { status: 502 });
        }

        let responseHeaders = new Headers(response.headers);
        responseHeaders = setupCORSHeaders(responseHeaders);

        const exposedHeaders = ["Content-Type", "X-Custom-Header", "X-Requested-With"];
        responseHeaders.set("Access-Control-Expose-Headers", exposedHeaders.join(","));

        const acceptHeader = event.request.headers.get("Accept");
        const responseBody = isPreflightRequest ? null : await response.text();

        if (acceptHeader && acceptHeader.includes("application/json")) {
            try {
                const jsonResponse = JSON.parse(responseBody);
                return new Response(JSON.stringify(jsonResponse), {
                    headers: {
                        ...Object.fromEntries(responseHeaders),
                        "Content-Type": "application/json"
                    },
                    status: response.status,
                    statusText: response.statusText
                });
            } catch (e) {
                return new Response("Invalid JSON response", { status: 500 });
            }
        } else {
            return new Response(responseBody, {
                headers: {
                    ...Object.fromEntries(responseHeaders),
                    "Content-Type": "text/html"
                },
                status: response.status,
                statusText: response.statusText
            });
        }

    })());
});
