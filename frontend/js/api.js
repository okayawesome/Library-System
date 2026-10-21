// Talks to the FastAPI backend. The backend also serves this page, so the
// API is on the same origin and needs no address or CORS settings.

const API_BASE = '/api';

let token = null;
let onExpired = () => {};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function setToken(value) {
  token = value;
}

// Called when a signed-in request comes back 401 (for example, the token expired).
export function onSessionExpired(handler) {
  onExpired = handler;
}

// Sends `body` as JSON, or as a form when it is URLSearchParams.
// Throws an ApiError carrying the server's message when the request fails.
export async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = body instanceof URLSearchParams;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method, headers, body: body === undefined || isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the library server. Is it running?", 0);
  }
  const data = await response.json().catch(() => null);
  if (response.status === 401 && token) {
    onExpired();
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }
  if (!response.ok) {
    const detail = data?.detail;
    throw new ApiError(typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map((item) => item.msg).join(' ')
        : `The server returned an error (${response.status}).`, response.status);
  }
  return data;
}

// Members and admins sign in at separate endpoints. Returns the access token.
export async function requestToken(role, username, password) {
  const data = await request(`/${role}/token`, {
    method: 'POST', body: new URLSearchParams({ username, password }),
  });
  return data.access_token;
}
