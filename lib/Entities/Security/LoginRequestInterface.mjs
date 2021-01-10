class LoginRequestInterface {
	/**
	 *
	 * @param {string} Password
	 * @param {boolean} [stayLoggedIn=false]
	 */
	constructor(
		Password,
		stayLoggedIn = false
	) {
		this.Password = Password;
		this.stayLoggedIn = stayLoggedIn;
	}

}

export default LoginRequestInterface;