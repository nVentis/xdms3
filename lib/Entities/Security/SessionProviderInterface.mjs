import SessionInterface from "./SessionInterface.mjs";
import LoginRequestInterface from "./LoginRequestInterface.mjs";
import NotImplementedException from "../Exceptions/NotImplementedException.mjs";

class SessionProviderInterface {
	/**
	 * Validates a given session and keeps the isValid property updated
	 * @param {SessionInterface|*} someSession
	 * @returns {Promise<SessionInterface|*>}
	 */
	async Check (someSession) {
		throw new NotImplementedException("Check");
	}

	/**
	 *
	 * @param {LoginRequestInterface|*} loginRequest
	 * @param {object|*} User
	 * @returns {Promise<SessionInterface|*>}
	 */
	async Start (
		loginRequest,
		User
	) {
		throw new NotImplementedException("Start");
	}

}

export default SessionProviderInterface;