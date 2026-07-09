/**
 * Logout request body.
 *
 * The OpenAPI contract does not define a request body for /auth/logout.
 * The session token is expected via the Authorization header or a secure
 * HttpOnly cookie. This DTO remains empty to stay aligned with the contract.
 */
export class LogoutDto {}
