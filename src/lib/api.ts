
/**
 * Safe fetch utility that handles JSON and non-JSON (HTML/Error) responses gracefully
 * to avoid the "Unexpected token '<', \"<!doctype \"... is not valid JSON" error.
 */
export async function safeFetch(
  url: string, 
  options: RequestInit = {}, 
  getToken?: () => Promise<string | null>
) {
  const performFetch = async (currentOptions: RequestInit) => {
    try {
      const res = await fetch(url, currentOptions);
      
      // Check content type
      const contentType = res.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      if (isJson) {
        const data = await res.json();
        
        // If we get an expired token error and have a way to refresh, try once
        const isExpired = res.status === 401 && getToken && (
          data.details?.toLowerCase().includes('expired') || 
          data.error?.toLowerCase().includes('expired') ||
          data.message?.toLowerCase().includes('expired')
        );

        if (isExpired) {
          console.warn(`[SafeFetch] Token expired for ${url}, attempting refresh...`);
          const newToken = await getToken();
          if (newToken) {
            const retryOptions = {
              ...currentOptions,
              headers: {
                ...currentOptions.headers,
                'Authorization': `Bearer ${newToken}`
              }
            };
            return await performFetch(retryOptions);
          }
        }

        return { ok: res.ok, status: res.status, data };
      } else {
        // If not JSON, it might be an HTML error page or SPA fallback
        const text = await res.text();
        const isHtml = text.trim().toLowerCase().startsWith('<!doctype html') || text.trim().toLowerCase().startsWith('<html');
        
        const errorMessage = isHtml 
          ? `Received an HTML response (Status ${res.status}) instead of JSON. This usually happens when an API route is missing or the server crashed. HTML Sample: ${text.substring(0, 200)}...`
          : `Received non-JSON response (Status ${res.status}): ${text.substring(0, 100)}`;
          
        console.warn(`[SafeFetch] non-JSON response from ${url}:`, {
          status: res.status,
          contentType,
          textSample: text.substring(0, 200)
        });

        return { 
          ok: false, 
          status: res.status, 
          data: { 
            error: "Invalid Server Response", 
            message: errorMessage,
            details: text.substring(0, 1000),
            status: res.status,
            contentType
          } 
        };
      }
    } catch (err: any) {
      console.error(`[SafeFetch] network/fetch error for ${url}:`, err);
      return { 
        ok: false, 
        status: 0, 
        data: { 
          error: "Network Failure", 
          message: err.message || "Could not connect to the server." 
        } 
      };
    }
  };

  return await performFetch(options);
}
