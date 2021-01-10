import NotImplementedException from "../Exceptions/NotImplementedException.mjs";

class SessionInterface {
	/**
	 *
	 * @param {boolean} isValid
	 * @param {string|null} [sessionToken=null]
	 * @param {number|null} [validUntil=null]
	 * @returns {SessionInterface}
	 */
	constructor (
		isValid,
		sessionToken = null,
		validUntil = null
	) {
		let This = this;

		this.isValid = isValid;
		this.sessionToken = sessionToken;
		this.validUntil = validUntil;

		/**
		 *
		 * @param {boolean} isValid
		 * @returns {SessionInterface}
		 */
		this.setIsValid = function (isValid) {
			This.isValid = !!isValid;
			return This;
		}

		/**
		 *
		 * @param {string} sessionToken
		 * @returns {SessionInterface}
		 */
		this.setSessionToken = function (sessionToken) {
			This.sessionToken = sessionToken;
			return This;
		}

		this.setValidUntil = function (validUntil) {
			throw new NotImplementedException("setValidUntil");
		}
	}
}

export default SessionInterface;